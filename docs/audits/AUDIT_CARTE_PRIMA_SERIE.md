# Audit: carte "prima serie" TCG mancanti dal dataset

Tracciamento di sessione per l'aggiunta di carte reali del TCG (i primi
sette set inglesi, 2002-2003: Legend of Blue-Eyes White Dragon, Metal
Raiders, Spell Ruler, Pharaoh's Servant, Labyrinth of Nightmare, Legacy
of Darkness, Pharaonic Guardian) individuate come assenti da
`data/cards.json` durante un confronto con le liste ufficiali (fonte:
API YGOPRODeck, `cardinfo.php?cardset=...`). Elenco filtrato alle carte
più note/rilevanti (staple storici, carte usate nell'anime, o a tema
con contenuti già presenti nel gioco) — non include le decine di mostri
"vanilla" minori di riempimento di LOB/MRD/SRL, meno interessanti da
aggiungere.

Richiesta esplicita dell'utente: aggiungerle **tutte**, cominciando
dalle più facili. Questo file va aggiornato ad ogni carta chiusa (o
scoperta nuova), per riprendere il lavoro anche in una sessione futura
senza dover rifare la ricognizione. Prossimo ID libero in
`data/cards.json`: **901** (l'ultimo esistente è 900).

Colonne: **Nome** (italiano, la forma che avrà nel dataset — verificata
o proposta), **Origine** (set TCG), **Tipo**, **Difficoltà** stimata
(1=banale, 5=complessa), **Stato**, **id** (assegnato quando aggiunta),
**Note**.

## Livello 1 — banali (dati puri o riuso diretto di un pattern esistente)

| Nome (IT) | Nome (EN) | Origine | Tipo | Stato | id | Note |
|---|---|---|---|---|---|---|
| Terraformazione | Terraforming | LOD | Magia Normale | ✅ fatta | 871 | Cerca 1 Magia Campo dal Deck e mettila in mano — `ctx.searchDeckToHand`. Verificato: sposta davvero la carta trovata in mano. |
| Wingweaver | Wingweaver | PSV | Mostro Normale | ✅ fatta | 872 | LUCE/Lv7/Fata/2750/2400, vanilla — nessun effetto da programmare. Nome tenuto invariato (non tradotto): nessuna conferma affidabile trovata di un nome italiano ufficiale diverso, stesso trattamento già riservato ad altri nomi propri di questo dataset (Skull Servant, Thunder Dragon, ecc.). |
| Santa Giovanna | St. Joan | LON | Mostro Fusione | ✅ fatta | 903 | **Chiarito l'ambiguità che l'aveva rimandata**: interrogata direttamente l'API YGOPRODeck per "St. Joan" — i materiali ATTUALI (fonte di verità di questo dataset) sono confermati "The Forgiving Maiden" + "Darklord Marie". "Darklord Marie" è davvero il nome ATTUALE di una carta del 2003 (Labyrinth of Nightmare) originariamente chiamata "Marie the Fallen One" (stesso konami_id, confermato interrogando anche quel nome — l'API lo fa risolvere alla stessa carta), poi rinominata da Konami anni dopo integrandola nell'archetipo Darklord: usato qui nome/testo ATTUALI, non quelli storici, stessa convenzione già seguita per ogni altra carta di questo dataset. Aggiunte anche 901 (La Fanciulla Indulgente/The Forgiving Maiden — Ignition auto-tributo, torna in mano 1 mostro dal Cimitero, SEMPLIFICAZIONE: bersaglio auto-selezionato non necessariamente "distrutto in battaglia in questo turno") e 902 (Darklord Marie — +200 LP dal Cimitero, SEMPLIFICAZIONE: riusa canActivateFromGraveyardMainPhase, l'unico aggancio "dal Cimitero" esistente in questo motore, quindi scatta alla propria Main Phase 1 invece che alla Standby Phase). Santa Giovanna stessa è vanilla (nessun effetto proprio oltre le statistiche), `fusionMaterials: [901, 902]`. Verificato con 4 scenari attraverso il motore reale: tributo di Fanciulla Indulgente confermato, LP guadagnati da Darklord Marie confermati, `getFusableExtraDeckMonsters` trova correttamente l'opzione, `ACTIONS.fusionSummon` la evoca per davvero sul Terreno. |
| Duo Delinquente | Delinquent Duo | SRL | Magia Normale | ✅ fatta | 873 | Paga 1000 LP; l'avversario scarta 1 carta a caso, poi (se ne ha ancora) 1 a sua scelta. SEMPLIFICAZIONE (vedi missingEffectNote in cards.json): anche la seconda è a caso. Verificato: LP -1000, mano avversaria svuotata. |
| Libro della Luna | Book of Moon | PSV | Magia Rapida | ✅ fatta | 875 | Bersaglia 1 mostro scoperto sul Terreno, lo gira in Difesa coperta — bersaglio auto-selezionato (il più forte in Attacco), stesso stile di Cambio di Cuore (id 147). Verificato: mostro bersaglio girato in Difesa coperta. |
| Desideri Solenni | Solemn Wishes | LON | Trappola Continua | ✅ fatta | 876 | +500 LP ogni volta che il controllore pesca — nuovo trigger condiviso `DuelEngine.TRIGGER.ON_DRAW_CARDS`, agganciato in `drawCardsToHand` (game-flow.js), riusabile da qualunque futura carta reattiva alla pesca. Verificato con test mirato: attivazione diretta da mano correttamente rifiutata (è una Trappola), attivazione da Set riuscita, +500 LP confermati dopo una pescata reale. |

## Livello 2 — facili (nuovo hook semplice, stesso spirito di un pattern già esistente)

| Nome (IT) | Nome (EN) | Origine | Tipo | Stato | id | Note |
|---|---|---|---|---|---|---|
| Uniti Vinceremo | United We Stand | LON | Magia Equipaggiamento | ✅ fatta | 877 | +800 ATK/DEF per ogni mostro scoperto controllato dal controllore — stesso schema di Ciondolo Nero (id 117)/Falce del Mietitore (id 411, per il bonus scalabile). Verificato: +1600 ATK/DEF con 2 mostri scoperti propri. |
| Messaggero della Pace | Messenger of Peace | SRL | Magia Continua | ✅ fatta | 880 | I mostri con 1500+ ATK non possono attaccare; in Standby il controllore sceglie se pagare 100 LP o distruggerla. L'IA sceglie automaticamente in base ai LP disponibili. |
| Confisca | Confiscation | SRL | Magia Normale | ✅ fatta | 874 | Paga 1000 LP, guarda la mano avversaria e sceglie una carta da far scartare; la scelta umana usa il selettore, l'IA valuta l'impatto. |
| Nobile dello Sterminio | Nobleman of Extermination | PGD | Magia Normale | ✅ fatta | 881 | Distruggi+bandisci 1 Magia/Trappola coperta; se era una Trappola, bandisci anche tutte le copie dal Deck. Esteso `ACTIONS.destroySpellTrap` (duel-engine.js) con lo stesso redirect-al-bando già usato per i mostri (`card.mustBanishOnLeavingField`) — prima valeva solo per le distruzioni di mostri. Verificato: carta Set bandita, copia nel Deck bandita anch'essa. |
| Oppressione Reale | Royal Oppression | LOD | Trappola Continua | 🔧 parziale | 882 | Per le Special Summon non generate dalla risoluzione di un effetto, la finestra precede i trigger d'Evocazione; pagando 800 LP annulla il tentativo e manda il mostro al Cimitero. Una Oppressione scoperta resta riutilizzabile ed è utilizzabile da entrambi i giocatori. Le Special Summon prodotte da effetti non sono offerte a questa finestra: il motore non ha ancora un checkpoint per rispondere all'attivazione dell'effetto prima che si risolva. Coprire quel caso richiede un intervento separato sulla Chain, non una negazione retroattiva del mostro già evocato. Regressione mirata in `oppressione-reale-per-entrambi.spec.js`. |
| Angelo Splendente | Shining Angel | SRL | Mostro Effetto | ✅ fatta | 878 | LUCE/Lv4/Fata/1400/800 — se distrutto (onDestroy, nessuna distinzione "in battaglia" vs "da effetto Carta", stesso schema di Ratto Gigante id 614), Evoca Specialmente 1 mostro LUCE con 1500 ATK o meno dal Deck. Verificato: carta corretta trovata/rimossa dal Deck e Special Summonata. |
| Il Pescatore Leggendario | The Legendary Fisherman | PSV | Mostro Effetto | ✅ fatta | 879 | ACQUA/Lv5/Guerriero/1850/1600 — immune a Magie e non bersagliabile in attacco finché "Umi" è in campo (attacco diretto resta possibile). Nuovo `gameState.cannotBeTargetedBySpellsUids` (duel-engine.js, gemello per-istanza di `def.cannotBeTargetedBySpells`), consultato dallo stesso checkpoint condiviso di targeting. Tematico: Mako Tsunami è già nel roster del torneo. Verificato: immunità assente senza Umi, presente con Umi in campo. |
| Don Zaloog | Don Zaloog | PGD | Mostro Effetto | ✅ fatta | 883 | OSCURITÀ/Lv4/Guerriero/1400/1500 — su danno da battaglia, il giocatore sceglie se far scartare 1 carta a caso dalla mano avversaria oppure mandare le prime 2 carte del suo Deck al Cimitero; l'IA usa una valutazione euristica. |

**Livello 2 completo** (Freed il Generale Senza Rivali escluso: riclassificato e completato più avanti, vedi Livello 4).

## Livello 3 — medie (nuovo meccanismo non banale, ma contenuto)

| Nome (IT) | Nome (EN) | Origine | Tipo | Stato | id | Note |
|---|---|---|---|---|---|---|
| Yata-Garasu | Yata-Garasu | LOD | Mostro Spirito | ✅ fatta | 884 | VENTO/Lv2/Demone/200/100 — torna in mano a fine turno (Spirito, stesso schema di Maharaghi id 755), se infligge danno da battaglia l'avversario salta la prossima Draw Phase (riusa `gameState.skipDrawFor[owner]`, nato per Avidità Sconsiderata id 653). Nuovo `def.cannotSpecialSummon` in `ACTIONS.specialSummon` (duel-engine.js) — simmetrico a `def.cannotNormalSummon` già esistente, riusabile da qualunque futura carta con lo stesso vincolo. Verificato: skip pesca, ritorno in mano, Special Summon correttamente rifiutata. |
| Necrovalley | Necrovalley | PGD | Magia Campo | ✅ fatta | 890 | +500 ATK/DEF ai Guardiani della Tomba e blocco del bando dal Cimitero. Gli spostamenti dal Cimitero verso mano, Deck o Terreno passano dai checkpoint `graveyardMoveNegated`, `searchGraveyardWithChoice` e `specialSummon(fromZone: 'graveyard')`; `guardrail-necrovalley.spec.js` sorveglia gli splice scritti a mano. Il testo TCG include anche la negazione dei cambi di Tipo/Attributo nel Cimitero: il database attuale non contiene effetti che li provochino, quindi quella clausola non ha ancora un caso giocabile da applicare. |
| Iniezione della Fata Giglio | Injection Fairy Lily | LOD | Mostro Effetto | ✅ fatta | 889 | TERRA/Lv3/Stregone/400/1500 — durante il calcolo dei danni, se combatte contro un mostro, può pagare 2000 LP per +3000 ATK solo per quel calcolo, una volta per battaglia. Il prompt umano resta una scelta; l'IA paga quando il bonus ribalta lo scontro. Il callback è eseguito una volta per ogni Damage Step e non mantiene più un blocco improprio fino alla fine della Battle Phase. |
| Cancello di Fusione | Fusion Gate | LON | Magia Campo | ✅ fatta | 887 | Durante la Main Phase, il giocatore di turno può Evocare per Fusione dall'Extra Deck bandendo i materiali indicati da mano o Terreno. Usa `fusionSummon` con `banishMaterials: true`; il primo piazzamento non dipende dalla presenza immediata dei materiali, che servono solo per la riattivazione. |
| Metamorfosi | Metamorphosis | PGD | Magia Normale | ✅ fatta | 886 | Tributa 1 mostro, Evoca Specialmente dall'Extra Deck 1 Mostro Fusione dello stesso Livello. SEMPLIFICAZIONE (vedi missingEffectNote): tributo auto-selezionato (il più debole con un corrispondente nell'Extra Deck). Usa lo slot appena liberato dal tributo, nessuna ricerca di slot vuoto separata. Verificato: tributo al Cimitero, Mostro Fusione corretto Special Summonato nello stesso slot. |
| Quiz Inverso | Reversal Quiz | PGD | Magia Normale | ✅ fatta | 885 | Manda mano e campo al Cimitero, dichiara il tipo di carta (Magia/Trappola/Mostro) in cima al proprio Deck: se indovina, scambia i propri LP con quelli dell'avversario. SEMPLIFICAZIONE (vedi missingEffectNote): dichiarazione automatica (il tipo più frequente nel proprio Deck rimasto). Verificato: mano/campo/Magie-Trappole/Magia Campo tutte mandate al Cimitero, LP scambiati correttamente quando la dichiarazione automatica indovina. |

## Livello 4 — complesse

| Nome (IT) | Nome (EN) | Origine | Tipo | Stato | id | Note |
|---|---|---|---|---|---|---|
| Freed il Generale Senza Rivali | Freed the Matchless General | LOD | Mostro Effetto | ✅ fatta | 888 | TERRA/Lv5/Guerriero/2300/1700 — nega gli effetti Magia che la bersagliano (`onCardEffectTargetDeclare`+`ctx.cancel()`, stesso schema di Gran Scudo Gardna id 115); in Draw Phase può cercare 1 Guerriero Lv4- dal Deck invece di pescare (hardcoded in `enterDrawPhaseInner`, game-flow.js — una sostituzione della pescata vive per forza lì, stesso schema di `skipDrawFor`/`pendingMaharaghiPeekFor`). SEMPLIFICAZIONI documentate: non distrugge sempre esplicitamente la Magia negata se Continua/Equip; la ricerca in Draw Phase è automatica. Verificato: negazione confermata contro Cambio di Cuore (id 147) del bot, sostituzione della pescata confermata con un vero Guerriero cercato dal Deck. |
| Necropaura Oscura | Dark Necrofear | LON | Mostro Effetto | ✅ fatta | 891 | OSCURITÀ/Lv8/Demone/2200/2800 — **testo attuale via API YGOPRODeck diverso da quello ipotizzato in sessione precedente**: non è più una Fusione (è un Mostro Effetto normale, nessun Extra Deck coinvolto — molto più semplice del previsto), Evocazione Speciale dalla MANO bandendo 3 mostri DEMONE (non "qualunque mostro") dal proprio Cimitero. Se distrutta nella propria Zona Mostro da una carta dell'avversario e mandata al Cimitero in quel turno: alla End Phase, si equipaggia a 1 mostro scoperto avversario e ne prende il controllo finché resta equipaggiata — un mostro che agisce da Equip è un caso più unico che raro in tutto il gioco. Riusa quasi tutto: canSpecialSummonFromHand/paySpecialSummonCost (stesso schema di Stregone del Caos id 740/Drago Megaroccia id 763), ctx.banishFromGraveyard (nuovo di questa sessione, vedi Necrovalley id 890), ctx.takeControl esistente (permanent:true), lo stesso pattern multi-hook onSTDestroyed/onBanished/onReturnedToHandSelf già usato da Abbandonato (id 416) per rilasciare il controllo quando la carta lascia la zona Magia/Trappola. L'UNICO pezzo genuinamente nuovo: una carta nel Cimitero non riceve mai i normali trigger di fase in questo motore (stesso vincolo già noto per Ultimo Turno id 341), quindi la condizione "End Phase dello stesso turno" va armata in onDestroy() (gameState.pendingNecrofearRevival, per uid) e controllata esplicitamente dentro enterEndPhase() (game-flow.js) — stesso identico principio già in uso per id 341, non un meccanismo nuovo inventato da zero. SEMPLIFICAZIONE (vedi missingEffectNote): bersaglio auto-selezionato (ATK più alto); se è il mostro EQUIPAGGIATO a lasciare il campo per conto proprio (es. distrutto in battaglia mentre sotto controllo), questa carta resta orfana e finisce nel Cimitero al controllo successivo, nessun effetto a cascata aggiuntivo (il testo attuale non ne specifica uno). Verificato con 3 scenari attraverso il motore reale: Special Summon con bando di 3 Demoni confermato; distruzione da effetto avversario arma il flag, la End Phase dello STESSO turno esegue equip+controllo (il mostro avversario passa davvero al campo del controllore, sparisce da quello originale); distruggere l'equip fa tornare il controllo al proprietario originale. Suite 36/36 verde. **Lezione per un futuro caso simile**: quando una nota di sessione precedente descrive una carta come "Fusione" o con un meccanismo complesso basandosi solo sulla memoria/wiki, ri-verificare SEMPRE il testo REALE via API prima di stimare la difficoltà — Konami ha aggiornato il testo di questa carta nel tempo, e la versione attuale è sensibilmente più semplice (niente Extra Deck) di quella ipotizzata. |

## Livello 5 — archetipo Gravekeeper's (propedeutico: Necrovalley sopra)

A tema egizio, coerente con Marik/Ishizu già presenti nel gioco. Da
trattare come blocco unico dopo Necrovalley, non prima.

| Nome (IT) | Nome (EN) | Origine | Tipo | Stato | id | Note |
|---|---|---|---|---|---|---|
| Spia dei Guardiani della Tomba | Gravekeeper's Spy | PGD | Mostro Flip | ✅ fatta | 897 | FLIP: Evoca Specialmente 1 Guardiani della Tomba con 1500 ATK o meno dal Deck — stesso schema di ricerca dal Deck già usato da Angelo Splendente (id 878), su onFlip. Verificato: mostro corretto Special Summonato dal Deck. |
| Guardia dei Guardiani della Tomba | Gravekeeper's Guard | PGD | Mostro Flip | ✅ fatta | 898 | FLIP: 1 mostro avversario torna in mano (bersaglio auto-selezionato, ATK più alto) — ctx.returnMonsterToHand già esistente. Verificato: mostro avversario da 2000 ATK tornato in mano. |
| Capo dei Guardiani della Tomba | Gravekeeper's Chief | PGD | Mostro Effetto | ✅ fatta | 899 | "Il tuo Cimitero non è influenzato da Necrovalley" — nuova `isNecrovalleyProtectingGraveyard(owner)` (duel-engine.js), generalizzazione per-owner di ACTIONS.banishFromGraveyard: controlla se `owner` ha questa carta scoperta in campo prima di applicare il blocco. "Quando Evocata Tributo: Special Summon 1 Guardiani della Tomba dal Cimitero" — onSummon con `ctx.summonedVia==='normal'` (per un Livello 5 un'Evocazione Normale è SEMPRE un'Evocazione Tributo in questo motore, nessuna ambiguità). SEMPLIFICAZIONE: "solo 1 copia scoperta" non applicata (nessun controllo di unicità generico esiste); bersaglio da rianimare auto-selezionato. Verificato: revival dal Cimitero riuscito, banishFromGraveyard riesce per il proprietario di Chief anche con Necrovalley scoperta (mentre resterebbe bloccato per l'avversario). |
| Maledizione dei Guardiani della Tomba | Gravekeeper's Curse | PGD | Mostro Effetto | ✅ fatta | 892 | "Se Evocata: infliggi 500 danni" — onSummon(ctx), nessuna restrizione sul metodo di Evocazione. La più semplice delle 9. Verificato: 500 danni confermati. |
| Assalitore dei Guardiani della Tomba | Gravekeeper's Assailant | PGD | Mostro Effetto | ✅ fatta | 895 | "Quando dichiara un attacco, mentre Necrovalley è sul Terreno: cambia la Posizione di Battaglia di 1 mostro scoperto avversario" — `onOwnAttackDeclare(ctx)`, l'auto-effetto dell'ATTACCANTE su ON_ATTACK_DECLARE. **Scoperta importante**: questo hook esisteva GIÀ da prima di questa sessione (es. Jirai Gumo id 316) — la tabella Livello 4/Note precedente su Spirit Ryu (id 630, ancora aperta) affermava che "oggi esiste solo la risposta del difensore": falso, andrebbe riverificato. Verificato con un test pulito (nome della carta cambiato per isolare l'effetto dal proprio bonus di Necrovalley, che altrimenti confonde i numeri): posizione cambiata da Difesa ad Attacco PRIMA del calcolo danni, poi la battaglia si risolve di conseguenza (distrutto, danno corretto). |
| Artigliere dei Guardiani della Tomba | Gravekeeper's Cannonholder | PGD | Mostro Effetto | ✅ fatta | 896 | Ignition dalla zona Mostro: tributa 1 altro Guardiani della Tomba per infliggere 700 danni — "una volta a turno" già garantito automaticamente da `gameState.usedIgnitionThisTurn` per OGNI Ignition di questo motore. Tributo scritto a mano (field=null + graveyard.push + notifySacrificedForTribute), stesso schema di Metamorfosi (id 886). Verificato: tributo confermato, 700 danni inflitti. |
| Lanciere dei Guardiani della Tomba | Gravekeeper's Spear Soldier | PGD | Mostro Effetto | ✅ fatta | 894 | "Se attacca un mostro in Difesa: danno perforante" — `def.piercing: true`, stesso flag fisso già usato da Parshath il Cavaliere Alato (id 82). Zero codice nuovo. Verificato: 1000 danni perforanti (1500 ATK - 500 DEF) confermati. |
| Vassallo dei Guardiani della Tomba | Gravekeeper's Vassal | PGD | Mostro Effetto | ✅ fatta | 893 | "Il danno da battaglia inflitto da questa carta è trattato come danno da effetto" — nuovo flag `def.treatBattleDamageAsEffect`, consultato in `fireOwnBattleDamageDealt` (actions.js) per saltare le reazioni specifiche al danno da BATTAGLIA (es. Goblin Ladro id 610) quando è questa carta a infliggerlo. Verificato: un vero Goblin Ladro scoperto sul Terreno NON scarta la mano avversaria quando Vassallo infligge danno diretto (mano invariata), mentre i Life Points scendono regolarmente. |
| Sentinella dei Guardiani della Tomba | Gravekeeper's Watcher | PGD | Mostro Effetto | ⏳ SEMPLIFICAZIONE non implementata | 900 | Registrata con dati/statistiche reali ma nessun codice per l'abilità (`CardEffects.register(900, {})`, vanilla di fatto). Richiederebbe una vera finestra di risposta attivabile da una carta ancora in MANO (mai da campo — nessun'altra carta di questo motore ha una finestra del genere: findMonsterQuickEffectCandidates/findSpellTrapQuickEffectCandidates coprono solo carte già scoperte in campo), apribile in QUALUNQUE momento del turno di uno dei due giocatori (non solo quando una Chain è già aperta, a differenza della Categoria B esistente), PIÙ una capacità di riconoscere in anticipo se un'attivazione "potrebbe far scartare" l'avversario — sproporzionato per una carta sola, stesso principio già accettato per Categoria B (id 192/396/459), ma un requisito ancora più ampio (quelle rispondono comunque solo a Chain già aperta). |

## Legenda stato
- ⏳ da fare
- 🔧 in corso
- ✅ fatta (dati + effetto implementato + verificata) — include quelle con una SEMPLIFICAZIONE onestamente documentata via missingEffectNote in cards.json, segnalata nella colonna Note
- ⏳ rimandata (bloccata da una dipendenza non ancora chiarita, vedi Note)

## Bug scoperti mentre si lavorava a questo backlog (fuori scope, da riprendere a parte)
- **Decreto Reale (id 426, Royal Decree)**: manca un vero `activate()` nella propria registrazione in `card-effects.js` — ha solo `static()`. Per come è scritto `DuelEngine.canActivate` (duel-engine.js, riga ~3714: `if (!def || typeof def.activate !== 'function') return false;`), QUALUNQUE carta senza un proprio `activate()` non risulta MAI legalmente attivabile, Trappola Continua o no. Risultato pratico: Decreto Reale, una volta Settato, non può mai essere girato scoperto per davvero tramite il normale flusso di gioco — resta bloccato coperto per sempre. Fix banale (aggiungere un `activate(ctx) { ctx.log(...); }` minimo, stesso pattern REALMENTE funzionante di Legame di Gravità id 707), ma volutamente non toccato in questa sessione per restare a fuoco sul backlog di carte nuove. Scoperto verificando Desideri Solenni (id 876, Livello 1), che inizialmente avevo registrato copiando lo stesso pattern incompleto di id 426.

## Log di sessione
- Sessione 1: creato questo file, ricognizione completa (823 carte
  esistenti confrontate con LOB/MRD/SRL/PSV/LON/LOD/PGD), testo/stat
  esatti di ogni carta verificati via API YGOPRODeck. Chiuso l'intero
  Livello 1 (Terraformazione id 871, Wingweaver id 872, Duo Delinquente
  id 873, Libro della Luna id 875, Desideri Solenni id 876) più Confisca
  id 874 dal Livello 2 — 6 carte, dati + effetto + verifica tramite il
  motore reale (DuelEngine.activateCard, non solo gli handler isolati),
  suite 36/36 verde dopo ogni passo. St. Joan rimandata (materiali di
  Fusione non ancora presenti/da chiarire). Nuovo trigger condiviso
  DuelEngine.TRIGGER.ON_DRAW_CARDS (duel-engine.js + game-flow.js),
  riusabile da qualunque futura carta reattiva alla propria pesca — non
  esisteva nulla di simile prima. Scoperto (ma non corretto, fuori
  scope) un bug preesistente su Decreto Reale (id 426), vedi sopra.
  Prossimo passo: Livello 2 rimanente (Uniti Vinceremo, Messaggero della
  Pace, Freed il Generale Senza Rivali, Nobile dello Sterminio,
  Oppressione Reale, Angelo Splendente, Il Pescatore Leggendario, Don
  Zaloog).
- Sessione 1 (continua): chiuse altre 3 carte del Livello 2 — Uniti
  Vinceremo (877), Angelo Splendente (878), Il Pescatore Leggendario
  (879) — stesso standard delle prime 6 (dati + effetto + verifica
  tramite il motore reale). Nuovo `gameState.cannotBeTargetedBySpellsUids`
  (duel-engine.js), gemello per-istanza di `def.cannotBeTargetedBySpells`
  già esistente, aggiunto allo stesso checkpoint condiviso di targeting
  (declareCardEffectTarget) — riusabile da qualunque futura carta con
  un'immunità alle Magie CONDIZIONATA (non fissa per definizione).
  Rivalutata la difficoltà di Freed il Generale Senza Rivali (2→3):
  "nega e distrugge" una Magia che la bersaglia è un vero meccanismo
  reattivo, non una semplice immunità silenziosa come i flag esistenti.
  Suite 36/36 verde. Restano da fare nel Livello 2: Messaggero della
  Pace, Nobile dello Sterminio, Oppressione Reale, Don Zaloog (più Freed,
  ora Livello 3).
- Sessione 1 (continua): **Livello 2 completo** — chiuse le ultime 4
  carte: Messaggero della Pace (880), Nobile dello Sterminio (881),
  Oppressione Reale (882), Don Zaloog (883). Esteso `ACTIONS.destroySpellTrap`
  (duel-engine.js) con lo stesso redirect-al-bando (`card.mustBanishOnLeavingField`
  + `redirectToBanishIfFlagged`) già usato per i mostri, prima mai
  applicato a una Magia/Trappola — messaggio di log del redirect reso
  generico (non più legato solo a Cerchio degli Inferi, il primo caso
  d'uso) proprio per questo secondo utilizzo. Oppressione Reale
  implementata come Trappola Normale a singolo uso (semplificazione
  documentata) riusando lo stesso schema reattivo di Giudizio Solenne
  (id 448), filtrato con `ctx.summonedVia === 'special'` (lo stesso
  discriminatore normale/speciale già usato da Buco Trappola id 40).
  Suite 36/36 verde, verificato ogni effetto tramite il motore reale.
  **13 carte totali completate finora in questa sessione** (id 871-883,
  Livello 1 e Livello 2 entrambi interamente chiusi). Prossimo passo:
  Livello 3 (Yata-Garasu, Necrovalle, Iniezione della Fata Giglio,
  Cancello di Fusione, Metamorfosi, Quiz Inverso, Freed il Generale
  Senza Rivali).
- Sessione 1 (continua): chiusa Yata-Garasu (884), la prima carta del
  Livello 3 — 14 carte totali. Nuovo `def.cannotSpecialSummon` in
  `ACTIONS.specialSummon` (duel-engine.js), simmetrico a
  `def.cannotNormalSummon` già esistente per il caso opposto. Riusati
  due meccanismi già pronti invece di inventarne di nuovi: lo schema
  "Mostro Spirito" (torna in mano a fine turno) già rodato da Maharaghi
  (id 755), e `gameState.skipDrawFor[owner]` (un CONTATORE, non un
  booleano — nato per Avidità Sconsiderata id 653) per il "salta la
  prossima Draw Phase". Verificato con test mirato: skip pesca
  confermato, ritorno in mano confermato, Special Summon correttamente
  rifiutata (torna false, carta al Cimitero). Suite 36/36 verde.
  Rivalutata Necrovalle da "media" a "medio-alta" durante la
  ricognizione: la protezione del Cimitero dal bando richiederebbe un
  audit dei punti del motore paragonabile a quello già fatto per Uovo
  Giurassico Miracoloso (id 808) — non un lavoro da fare di corsa,
  rimandata a una battuta dedicata. Prossimo passo: valutare Iniezione
  della Fata Giglio (finestra di battaglia) o Freed il Generale Senza
  Rivali (negazione reattiva) come prossime carte del Livello 3, oppure
  affrontare Necrovalle per bene con lo stesso rigore di id 808.
- Sessione 1 (continua): chiuse altre 3 carte del Livello 3 — Quiz
  Inverso (885), Metamorfosi (886), Cancello di Fusione (887) — **17
  carte totali completate finora**. Scoperto e corretto un bug REALE
  durante l'implementazione di Cancello di Fusione: il `canActivate`
  iniziale bloccava anche il primo piazzamento della Magia Campo se non
  c'erano già materiali di Fusione disponibili in quel momento — un
  campo/Magia Campo deve invece potersi sempre piazzare, il controllo
  sui materiali vale solo per la riattivazione ripetuta successiva
  (stesso principio già presente in Offerta Suprema id 559, distinto
  qui per `ctx.zone`). Riusati quasi interamente meccanismi già
  esistenti per Metamorfosi/Cancello di Fusione (Extra Deck, Fusione
  per materiali dichiarati) invece di inventare nuova infrastruttura.
  Iniezione della Fata Giglio rivalutata: richiede un hook NUOVO
  ("modifica l'ATK solo per il calcolo del danno", nulla di simile
  esiste oggi tranne `zeroAttackerAtk()` per il caso opposto) — non
  affrontata in questa battuta. Suite 36/36 verde dopo ogni carta.
  Restano nel Livello 3: Iniezione della Fata Giglio, Freed il Generale
  Senza Rivali (poi Livello 4: Necrovalle, Dark Necrofear; Livello 5:
  Gravekeeper's).
- Sessione 1 (continua): chiusa Freed il Generale Senza Rivali (888) —
  **18 carte totali completate finora**, riclassificata e spostata al
  Livello 4 (era stata segnata "media" nel Livello 2, ma si è rivelata
  più vicina a "complessa" una volta implementata per intero). Entrambe
  le abilità reali coperte: negazione reattiva delle Magie che la
  bersagliano (`onCardEffectTargetDeclare`+`ctx.cancel()`, stesso schema
  di Gran Scudo Gardna id 115 — molto più semplice del previsto, una
  volta trovato il precedente giusto) e sostituzione della pescata con
  una ricerca in Draw Phase (hardcoded in `enterDrawPhaseInner`,
  game-flow.js, stesso schema di `skipDrawFor`/`pendingMaharaghiPeekFor`
  già esistenti per lo stesso motivo strutturale). Verificato con test
  mirati: negazione confermata contro un vero Cambio di Cuore (id 147)
  attivato dal bot, sostituzione della pescata confermata con un
  Guerriero vero cercato dal Deck. Suite 36/36 verde (rilevante: questa
  carta tocca `enterDrawPhaseInner`, chiamata da OGNI singolo turno di
  OGNI duello — nessuna regressione).
  **Livello 3 quasi completo, resta solo Iniezione della Fata Giglio**
  (richiede un nuovo hook "modifica l'ATK solo per il calcolo del
  danno" — genuinamente non presente nel motore oggi). Prossimo passo:
  o Iniezione della Fata Giglio con quel nuovo hook, o saltare al
  Livello 4 (Necrovalle, Dark Necrofear).
- Sessione 1 (continua): chiusa Iniezione della Fata Giglio (889) —
  **Livello 3 COMPLETO**, 19 carte totali finora. La stima precedente
  ("serve un hook nuovo da zero") si è rivelata troppo pessimista: il
  hook `damageStepBonus` esisteva già (Soldati Insetto del Cielo id
  311/Soldato Cinetico id 326) e copriva già "modifica l'ATK solo per
  il calcolo del danno" — mancava solo un modo per sapere DI CHI sono i
  LP da scalare quando l'effetto deve anche pagare un costo (non solo
  calcolare un bonus puro come le carte precedenti). Risolto con
  un'estensione minima e riusabile del ctx condiviso (nuovo campo
  `owner`, calcolato una volta in `getDamageStepBonus`), non con
  infrastruttura nuova dedicata a questa carta sola. **Lezione per un
  futuro caso simile**: quando una stima di sessione precedente dice
  "serve un hook nuovo", vale la pena riverificare con più calma prima
  di crederci — a volte l'hook giusto esiste già e serve solo un
  piccolo arricchimento del suo ctx, non una reinvenzione. Verificato
  con 2 scenari reali attraverso `resolveAttack` (non solo l'hook
  isolato): pagamento corretto quando conviene, nessun pagamento
  sprecato quando il bonus non basterebbe comunque. Suite 36/36 verde.
  Anche le 19 carte fatte finora hanno ora una vera illustrazione (non
  solo il fallback CSS generico) — mancavano i file immagine in
  `images/cards/`, scaricati dal ritaglio ufficiale (`image_url_cropped`)
  dell'API YGOPRODeck, stessa fonte/stesso formato già usato per ogni
  altra carta del dataset. **Prossimo passo: Livello 4 (Necrovalle,
  Dark Necrofear).**
- Sessione 1 (continua): chiusa Necrovalley (890) — **20 carte totali
  completate finora**, Livello 4 a metà (resta Dark Necrofear). La stima
  precedente ("~11 punti come id 808") si è rivelata quasi doppia nella
  pratica (~25 punti reali tra card-effects.js e duel-engine.js) — ma
  invece di controllare la carta in ognuno singolarmente, creato un
  nuovo choke-point condiviso `ACTIONS.banishFromGraveyard(owner, card)`
  (stesso principio di `destroyTargetedMonster`: combina rimozione dal
  Cimitero + banish in una chiamata sola, controllando Necrovalley al
  proprio interno) e MIGRATI tutti i punti esistenti che banivano dal
  Cimitero con uno splice scritto a mano. **Due insidie reali trovate
  durante la migrazione, entrambe corrette**: (1) un `while(...&&
  grave.length>0)` per bandire "fino a N carte" può andare in loop
  INFINITO se il bando è bloccato e non rimuove mai nulla dall'array —
  serviva un flag di uscita esplicito, non solo il controllo del
  singolo bando; (2) diversi effetti "banisci come costo, POI fai
  l'effetto vero" non controllavano l'esito del bando prima di
  proseguire, rischiando di risolvere l'effetto principale anche a
  costo non pagato. **Lezione per un futuro caso simile**: quando si
  centralizza un pattern ripetuto in un nuovo choke-point condiviso,
  non basta sostituire la chiamata — bisogna anche verificare COSA
  faceva il chiamante SE quella chiamata falliva prima (spesso: niente,
  perché prima non poteva mai fallire), e aggiungere quel controllo
  ovunque manchi. Verificato con 4 scenari attraverso il motore reale
  (bando normale, bando bloccato, bonus Guardiani della Tomba, nessun
  loop infinito). Suite 36/36 verde nonostante la portata della
  migrazione. **Prossimo passo: Dark Necrofear (Livello 4), poi
  l'archetipo Gravekeeper's (Livello 5, ora sbloccato da Necrovalley).**
- Sessione 1 (continua): chiusa Necropaura Oscura (891) — **Livello 4
  COMPLETO, 21 carte totali finora**. Scoperta importante: il testo
  reale via API (fonte di verità di questo progetto) è cambiato nel
  tempo rispetto a quanto ipotizzato — non è più una Fusione (Mostro
  Effetto normale, niente Extra Deck), molto più semplice del previsto.
  Riusato quasi tutto (canSpecialSummonFromHand/paySpecialSummonCost,
  ctx.banishFromGraveyard appena creato per Necrovalley, ctx.takeControl
  già esistente, lo stesso pattern multi-hook di rilascio di Abbandonato
  id 416): l'unico pezzo genuinamente nuovo è il timing "End Phase dello
  STESSO turno in cui è stata distrutta da una carta avversaria" — una
  carta nel Cimitero non riceve mai i normali trigger di fase in questo
  motore (stesso vincolo già noto per Ultimo Turno id 341), risolto
  armando un flag in onDestroy() e controllandolo esplicitamente dentro
  enterEndPhase() (game-flow.js), stesso identico principio già in uso
  per id 341. Verificato con 3 scenari attraverso il motore reale
  (Special Summon, equip+controllo alla End Phase corretta, rilascio del
  controllo quando l'equip viene distrutta). Suite 36/36 verde.
  **Lezione per un futuro caso simile**: una stima di sessione precedente
  basata su ricordo/wiki va sempre ri-verificata contro il testo REALE
  via API prima di preventivare la difficoltà — Konami aggiorna il testo
  delle carte nel tempo, e la versione più recente può essere
  sensibilmente più semplice di quella "storica" ricordata a memoria.
  **Prossimo passo: l'archetipo Gravekeeper's (Livello 5, 9 carte, ora
  sbloccato da Necrovalley id 890).**
- Sessione 1 (continua): **BACKLOG COMPLETO** — chiuse le 9 carte
  dell'archetipo Guardiani della Tomba (892-900), **30 carte totali
  aggiunte in questa sessione**. 8 su 9 implementate per intero
  riusando quasi esclusivamente meccanismi già esistenti (def.piercing
  per Lanciere id 894, onFlip per Spia/Guardia id 897/898, Ignition da
  zona Mostro con tributo scritto a mano per Artigliere id 896, onSummon
  per Maledizione/Capo id 892/899); solo 2 pezzi genuinamente nuovi:
  `def.treatBattleDamageAsEffect` (nuovo flag, Vassallo id 893, consultato
  in fireOwnBattleDamageDealt per sopprimere le reazioni "sai che era
  danno da battaglia" di altre carte come Goblin Ladro id 610) e
  `isNecrovalleyProtectingGraveyard(owner)` (nuova funzione, Capo id 899,
  generalizzazione per-owner di isNecrovalleyOnField/banishFromGraveyard
  per "il tuo Cimitero non è influenzato da Necrovalley"). **Scoperta
  degna di nota durante Assalitore (id 895)**: l'hook `onOwnAttackDeclare(ctx)`
  (l'auto-effetto dell'ATTACCANTE su una propria dichiarazione d'attacco)
  esiste GIÀ nel motore da prima di questa sessione (es. Jirai Gumo id
  316) — la voce Spirit Ryu (id 630, Categoria A, ancora aperta più
  sotto in questo file) descrive proprio questo come "hook mancante,
  oggi esiste solo la risposta del difensore": affermazione OBSOLETA,
  andrebbe riverificata in una futura sessione prima di continuare a
  trattare id 630 come bloccata per questo motivo. **Sola eccezione**:
  Sentinella (id 900) registrata con dati/statistiche reali ma senza
  codice per l'abilità — richiederebbe una finestra di risposta da MANO
  apribile in qualunque momento del turno di uno dei due giocatori
  (nessun'altra carta di questo motore ne ha una: le uniche finestre da
  campo esistenti rispondono solo a una Chain già aperta), sproporzionato
  per una carta sola, stesso principio già accettato per la Categoria B
  esistente ma un requisito ancora più ampio. Verificato con 9 scenari
  attraverso il motore reale (uno per carta, incluso un test di
  isolamento per Assalitore per separare il suo effetto dal proprio
  bonus di Necrovalley, che altrimenti confondeva i numeri attesi).
  Suite 36/36 verde. **Il backlog "prima serie" di questa sessione è
  ora chiuso**: resta solo Santa Giovanna (rimandata, materiali di
  Fusione da chiarire) e Spirit Ryu (id 630, Categoria A storica, ora
  con un indizio concreto che potrebbe essere meno bloccata del
  previsto).
- Sessione 1 (continua): **chiusa anche Spirit Ryu (id 630)** — l'unica
  Categoria A storica di questo file, verificando subito l'indizio
  trovato implementando Assalitore dei Guardiani della Tomba qui sopra.
  `onOwnAttackDeclare(ctx)` esisteva davvero già (Jirai Gumo id 316):
  bastava usarlo per far scattare lo scarto del mostro Drago nel preciso
  istante in cui QUESTA carta dichiara un attacco, invece del vecchio
  Ignition attivabile a piacere durante la propria Battle Phase. Per la
  durata "fino a fine Battle Phase" (non fine turno): flag per-istanza
  `_spiritRyuBoosted` + static(), azzerato in onBattlePhaseEnd — stesso
  identico schema di `usedInjectionThisBattle` (Iniezione della Fata
  Giglio id 889, chiusa in questa stessa sessione). **Bug reale trovato
  e corretto durante l'implementazione**: il ctx passato a
  `onOwnAttackDeclare` è il declareCtx costruito da `resolveAttack`
  (actions.js) per l'INTERO trigger ON_ATTACK_DECLARE — non ha un
  proprio `ctx.card` (quel campo è riservato al DIFENSORE che risponde,
  es. Suijin/Kazejin), solo `attackerOwner`/`attackerIndex`: un primo
  tentativo che leggeva `ctx.card` falliva SILENZIOSAMENTE (catturato da
  `safeCallCardHandler`, nessun errore in console) — bastava leggere la
  carta vera da `ctx.field(ctx.attackerOwner)[ctx.attackerIndex].card`.
  Verificato con un test attraverso il motore reale (non solo l'hook
  isolato): Spirit Ryu (1000 ATK) attacca un 1500 ATK, scarta un Drago
  dalla mano, sopravvive con 2000 ATK e distrugge l'avversario; dopo la
  End Phase l'ATK torna a 1000 (bonus scaduto a fine Battle Phase, non a
  fine turno). Suite 36/36 verde. **Lezione per una futura sessione**:
  una nota "Categoria A, serve infrastruttura nuova" può diventare
  obsoleta con l'aggiunta di infrastruttura per una carta diversa più
  avanti nella stessa (o in una futura) sessione — vale la pena
  ririverificare periodicamente le carte "genuinamente bloccate" invece
  di darle per scontate per sempre.
- Sessione 1 (continua): **sbloccata e chiusa anche Santa Giovanna** —
  l'ultima voce rimasta "rimandata" del backlog. L'ambiguità che
  l'aveva bloccata ("Darklord Marie" è il nome storico o attuale?) si è
  risolta interrogando direttamente l'API invece di ragionarci a
  memoria: confermato che è davvero lo stesso konami_id di "Marie the
  Fallen One" (2003, Labyrinth of Nightmare), poi rinominata da Konami
  anni dopo nell'archetipo Darklord — usato qui nome/testo ATTUALI,
  stessa convenzione di ogni altra carta di questo dataset. Aggiunte
  901 (La Fanciulla Indulgente) e 902 (Darklord Marie) come materiali,
  903 (Santa Giovanna) come Fusione vanilla. **Il backlog "prima serie"
  di questa sessione è ORA VERAMENTE COMPLETO**: 33 carte nuove
  aggiunte (871-903) più la correzione di Spirit Ryu (id 630) —
  nessuna voce rimasta "da fare" o "rimandata" in questo file, a parte
  le SEMPLIFICAZIONI onestamente documentate (Categoria B esistente +
  Sentinella dei Guardiani della Tomba id 900) che restano scelte
  deliberate, non lavoro dimenticato.
- Sessione 2: aggiunti i 97 mostri vanilla rimanenti dei 7 set (id
  904-1000) — nome/statistiche/immagine reali, nessun effetto da
  programmare per definizione. Non documentati carta per carta in
  questo file (nessuna decisione di design coinvolta, solo dati puri),
  ma l'intervallo di id è ora riservato e chiuso.

## Seconda ondata: le carte NON vanilla rimanenti (effetto/Flip/Fusione/Rituale/Spirito)

Dopo il completamento dei 97 vanilla (id 904-1000), una ricognizione
precedente aveva stimato "133 carte con effetto ancora mancanti" (89
Effetto, 18 Flip, 16 Fusione, 7 Spirito, 3 Rituale) — quella stima **non
era mai stata salvata in un file** (viveva solo nella conversazione) ed
è andata persa a metà lavoro per un cambio di priorità di sessione.
**Lezione per il futuro: ogni ricognizione di questo tipo va salvata QUI
non appena calcolata, mai lasciata solo in conversazione.**

Rifatta da zero in modo riproducibile (script Node, non a memoria):
scaricati tutti i dati dei 7 set via API YGOPRODeck (`cardinfo.php?cardset=...`,
nomi esatti verificati con `cardsets.php` — attenzione, alcuni differiscono
dal nome comune: il set è "Legend of Blue **Eyes** White Dragon", senza
trattino, non "Blue-Eyes"), deduplicati per id, filtrati ai tipi
NON-Normal Monster (Effetto/Flip/Fusione/Rituale/Spirito/Union/Toon/
Gemini — nessuno di questi ultimi 3 esiste ancora in questi 7 set,
compaiono solo in espansioni successive), poi confrontati contro
`card-effects.js`+`cards.json`+questo stesso file+`cards-db.js` cercando
il nome INGLESE esatto (convenzione consolidata: ogni carta bespoke ha
un commento "id — NomeIT / NomeEN"). **Esito: 281 mostri non-vanilla
unici nei 7 set, 176 ancora mancanti** (120 Effetto, 27 Flip, 23
Fusione, 8 Spirito, 3 Rituale) — un conteggio più alto e più affidabile
dei precedenti 133, con l'elenco completo dei nomi stavolta salvato
(vedi tabella sotto).

**Insidie del metodo di confronto per nome, da ricordare se si rifà
questo conteggio in futuro**: (1) un apostrofo tipografico (’) nel
markdown vs uno dritto (') nel JSON dell'API fa fallire un confronto
ingenuo — normalizzare SEMPRE entrambi prima di confrontare; (2) alcune
carte già chiuse in sessioni precedenti hanno un commento che NON
include il nome inglese (es. Freed il Generale Senza Rivali, id 888) —
il confronto va quindi esteso a più file (card-effects.js, cards.json,
questo file, cards-db.js), non fidarsi di un solo file come fonte
esaustiva di "già fatto".

### Chiuse in questa ondata (19 carte, id 1001-1019)

- **8 Mostri Spirito di Legacy of Darkness** (id 1001-1008): stesso
  schema "non Special Summonabile, torna in mano a fine turno se Evocato
  Normalmente o girato scoperto" già rodato da Yata-Garasu (id 884)/
  Maharaghi (id 755). Sacerdote di Asura (1001, Asura Priest — solo lo
  schema base, SEMPLIFICAZIONE per "può attaccare tutti i mostri
  dell'avversario" — un vero attacco multiplo su più bersagli
  simultanei, mai richiesto da nessun'altra carta di questo motore),
  Fushi No Tori (1002 — guadagna LP pari al danno da battaglia
  inflitto: nuovo campo `ctx.damage` aggiunto a `onDealsBattleDamage`,
  actions.js, additivo), Grande Naso Lungo (1003, Great Long Nose —
  l'avversario salta la PROSSIMA Battle Phase: nuovo
  `gameState.skipNextBattlePhaseFor`, booleano che sopravvive al cambio
  turno a differenza di `skipBattlePhaseFor` già esistente, consumato in
  `enterBattlePhase()` game-flow.js), Hino-Kagu-Tsuchi (1004 —
  l'avversario scarta l'intera mano alla prossima Draw Phase PRIMA di
  pescare: nuovo `gameState.discardHandBeforeDrawFor`, stesso principio,
  consumato in `enterDrawPhaseInner()`), Coniglio Bianco di Inaba (1005,
  Inaba White Rabbit — può attaccare direttamente, riusa
  `gameState.directAttackAllowedUids` già esistente), Otohime (1006 —
  quando Evocata/girata: cambia la Posizione di Battaglia di 1 mostro
  avversario, bersaglio auto-selezionato passando dal checkpoint
  condiviso `ctx.declareTarget`), Soldato di Susa (1007, Susa Soldier —
  il proprio danno da battaglia è dimezzato: nuovo
  `def.battleDamageMultiplier`, numero fisso per definizione, applicato
  in actions.js PRIMA di ognuno dei 3 punti che calcolano danno da
  battaglia — 1 se assente, nessun cambiamento per ogni altra carta),
  Drago Yamata (1008, Yamata Dragon — pesca finché non si hanno 5 carte
  in mano dopo aver inflitto danno da battaglia).
- **5 mostri "attacca direttamente" di Metal Raiders** (id 1009-1013:
  Jinzo #7, Lampada Mistica/Mystic Lamp, Ooguchi, Sosia della
  Regina/Queen's Double, Fiore Arcobaleno/Rainbow Flower) — stesso
  `gameState.directAttackAllowedUids` incondizionato già usato da
  Folletto della Fiamma Furente (id 681), zero codice nuovo.
  Coincidenza notata: questo stesso permesso serviva anche a Coniglio
  Bianco di Inaba (1005) qui sopra, quindi 6 carte totali sbloccate
  dalla stessa riga di infrastruttura già pronta.
- **3 coppie Mostro Rituale + Magia Rituale di Spell Ruler** (id
  1014-1019: Hamburger Famelico/Hungry Burger + Ricetta
  dell'Hamburger/Hamburger Recipe, Tartaruga Granchio/Crab Turtle +
  Giuramento della Tartaruga/Turtle Oath, Spettacolo della
  Spada/Performance of Sword + Danza d'Apertura/Commencement Dance) —
  **scoperta importante**: l'Evocazione Rituale NON era affatto
  un'infrastruttura mancante come inizialmente temuto, esiste già da
  tempo (`performRitualTribute`/`maxRitualTributeLevel`, card-effects.js,
  nata per Rito del Guerriero Nero id 56, riusata già da altre 5 carte
  precedenti a questa sessione) — bastava applicare lo stesso schema
  esatto altre 3 volte, zero codice nuovo nel motore.

Verificato con un vero test di regressione attraverso il motore reale
(`tests/specs/lod-mrd-srl-spirit-ritual-cards.spec.js`, non solo gli
hook isolati): battaglie vere via `resolveAttack` per il danno dimezzato/
guadagno LP/skip Battle Phase/scarto pre-pesca, `enterBattlePhase()`/
`enterDrawPhaseInner()` veri per consumare i due nuovi flag "prossimo
turno", `onSummon` vero per Otohime, `canActivate`/`activate` veri per
la Magia Rituale. Suite 37/37 verde (36 preesistenti + 1 nuovo).

### Chiuse: terza ondata, 11 Mostri Flip (id 1020-1030) — vedi il log di sessione più sotto per il dettaglio.

### Verifica di consistenza (richiesta implicita da un audit di sessione): trovato 1 duplicato e 26 falsi negativi

Prima di continuare con la quarta ondata, un controllo mirato ha
rivelato che il confronto "cerca il nome inglese come sottostringa"
usato per calcolare la tabella precedente (160 righe) aveva due difetti
reali, non solo teorici:

1. **Falso positivo (duplicato creato per errore)**: "4-Starred Ladybug
   of Doom" risultava mancante e per questo è stata implementata come
   id 1021 nella terza ondata — ma esisteva GIÀ dal dataset originale
   come id 77 (Coccinella della Rovina a 4 Stelle), effetto identico. Il
   commento di card-effects.js per id 77 non contiene il nome inglese,
   quindi il confronto per sottostringa non l'aveva trovata. **id 1021
   è stata eliminata** (cards.json, card-effects.js, immagine) non
   appena scoperta — coerente con la convenzione del progetto "le carte
   duplicate si cancellano, non si segnalano soltanto".
2. **Falsi negativi (26 carte già implementate, mai riconosciute come
   tali)**: stesso problema all'inverso — carte del dataset ORIGINALE
   (id < 901, quindi precedenti a questa intera sessione) il cui
   commento in card-effects.js non riporta il nome inglese. Esempio
   tipico: "Mietitore delle Carte" (id 410) è in realtà "Reaper of the
   Cards", "Suonatore di Draghi" (id 209) è "Dragon Piper", "Stregone di
   Fuoco" (id 242) è "Fire Sorcerer" — nessuno dei tre commenti nomina
   la carta inglese.

**Metodo usato per trovarle (più affidabile del solo confronto per
nome, da riusare in un futuro controllo simile)**: per ogni carta
ancora "mancante", cercare in `cards.json` un mostro con Livello+ATK+DEF+
Razza+Attributo ESATTAMENTE identici — una carta reale del TCG difficilmente
condivide tutti e 4 questi valori con un'altra carta a caso. **Insidia
scoperta e corretta durante il controllo**: un match per statistiche va
sempre verificato leggendo anche il TESTO dell'effetto, non bastano le
statistiche da sole — 2 casi trovati di pura coincidenza numerica con
un effetto completamente diverso (Livello/ATK/DEF/Razza/Attributo
generici, es. 4/1500/1200/Guerriero/TERRA, sono comuni a più carte
scollegate): "The Unhappy Maiden" NON è "Copione" (id 162, tutt'altro
effetto), "Lady Assailant of Flames" NON è "Drago Vampata Solare" (id
679, tutt'altro effetto) — entrambe restano correttamente nella tabella
sottostante. Va inoltre esclusa a priori qualunque carta marcata
`vanilla: true` in cards.json (un vero Effetto/Flip/Fusione/Rituale non
dovrebbe mai corrispondere a un riempitivo vanilla — trovati altri 2
casi di pura coincidenza risolti così, Karbonala Warrior/Kojikocy id
330 e Twin-Headed Wolf/Pagliaccio Mistico id 544). Infine, l'intero
archetipo Guardiani della Tomba (id 892-900, già chiuso per intero in
sessione 1) va escluso a priori dal confronto per statistiche: il
dataset lo registra con razza "Stregone", un sinonimo di "Spellcaster"
mai usato altrove (refuso storico, il resto del dataset usa sempre
"Incantatore") che avrebbe altrimenti fatto risultare 4 di quelle 9
carte come "ancora mancanti" per un semplice mancato incrocio di
stringa.

**Lezione per un futuro controllo simile**: il confronto per nome
inglese in sottostringa (comodo e veloce) ha comunque un tasso di falsi
negativi non trascurabile su un dataset di 900+ carte accumulato in
sessioni diverse con convenzioni di commento non sempre identiche — un
secondo controllo per statistiche esatte (Livello+ATK+DEF+Razza+
Attributo, ESCLUSO vanilla:true, verificato leggendo il testo
dell'effetto prima di accettare un match) cattura una porzione
rilevante di casi che il primo controllo lascia passare, senza
richiedere di rileggere a mano tutte le 900+ carte esistenti.

### Tabella delle 124 carte realmente ancora mancanti (dopo la verifica)

Fonte: rigenerabile da capo con lo stesso script (7 chiamate API +
doppio confronto nome/statistiche, vedi sopra) — salvata qui per non
perderla di nuovo. **Nome (EN)** è il nome ufficiale inglese (nessuna
traduzione ancora proposta: va scelta al momento di implementare,
seguendo lo stesso criterio già usato finora — tradurre se il
significato è chiaro, mantenere invariato un nome proprio/giapponese
senza una traduzione italiana ufficiale confermata, es. Wingweaver/
Fushi No Tori/Otohime).

| Nome (EN) | Tipo | Set | Razza/Attributo/Lv/ATK/DEF |
|---|---|---|---|
| Banisher of the Light | Effetto | SRL | Fairy/LIGHT/3/100/2000 |
| Drill Bug | Effetto | PSV | Insect/EARTH/2/1100/200 |
| Lava Golem | Effetto | PGD | Fiend/FIRE/8/3000/2500 |
| Moisture Creature | Effetto | PGD | Fairy/LIGHT/9/2800/2900 |
| Patrician of Darkness | Effetto | LOD | Zombie/DARK/5/2000/1400 |
| Serpentine Princess | Effetto | LOD | Reptile/WATER/4/1400/2000 |
| Morphing Jar #2 | Flip | PSV | Rock/EARTH/3/800/700 |
| Mysterious Guard | Flip | LOD | Spellcaster/EARTH/3/800/1200 |
| Parasite Paracide | Flip | PSV | Insect/EARTH/2/500/300 |
| Supply | Flip | LON | Warrior/EARTH/4/1300/800 |
| Charubin the Fire Knight | Fusione | LOB | Pyro/FIRE/3/1100/800 |
| Cyber Saurus | Fusione | MRD | Machine/EARTH/5/1800/1400 |
| Darkfire Dragon | Fusione | LOB | Dragon/DARK/4/1500/1250 |
| Deepsea Shark | Fusione | MRD | Fish/WATER/5/1900/1600 |
| Empress Judge | Fusione | MRD | Warrior/EARTH/6/2100/1700 |
| Flame Ghost | Fusione | LOB | Zombie/DARK/3/1000/800 |
| Flower Wolf | Fusione | LOB | Beast/EARTH/5/1800/1400 |
| Fusionist | Fusione | LOB | Beast/EARTH/3/900/700 |
| Kaminari Attack | Fusione | MRD | Thunder/WIND/5/1900/1400 |
| Karbonala Warrior | Fusione | LOB | Warrior/EARTH/4/1500/1200 |
| Metal Dragon | Fusione | LOB | Machine/WIND/6/1850/1700 |
| Punished Eagle | Fusione | MRD | Winged Beast/WIND/6/2100/1800 |
| Reaper on the Nightmare | Fusione | PGD | Zombie/DARK/5/800/600 |
| Roaring Ocean Snake | Fusione | MRD | Aqua/WATER/6/2100/1800 |
| Ryu Senshi | Fusione | LOD | Warrior/EARTH/6/2000/1200 |
| Skull Knight | Fusione | MRD | Spellcaster/DARK/7/2650/2250 |

Nota: alcuni Mostri Fusione richiedono i loro materiali (anch'essi
presi dal nome inglese in tabella) — verificare se il materiale è già
nel dataset (spesso sì, sono carte comuni) prima di implementare la
Fusione stessa, stesso schema già rodato per Santa Giovanna (id 903).
Le Magie/Trappole che questi mostri effetto potrebbero richiedere come
riferimento (es. "Umi" per Deepsea Warrior, già presente id 497) vanno
verificate caso per caso allo stesso modo.

### Chiuse: terza ondata, 10 Mostri Flip (id 1020, 1022-1030)

Mummia Velenosa (1020, Poison Mummy — 500 danni diretti al FLIP),
Scarpe Mordaci (1022, Bite
Shoes — cambia Posizione di Battaglia di 1 mostro scoperto, bersaglio
auto-selezionato), Parassita Bubbonico (1023, Bubonic Vermin — Special
Summon di una copia di sé dal Deck in Difesa coperta poi rimescola),
Bomba a Orologeria (1024, Jigen Bakudan — Ignition attivabile SOLO in
Standby Phase, si tributa e infligge metà del totale ATK altrui
distrutto), L'Immortale del Tuono (1025, The Immortal of Thunder —
+3000 LP al FLIP, -5000 LP quando lasciato al Cimitero via onDestroy),
Un Gufo Fortunato (1026, An Owl of Luck) e Un Gatto di Malaugurio
(1027, A Cat of Ill Omen — nuovo helper condiviso
`searchAndPlaceOnTopOrHandIfNecrovalley`: cerca dal Deck e rimette in
CIMA, o in mano se Necrovalley id 890 è scoperta), Manipolatore di
Draghi (1028, Dragon Manipulator — prende il controllo di un Drago
avversario fino alla End Phase) e Fauci dell'Oscura Dipartita (1029,
Jowls of Dark Demise — stesso meccanismo su qualunque Tipo, SEMPLIFICAZIONE:
manca il permesso di attacco diretto per il mostro rubato), Barattolo
Cobra (1030, Cobra Jar — Special Summon di un Token Serpente Velenoso
costruito a mano, non tramite `ctx.createTokens` che forzerebbe la
Difesa; SEMPLIFICAZIONE: manca il danno alla distruzione del Token).

**Scoperta utile**: `ctx.takeControl(newOwner, fromOwner, fromIndex, false)`
(senza `permanent: true`) aveva GIÀ la durata esatta "fino alla End
Phase di questo turno" richiesta da Dragon Manipulator/Jowls of Dark
Demise (`processTemporaryControlReturns`, chiamato da `enterEndPhase()`
in game-flow.js) — zero infrastruttura nuova necessaria, bastava
riusare la firma esistente. Verificato con un vero test attraverso il
motore reale (`tests/specs/pgd-psv-srl-lod-flip-cards.spec.js`):
restrizione alla Standby Phase, danno dimezzato sull'ATK altrui,
ricerca+Special Summon+rimescolamento dal Deck, ricerca dal Deck sia
con sia senza Necrovalley scoperta, controllo temporaneo che torna
davvero al proprietario dopo `processTemporaryControlReturns`, guadagno
e perdita di LP dell'Immortale del Tuono, Token del Barattolo Cobra
scoperto in Attacco. Suite 38/38 verde.

### Chiuse: quarta ondata, 8 Mostri Flip (id 1031-1038)

Domatore d'Ombre (1031, Shadow Tamer — controllo temporaneo di 1 mostro
Demone avversario, stesso meccanismo di Manipolatore di Draghi/Fauci
dell'Oscura Dipartita), Uccello Tornado (1032, Tornado Bird — nuovo
helper condiviso `returnSpellTrapToHand`, estratto da Turbine Gigante
id 262: fa tornare in mano fino a 2 Magie/Trappole sul Terreno, OGNUNA
al proprio vero proprietario, non a chi controlla Uccello Tornado —
punto verificato esplicitamente con un test, un errore facile da
introdurre), Scarabeo Bombardiere (1033, Bombardment Beetle — guarda 1
mostro coperto in Difesa avversario, lo distrugge SOLO se è un vero
Mostro Effetto, `!card.vanilla && DuelEngine.getDefinition(...)`),
Invasore del Trono (1034, Invader of the Throne — scambio PERMANENTE
di controllo con `ctx.takeControl(..., true)` su ENTRAMBI i lati,
bloccato se girata scoperta durante la Battle Phase), Bollettino Meteo
(1035, Weather Report — distrugge "Spada Rivelatrice" id 8 scoperta
avversaria; SEMPLIFICAZIONE: manca la seconda Battle Phase concessa),
Lanciere Sciocco (1036, Spear Cretin — onDestroy dopo essere stata
girata scoperta: entrambi i giocatori Special Summonano 1 mostro dal
proprio Cimitero, auto-selezionato), Assalitrice delle Fiamme (1037,
Lady Assailant of Flames — bandisce le prime 3 carte del Deck via
`deck.splice(-3,3)`, infligge 800 danni), Evocatore di Illusioni (1038,
Summoner of Illusions — tributa 1 altro mostro, Special Summon del
primo Mostro Fusione dall'Extra Deck ignorando i materiali, distrutto
in End Phase riusando `ctx.grantTemporaryAtkDefBonus(card,0,0,true)`
solo per la scadenza programmata, non per un vero bonus).

Restano SOLO 4 Mostri Flip genuinamente più complessi (Mysterious
Guard, Morphing Jar #2, Parasite Paracide, Supply — targeting multiplo
condizionale, mescolamento+escavazione, carta piantata nel Deck
avversario, tracciamento "mandata al Cimitero come materiale di
Fusione"), rimandati a una battuta dedicata.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-psv-flip-cards-batch4.spec.js`): controllo
filtrato per razza, ritorno in mano a 2 proprietari diversi, distinzione
Effetto/vanilla, scambio di controllo bloccato in Battle Phase e
confermato permanente dopo `processTemporaryControlReturns`, distruzione
di una carta per nome, doppio Special Summon dal Cimitero alla
distruzione, bando dal Deck con danno, tributo+Fusione+distruzione
programmata. Suite 39/39 verde.

### Chiuse: quinta ondata, 3 Mostri Fusione + 4 materiali propedeutici (id 1039-1045)

A differenza delle Fusioni vanilla rimaste in tabella (i cui materiali
sono mostri vanilla minori mai aggiunti — coerente con "non include le
decine di mostri vanilla minori" in cima a questo file), questi 3
Mostri Fusione hanno un vero effetto proprio, quindi vale la pena
aggiungere anche i loro 4 materiali (tutti con un effetto reale, non
vanilla): Saggio della Frontiera (1039, Frontier Wiseman) e Drago della
Caverna (1040, Cave Dragon) e Demone Minore (1041, Lesser Fiend) sono
registrati SENZA codice funzionale (`CardEffects.register(id, {})`,
stesso schema di Sentinella dei Guardiani della Tomba id 900) — vedi
missingEffectNote per il perché di ciascuno, principalmente serviti da
materiali. Maryokutai (1042) ha invece un vero Effetto Veloce
implementato per intero: risponde SOLO durante il turno dell'avversario
a un'attivazione Magia sulla Chain, tributandosi per negarla — nuova
combinazione (mai usata insieme prima) di due meccanismi già esistenti,
`canRespondAsQuickEffect` (Effetto Veloce da campo, nato per Ninja
d'Assalto id 459) e `ctx.negateActivation()` (nato per Giudizio Solenne
id 448).

Balter Oscuro il Terribile (1043, Dark Balter the Terrible — Fusione di
405+1039): stesso schema di Maryokutai ma senza il vincolo "solo turno
avversario" e pagando 1000 LP invece di tributarsi, per negare
qualunque Magia Normale. SEMPLIFICAZIONE (vedi missingEffectNote):
manca la negazione dell'effetto dei Mostri Effetto distrutti in
battaglia.

Drago Teschio Demoniaco (1044, Fiend Skull Dragon — Fusione di
1040+1041): nuovo floodgate globale `gameState.flipEffectsGloballyNegated`
(azzerato e ricalcolato ad ogni render in `recomputeStaticEffects()`,
duel-engine.js, stesso schema di Luce dell'Intervento id 634) che nega
OGNI effetto FLIP di entrambi i giocatori mentre questa carta resta
scoperta — consultato in `fireTrigger()` insieme al flag per-uid già
esistente `isMonsterCardEffectsNegated`. Nega e distrugge anche le
Trappole che la scelgono come bersaglio, riusando il checkpoint di
targeting condiviso (stesso schema di Gran Scudo Gardna id 115).

L'Ultimo Guerriero di un Altro Pianeta (1045, The Last Warrior from
Another Planet — Fusione di 625+1042, entrambi i materiali già
esistenti): se Special Summonata, distrugge tutti gli altri propri
mostri (onSummon) e blocca la Special Summon per ENTRAMBI i giocatori
riusando `gameState.otherMonsterSummonsBlockedFor` (nato per Guardiano
Falce del Terrore id 282, che però blocca solo il proprio controllore) —
**scoperta importante**: questo flag va impostato in `static()`, MAI in
`onSummon()` (una tantum), perché `recomputeStaticEffects()` lo azzera
ad ogni singolo render — un primo tentativo in `onSummon()` sarebbe
stato annullato dal render immediatamente successivo, un bug silenzioso
trovato e corretto prima di committare. SEMPLIFICAZIONE (vedi
missingEffectNote): il blocco copre solo la Special Summon, non anche
l'Evocazione Normale/Set.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-fusion-monsters-batch5.spec.js`): Maryokutai
risponde solo nel turno avversario (e non nel proprio), Balter Oscuro
risponde in qualunque turno pagando LP invece di tributarsi, il
floodgate anti-FLIP blocca davvero un mostro FLIP reale (Insetto
Divoratore Mostruoso id 23) e smette di farlo quando il Drago lascia il
Terreno (nessuna regressione), un vero tentativo di Special Summon del
bot fallisce mentre L'Ultimo Guerriero è scoperto. Suite 40/40 verde.

Prossimo ID libero in `data/cards.json`: **1046**.

### Chiuse: sesta ondata, 14 Mostri Effetto minori (id 1046-1059)

Batch di piccoli Mostri Effetto dalla tabella qui sopra, quasi tutti
risolvibili con infrastruttura già esistente in questo motore — nessuna
Fusione stavolta, solo mostri singoli.

Ameba (1046)/Griggle (1047): primo uso reale del nuovo hook condiviso
`def.onControlChangedToOpponent(ctx)`, aggiunto dentro `ACTIONS.takeControl`
(duel-engine.js, subito dopo l'entry in `gameState.temporaryControls`) —
scatta ad OGNI cambio di controllo verso l'altro giocatore (Cambio di
Cuore, Scambio di Creature, ecc.), non solo per queste due carte. `ctx`
è costruito con `ctx.owner = newOwner` (chi ADESSO controlla la carta,
il "tu" del testo reale) e `ctx.previousOwner`/`ctx.opponent` = il
proprietario originale — Ameba infligge 2000 danni a `ctx.opponent`,
Griggle guadagna 3000 LP per `ctx.owner`. Il vincolo "una volta sola
finché resta scoperta" usa un flag PER-ISTANZA diretto sull'oggetto
carta (`ctx.card.controlSwapEffectUsed`), non uno store condiviso: si
azzera da solo se una nuova copia fisica della carta viene pescata.

Serpente Elettrico (1048, Electric Snake): riusa `ctx.discardedByOwner`
(già esistente, nato per Re Neko Mane id 393) per distinguere "scartata
da un effetto dell'AVVERSARIO" da uno scarto proprio.

La Fanciulla Infelice (1049, The Unhappy Maiden): riusa `ctx.destroyedByOpponentCard`
(popolato SOLO per una distruzione in BATTAGLIA, mai da un effetto
Carta — vedi `fireOnDestroy` in actions.js) per il discriminatore "in
seguito a una battaglia", e `ctx.endBattlePhase()` (già esistente, nato
per Nega Attacco id 820/Tartaruga Elettromagnetica id 223) per terminare
subito la Battle Phase.

Drago della Truppa (1050, Troop Dragon)/Momonga Agile (1051, Nimble
Momonga): stesso schema "distrutta in battaglia -> Special Summon dal
Deck" di Bebè Cerasauro (id 809), con `ctx.findEmptyMonsterSlot`. Momonga
Agile va oltre: guadagna 1000 LP (`ctx.dealDamage` negativo) POI ripete
la Special Summon per OGNI copia trovata nel Deck finché ci sono sia
copie sia slot liberi, tutte coperte in Posizione di Difesa
(`ctx.specialSummon(..., 'defense')` imposta da sola `isFaceDown: true`
per quella posizione, vedi `ACTIONS.specialSummon`).

Des Lacooda (1052): Ignition una volta per turno (`ctx.hasUsedOncePerTurn`/
`markUsedOncePerTurn`) per coprirsi da sola in Posizione di Difesa
(mutazione diretta `slot.isFaceDown = true; slot.position = 'defense'`,
nessun ACTIONS dedicato necessario per un'auto-modifica della propria
posizione) + `onFlip` per pescare 1 carta quando Evocata Flip.

Cavallo dell'Incubo (1053, Nightmare Horse)/Servitore del Catabolismo
(1056, Servant of Catabolism): attacco diretto incondizionato, stesso
schema `gameState.directAttackAllowedUids` già usato ~9 volte in questo
file (es. Folletto della Fiamma Furente id 681).

Tirapiedi Alato (1054, Winged Minion): si tributa da sola per dare
+700/+700 permanenti a 1 mostro Tipo Demone scoperto (mutazione diretta
delle statistiche, stessa convenzione di Drago Berserk id 110). **Bug
reale trovato e corretto dal test prima di committare**: Tirapiedi Alato
è essa stessa un mostro Tipo Demone, quindi la prima versione del
filtro candidati la includeva come proprio possibile bersaglio (nel
caso peggiore, l'UNICO candidato quando è l'unico Demone in campo) —
corretto escludendo il proprio indice (`i !== ctx.index`), stesso
accorgimento già usato da Spadaccino di Fiamma Blu (id 122) per lo
stesso motivo (nel gioco reale il Tributo è un costo pagato PRIMA che
l'effetto scelga il bersaglio, quindi la carta non c'è già più).

Samurai Sasuke (1055, Sasuke Samurai): testo identico a Paladino del
Drago Bianco (id 398)/Spadaccino Mistico LV2 (id 718) — riusa lo stesso
flag `instantlyDestroysFaceDownDefender: true` senza scrivere nuovo
codice, seguendo la preferenza esplicita dell'utente di riusare
infrastruttura condivisa invece di duplicarla per una carta sola.

Nave di Yomi (1057, Yomi Ship): distrutta in battaglia, distrugge
`ctx.destroyedByOpponentCard` per ritorsione — stesso identico campo di
La Fanciulla Infelice sopra, usato stavolta come bersaglio diretto
invece che come semplice discriminatore booleano.

Tuorlo Mucoso (1058, Mucus Yolk): attacco diretto incondizionato (come
1053/1056) + nuovo store generico e riusabile `gameState.pendingStandbyAtkBuffs`
(array di `{uid, owner, amount}`, duel-engine.js/
`processPendingStandbyAtkBuffs`, agganciato in `enterStandbyPhase()`
esattamente come `processKiseitaiLifeGain` già esistente) per "+1000 ATK
alla TUA prossima Standby Phase" ogni volta che infligge danno da
battaglia — deliberatamente generico (nessun riferimento alla carta nel
nome), riusabile da qualunque futura carta con lo stesso schema di
ritardo invece di uno store dedicato a questa sola carta.

Amuleto di Shabti (1059, Charm of Shabti): SEMPLIFICAZIONE dichiarata,
nessun hook funzionale (`CardEffects.register(1059, {})`) — il testo
reale richiede un'attivazione dalla mano a velocità istantanea durante
il turno di UNO QUALUNQUE dei due giocatori, e questo motore non ha
alcuna finestra di priorità per un'attivazione dalla mano fuori da una
Chain già aperta o da un trigger nominato (stesso limite già accettato
per Sentinella dei Guardiani della Tomba, id 900).

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-battle-control-effects-batch6.spec.js`): cambio di
controllo che infligge danno/cura LP una volta sola, scarto da effetto
avversario vs proprio, distruzione in battaglia vs da effetto Carta,
Special Summon singola e multipla dal Deck con conteggio corretto,
Ignition una volta per turno, attacco diretto per 3 carte diverse,
tributo che esclude se stessa dai bersagli, buff ATK che scatta SOLO
alla Standby Phase del controllore corretto (non dell'avversario) e non
prima. Suite 41/41 verde.

Prossimo ID libero in `data/cards.json`: **1060**.

### Chiuse: settima ondata, 7 Mostri Effetto minori (id 1060-1066)

Prima di questo batch, un ricontrollo stats-based sull'intera tabella
rimanente (~95 righe) ha trovato un altro falso positivo storico:
"Exodia the Forbidden One" risultava ancora in tabella, ma è già
implementato da tempo come id 41 ("Testa Proibita") — il meccanismo di
vittoria vive in `hasExodiaAssembled`/`checkGameOver()` (game-flow.js),
non in un `CardEffects.register`, quindi la carta è marcata
`vanilla: true` in cards.json (ha un `effect` testuale ma nessun hook
bespoke) — lo script di ricontrollo filtrava `!c.vanilla`, quindi non
l'aveva presa, esattamente come già successo con l'archetipo Gravekeeper's
in una sessione precedente. Rimossa dalla tabella.

Insetto dalle 8 Chele (1060, Arsenal Bug): riusa `gameState.atkDefBonus`
(già esistente per decine di Magie Equipaggiamento in questo file, es.
Ciondolo Nero id 117) per un malus CONDIZIONALE invece che fisso — se
non controlli altri mostri Tipo Insetto, -1000/-1000.

Shock di Byser (1061): `def.onSummon` (già dispatchato per Evocazione
Normale E Special, vedi fireTrigger/duel-engine.js) + il helper
condiviso `returnSpellTrapToHand` (nato per Turbine Gigante id 262) per
far tornare in mano ogni carta coperta di ENTRAMBI i lati.

Sparajongler Esplosivo (1062): attivabile solo nella propria Standby
Phase, si tributa per distruggere 2 mostri (di uno o entrambi i lati)
con ATK 1000 o meno — sceglie un bersaglio alla volta con
`ctx.destroyTargetedMonster` (checkpoint di targeting condiviso),
ricalcolando i candidati dopo ogni scelta.

Sentinella Cremisi (1063, Crimson Sentry): nuovo tracker generico e
riusabile `gameState.battleDestroyedThisTurnFor` (per proprietario,
popolato nell'UNICO punto per cui passa ogni distruzione da battaglia,
`fireOnDestroy` in actions.js, azzerato in `changeTurn()` come ogni
altro flag "per il resto del turno" in quella funzione) — si tributa
per rimandare in fondo al proprio Deck 1 proprio mostro distrutto in
battaglia in QUESTO turno, scelto tra quelli ancora presenti nel
Cimitero al momento dell'attivazione.

Sirena Curatrice (1064, Cure Mermaid)/Fata Danzante (1065, Dancing
Fairy): `def.onStandbyPhase` (firePhaseTrigger, duel-engine.js) scatta
già SOLO per chi controlla la carta durante la SUA Standby Phase,
nessuna condizione aggiuntiva necessaria per Sirena Curatrice; Fata
Danzante aggiunge un controllo su `ctx.slot.position === 'defense'`
(già esposto dallo stesso trigger) per limitare il guadagno di LP a
quando resta in Posizione di Difesa scoperta.

Elfa Oscura (1066, Dark Elf): riusa `requiresLifePointsToAttack`
(flag dichiarativo già esistente, nato per Sirena Toon id 484/Teschio
Evocato Toon id 486) — zero codice nuovo, solo il valore 1000.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-conditional-stats-battle-tribute-batch7.spec.js`):
statistiche condizionali con/senza altri Insetti, ritorno in mano di
carte coperte di entrambi i lati, attivazione bloccata fuori dalla
propria Standby Phase, doppia distruzione con ricalcolo dei candidati,
tributo con rimando in fondo al Deck di un mostro ancora nel Cimitero,
guadagno LP alla propria Standby Phase condizionato alla Posizione di
Difesa. Suite 42/42 verde.

Prossimo ID libero in `data/cards.json`: **1067**.

### Chiuse: ottava ondata, 8 Mostri Effetto minori (id 1067-1074)

Rimandate deliberatamente a un batch futuro, in questo giro: Drill Bug
(il suo effetto cerca "Parasite Paracide" nel Deck, carta non ancora
presente in cards.json — uno dei 4 Flip complessi già deliberatamente
rimandati — implementarlo ora sarebbe codice permanentemente inerte);
Dark Ruler Ha Des (floodgate "nega gli effetti dei mostri distrutti in
battaglia dai TUOI mostri Demone" — nessun checkpoint condiviso
equivalente a `fireOnDestroy`/`onOwnMonsterDestroyed` copre ancora
questo caso specifico); Fushioh Richie/Great Dezard (coppia con
evoluzione a stadi collegata — Great Dezard conta le distruzioni in
battaglia per sbloccare progressivamente 2 effetti, poi si tributa per
Special Summonare Fushioh Richie: sostanzialmente un'altra "carta con
condizione a stadi" come Destiny Board, merita una sessione dedicata);
Garuda the Wind Spirit e Aqua Spirit (stesso "Special Summon dalla mano
bandendo 1 mostro dello stesso Attributo dal Cimitero", allora ancora
in tabella). **Correzione della sessione successiva (undicesima
ondata)**: questa valutazione era SBAGLIATA — non serviva alcun nuovo
flusso UI, la coppia già esistente `canSpecialSummonFromHand`/
`paySpecialSummonCost` (nata per i mostri Toon id 484/486) è già
completamente generica e copre il bisogno senza alcuna modifica al
motore. Entrambe le carte sono state chiuse nell'undicesima ondata,
insieme al ciclo "Spirit" completo — vedi lì per i dettagli e la
lezione di metodo.

Un ricontrollo stats-based ha anche confermato che, dato l'aggiornamento
del filtro `!c.vanilla` nello script della settima ondata, nessun altro
falso positivo emerge nella porzione di tabella coperta da questo batch.

Scassinatori Scorpioni Oscuri (1067, Dark Scorpion Burglars):
`onDealsBattleDamage` (già dispatchato per OGNI danno da battaglia, non
solo l'attacco diretto — vedi `fireOwnBattleDamageDealt`, actions.js)
per mandare (mill) 1 Magia dal Deck avversario al suo Cimitero.

Guerriero degli Abissi (1068, Deepsea Warrior): stesso schema PER-
ISTANZA di Il Pescatore Leggendario (id 879) per "non influenzato dagli
effetti Magia finché Umi è sul Terreno" — `gameState.cannotBeTargetedBySpellsUids`,
ricalcolato ad ogni render, nessun codice nuovo nel motore.

Guardiana delle Fate (1069, Fairy Guardian): nuovo tracker generico e
riusabile `gameState.spellsSentToGraveyardByOpponentThisTurnFor` (per
proprietario, popolato nell'unico punto per cui passa una distruzione
di Magia/Trappola da effetto Carta, `ACTIONS.destroySpellTrap` in
duel-engine.js, azzerato in `changeTurn()` come `battleDestroyedThisTurnFor`
di Sentinella Cremisi id 1063) — si tributa per rimandare in fondo al
Deck 1 propria Magia mandata al Cimitero da un effetto dell'avversario
in questo turno.

Assalitore Lampo (1070, Flash Assailant): -400 ATK/DEF per ogni carta
in mano, via `gameState.atkDefBonus` (già esistente).

Mummia dall'Ascia Gigante (1071, Giant Axe Mummy): Ignition una volta
per turno per coprirsi (stesso schema di Des Lacooda id 1052). La
seconda clausola del testo reale ("l'attaccante con ATK inferiore alla
DEF di questa carta viene distrutto") non richiede ALCUN codice: è già
il comportamento standard di questo motore per un mostro in Posizione
di Difesa — il testo della carta descrive la meccanica normale, non
un'eccezione. **Lezione per un futuro caso simile**: prima di cercare
un nuovo hook per una clausola che sembra un effetto, verificare se
descrive semplicemente una regola già implementata dal motore di base.

Tartaruga Gora (1072, Gora Turtle): `gameState.cannotAttackUids`, già
esistente per Messaggero della Pace (id 880, soglia 1500 + costo di
mantenimento) — qui soglia 1900, nessun costo (il testo reale non ne
ha uno).

Ala Grigia (1073, Gray Wing): riusa `slot.extraAttackGranted` (già
esistente, nato per Riavvolgimento Toon id 485 — un +1 attacco una
tantum concesso da un'ALTRA carta) impostandolo sulla PROPRIA casella
come costo di un'Ignition nella propria Main Phase 1, invece che da un
effetto esterno — stesso store, uso nuovo.

Hoshiningen (1074): +500 ATK a tutti i mostri LUCE, -400 ATK a tutti i
mostri OSCURITÀ, di entrambi i lati — `gameState.atkDefBonus`, stesso
schema di Un Oceano Leggendario/decine di altre carte in questo file.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-static-floodgates-batch8.spec.js`): mill di una
Magia dal Deck avversario, immunità al targeting Magie condizionata
alla presenza reale di Umi (non fissa), tributo con verifica del
tracker per le Magie perse in questo turno, malus ATK/DEF proporzionale
alla mano, Ignition una volta per turno, blocco d'attacco per soglia
ATK su ENTRAMBI i lati, secondo attacco concesso da un costo pagato in
Main Phase 1, bonus/malus per Attributo su entrambi i lati incluso il
proprio. Suite 43/43 verde.

Prossimo ID libero in `data/cards.json`: **1075**.

### Chiuse: nona ondata, 9 Mostri Effetto minori (id 1075-1083)

Rimandato deliberatamente: Lava Golem — meccanismo unico ("gift
monster", Special Summonabile dalla propria mano sul Terreno
AVVERSARIO tributando 2 mostri LORO, poi drena 1000 LP al proprio
controllore ad ogni SUA Standby Phase pur restando sotto il controllo
avversario) che richiederebbe un intero nuovo flusso di Evocazione
alternativa "verso il campo dell'altro giocatore" — nessun precedente
di questo tipo esiste nel motore, stessa categoria di Fushioh
Richie/Great Dezard/Garuda the Wind Spirit già rimandati nell'ottava
ondata.

Jowgen lo Spiritualista (1075): nuovo marcatore per-slot PERSISTENTE
`slot.wasSpecialSummoned` (`ACTIONS.specialSummon`, duel-engine.js —
mai esistito prima, nessun'altra carta doveva ancora sapere DOPO il
fatto come un mostro fosse arrivato sul Terreno) per individuare quali
mostri distruggere, e nuovo `gameState.specialSummonsPermanentlyBannedForBothSides`
(consultato in `ACTIONS.specialSummon` accanto a
`otherMonsterSummonsBlockedFor`): a differenza di OGNI altro floodgate
"per il resto del turno/finché resta scoperta" di questo file, questo
NON viene mai azzerato da `recomputeStaticEffects()` — resta vero anche
dopo che Jowgen lascia il Terreno, fedele al ruling ufficiale reale.
**Prima vera infrastruttura "a vita" (non per-turno, non per-presenza-
sul-campo) di questo motore** — riusabile da una futura carta con lo
stesso identico bisogno.

Invito al Sonno Oscuro (1076): "quando Evocata Normalmente (Special
Summon esclusa)" sfrutta la precedenza già esistente tra
`def.onSpecialSummon`/`def.onSummon` in `fireTrigger` — dichiarare
`onSpecialSummon(){}` come no-op impedisce la ricaduta automatica su
`onSummon` per una Special Summon, mentre `onSummon` da solo continua a
coprire l'Evocazione Normale. Il bersaglio bloccato è un flag PER-
ISTANZA sulla carta stessa (`ctx.card.lockedAttackBanTargetUid`),
riletto da `static()` dentro `gameState.cannotAttackUids` (già
esistente) — pattern generico, riusabile da qualunque futura carta con
un bersaglio "scelto una volta, bloccato finché resto scoperta".

Tigre Re Wanghu (1077)/Kotodama (1078): nuovo helper condiviso
`findCardFieldLocation(card)` (card-effects.js) + i due monitor globali
già esistenti in duel-engine.js `def.onAnyNormalOrFlipSummon`/
`def.onAnySpecialSummon` (nati per Misterioso Burattinaio id 579/Torre
d'Ossa Divora-Anime id 664, mai usati prima per una reazione
DISTRUTTIVA) — entrambe le carte reagiscono a QUALUNQUE Evocazione, di
ENTRAMBI i lati, localizzano il mostro appena arrivato e lo distruggono
se soddisfa la propria condizione (ATK ≤ 1400 per Wanghu, nome
duplicato già scoperto per Kotodama). Kotodama copre la sola
"regola scritta sulla carta" (nuovo arrivato duplicato distrutto), non
il caso limite "due arrivano insieme" (entrambi distrutti) — irrilevante
in un motore dove le Evocazioni sono sempre sequenziali, una alla volta.

Kryuel (1079): lancio di moneta 50/50 diretto (`Math.random() < 0.5`)
invece di un passaggio di scelta testa/croce — matematicamente
equivalente per un lancio equo, il "chiamala" del testo reale non
altera la probabilità.

Kycoo Distruttore di Fantasmi (1080): riusa `ctx.banishFromGraveyard`
(già esistente) per l'effetto principale (bandire fino a 2 mostri dal
Cimitero avversario al danno da battaglia), SEMPLIFICAZIONE dichiarata
sul floodgate secondario "l'avversario non può bandire dal Cimitero" —
nessun checkpoint condiviso per-ATTORE esiste in questo motore (a
differenza di `isNecrovalleyProtectingGraveyard`, che protegge un
Cimitero per-PROPRIETARIO indipendentemente da chi banisce).

Pantera Signora (1081): stesso identico schema di Sentinella Cremisi
(id 1063, settima ondata) — riusa lo stesso tracker
`gameState.battleDestroyedThisTurnFor`, unica differenza `push()`
(cima del Deck) invece di `unshift()` (fondo).

Ninfa dell'Acqua (1082): nuovo `gameState.virtualUmiPresent` (globale,
non per-owner — "Umi" reale non lo è), ricalcolato nel proprio
`static()` e consultato ACCANTO al controllo diretto `fs.card.id === 497`
già esistente in Guerriero degli Abissi (id 1068, settima... ottava
ondata) e Il Pescatore Leggendario (id 879, precedente a questa
sessione) — **primo caso in questo file di un condition-check condiviso
tra card-effects.js esteso RETROATTIVAMENTE per una carta nuova**,
esattamente lo spirito della preferenza dell'utente per infrastruttura
riusabile invece di duplicare la logica di Ninfa dell'Acqua dentro
Guerriero degli Abissi stessa.

Fata Isterica (1083): tributa 2 mostri propri (se stessa inclusa,
testo reale non la esclude) — raccoglie le 2 scelte PRIMA di rimuoverle
insieme, non una alla volta, così scegliere se stessa come uno dei due
bersagli non altera gli indici della scelta successiva.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-pgd-reactive-summon-monitors-batch9.spec.js`): il
divieto di Jowgen resta attivo anche dopo che la carta lascia il
Terreno, `onSpecialSummon` no-op blocca davvero la ricaduta di Invito
al Sonno Oscuro, Tigre Re Wanghu distrugge il mostro debole ma non
quello forte in ENTRAMBI i tipi di Evocazione, Kotodama distrugge solo
il nuovo arrivato duplicato, Kycoo bandisce esattamente 2 carte,
l'Umi virtuale di Ninfa dell'Acqua smette di funzionare con un altro
Field Spell attivo, Fata Isterica tributa davvero se stessa. Suite
44/44 verde.

Prossimo ID libero in `data/cards.json`: **1084**.

### Chiuse: decima ondata, 9 Mostri Effetto minori (id 1084-1092)

Rimandate deliberatamente, motivazione documentata: Moisture Creature
(serve sapere CON QUANTI Tributi è stata Evocata QUESTA specifica
Evocazione Tributo — nessun tracking del genere esiste oggi, a
differenza di `getTributesRequired` che riguarda solo QUANTI ne servono
per definizione, non quanti sono stati effettivamente usati); Mystical
Knight of Jackal (serve un hook "quando QUESTA carta distrugge un
mostro avversario in battaglia", dal lato dell'ATTACCANTE — a
differenza di `ctx.destroyedByOpponentCard`/`onDestroy`, che reagiscono
dal lato del mostro DISTRUTTO, nessun hook equivalente esiste dal lato
di chi ha vinto lo scontro); Patrician of Darkness ("scegli tu i
bersagli degli attacchi del tuo avversario" — richiederebbe rifare la
selezione del bersaglio d'attacco per passare dal giocatore che
attacca a quello che difende, un cambio sistemico alla UI/IA di
attacco, non un singolo hook aggiuntivo); Serpentine Princess ("se
questa carta torna dal Terreno al Deck" — questo motore non ha ancora
NESSUNA azione "manda un mostro dal Terreno al Deck", a differenza di
mano/Cimitero/bando: costruirne una da zero per una carta sola non è
proporzionato, ma resta un candidato per una futura sessione se altre
carte dovessero averne bisogno); Skull Knight #2 (serve sapere se il
Tributo di QUESTA carta è servito a un'Evocazione Tributo di un mostro
Tipo Demone SPECIFICO — `def.onSacrificedForTribute` esiste già ma non
porta con sé alcuna informazione su COSA è stato poi Evocato con quel
Tributo).

Minar (1084): stesso identico schema di Serpente Elettrico (id 1048,
sesta ondata) — `ctx.discardedByOwner`, infligge danno invece di
pescare.

Mushroom Man #2 (1085): `def.onStandbyPhase` per il drenaggio LP
ricorrente + Ignition nella propria End Phase che paga 500 LP e usa
`ctx.takeControl(..., true)` per un trasferimento PERMANENTE (mai
registrato in `gameState.temporaryControls` — verificato esplicitamente
chiamando `processTemporaryControlReturns()` nel test, il controllo non
torna indietro).

Newdoria (1086): `ctx.destroyTargetedMonster` su un bersaglio scelto tra
ENTRAMBI i campi.

Nuvia la Malvagia (1087): stesso schema "escludi la Special Summon"
già usato da Invito al Sonno Oscuro (id 1076)/Senju delle Mille Mani
(id 1092 qui sotto) — `onSpecialSummon(){}` no-op accanto a `onSummon`.

Cavaliere Pinguino (1088): `ctx.milledByOwner` (già esistente) per
distinguere un mill avversario da uno proprio, poi fonde
Cimitero+Deck e rimescola con un Fisher-Yates diretto.

Melma Rediviva (1089): **`ctx.reviveFromGraveyardWithCountdown`
(duel-engine.js) esteso con un nuovo parametro opzionale `position`**
(default `'attack'`, retrocompatibile con l'unico chiamante precedente,
Signore dei Vampiri id 658) invece di duplicare la funzione per il
bisogno specifico "rinasce in Posizione di DIFESA" — esattamente la
preferenza dell'utente per estendere l'infrastruttura condivisa invece
di scrivere un percorso parallelo.

Guardiano Reale (1090): Ignition una volta per turno per coprirsi
(stesso schema di Des Lacooda id 1052/8-Claws Scorpion/Giant Axe Mummy
id 1071) + `ctx.grantTemporaryAtkDefBonus` (già esistente) per il
bonus "fino a fine turno" al FLIP.

Ryu-Kishin Pagliaccio (1091): `onSummon`+`onSpecialSummon` (stessa
funzione condivisa `ryuKishinClownReact`) + `ctx.changePosition` (già
esistente) per cambiare la Posizione di un mostro qualunque, se stessa
inclusa (il testo reale non la esclude). **Bug reale trovato e corretto
dal test**: l'auto-pick per bot/no-UI prendeva semplicemente il primo
candidato trovato scandendo prima il proprio campo, quindi finiva quasi
sempre per scegliere SE STESSA invece dell'avversario — corretto
aggiungendo una preferenza euristica per un mostro AVVERSARIO quando
disponibile (il testo reale non lo richiede, ma è l'unica scelta
sensata per un'IA quando non c'è un umano a decidere).

Senju delle Mille Mani (1092): stesso schema "escludi la Special
Summon" di Nuvia la Malvagia (1087) sopra. **Bug reale trovato e
corretto dal test**: la ricerca nel Deck usava `c.subtype === 'ritual'`
(il subtype REALE dei Mostri Rituale in questo dataset è
`category: 'ritual'` — `subtype: 'ritual'` esiste solo sulle MAGIE
Rituale, es. id 56 "Rito del Guerriero Nero") — corretto in
`c.category === 'ritual'`. **Lezione per un futuro caso simile**:
`subtype`/`category` sono campi DISTINTI in questo dataset con
significati diversi per tipo di carta (`subtype` per le Magie/Trappole:
normal/continuous/field/ritual/ecc.; `category` per i Mostri:
fusion/ritual/synchro/ecc.) — non assumere che lo stesso nome di campo
significhi la stessa cosa per un Mostro e per una Magia con lo stesso
"tema" (Rituale).

Verificato con un vero test attraverso il motore reale
(`tests/specs/pgd-lon-delayed-revival-batch10.spec.js`): danno solo da
scarto avversario, drenaggio LP ricorrente e trasferimento di controllo
PERMANENTE (sopravvive a `processTemporaryControlReturns()`),
distruzione di un bersaglio su entrambi i campi, autodistruzione solo
su Evocazione Normale (non Special), fusione Cimitero+Deck dopo un
mill avversario, rinascita ritardata scoperta in Posizione di DIFESA
(non Attacco) alla Standby Phase del proprio controllore, bonus
temporaneo al FLIP, cambio di Posizione con preferenza per il bersaglio
avversario, ricerca Rituale corretta per `category` invece di
`subtype`. Suite 45/45 verde (1 fallimento isolato di un test
preesistente e non correlato, rientrato al rilancio — vedi "Flakiness
nota" in tests/README.md).

Prossimo ID libero in `data/cards.json`: **1093**.

### Chiuse: undicesima ondata, 12 Mostri Effetto minori (id 1093-1104)

**Scoperta importante di questa ondata**: i 5 mostri "Special Summon
dalla mano bandendo N mostri di un Attributo dal Cimitero" (Aqua
Spirit/Garuda the Wind Spirit, rimandati nell'ottava ondata come
"servirebbe un nuovo flusso UI di Evocazione alternativa", + Soul of
Purity and Light/Spirit of Flames/The Rock Spirit di questa ondata) in
realtà NON servivano alcuna nuova infrastruttura: la coppia
`canSpecialSummonFromHand(ctx)`/`paySpecialSummonCost(ctx)` (nata per i
mostri Toon id 484/486, dispatchata da `trySpecialSummonFromHand`/
`canSpecialSummonFromHand` in duel-engine.js) è già completamente
generica — qualunque condizione/costo personalizzato basta scriverlo
nella coppia di hook, nessuna modifica al motore necessaria. La
valutazione della scorsa ondata ("richiede un nuovo flusso UI") era
sbagliata: aveva confuso "il costo è diverso da quello già visto"
con "serve un flusso diverso". **Lezione per un futuro caso simile**:
prima di rimandare una carta per presunta "nuova infrastruttura",
verificare se un meccanismo ESISTENTE (qui: la coppia generica già
usata da altre 2 carte) copre già il bisogno con un semplice hook
diverso, invece di fermarsi alla prima somiglianza superficiale con un
caso più complesso.

Anima di Purezza e Luce (1093, Soul of Purity and Light): SEMPLIFICAZIONE
dichiarata sulla scelta di QUALI 2 mostri LUCE bandire (le prime 2
trovate, non un'interfaccia a doppia scelta — `getSpecialSummonSacrificeCandidates`/
`pendingSpecialSummonSacrificeUid` supportano oggi una sola scelta per
volta). Malus -300 ATK ai mostri avversari SOLO nella LORO Battle
Phase, `gameState.atkDefBonus` ricalcolato ad ogni render dentro
`static()` — fuori da quella fase il malus sparisce da solo al render
successivo, nessuno store a scadenza necessario.

Spirito delle Fiamme (1094)/Lo Spirito della Roccia (1101): stesso
schema di 1093 ma con un solo mostro da bandire (nessuna scelta
necessaria) — bonus ATK condizionato rispettivamente alla PROPRIA
Battle Phase (1094) o a quella dell'AVVERSARIO (1101), stesso
meccanismo di `static()` ricalcolato ogni render.

Spirito della Brezza (1095): stesso schema di Fata Danzante (id 1065)
ma per la Posizione di ATTACCO invece di Difesa.

Sciame di Locuste (1096)/Sciame di Scarabei (1097): stesso schema
Ignition di Des Lacooda (id 1052) per coprirsi, poi al FLIP distruggono
rispettivamente 1 Magia/Trappola (`ctx.destroySpellTrap` diretto, stesso
stile di Neve Battente id 215 — nessun checkpoint `declareTarget`
usato per bersagli Magia/Trappola in questo dataset) o 1 mostro
(`ctx.destroyTargetedMonster`) dell'avversario.

Saggezza Corrotta (1098): `def.onPositionChange` (già esistente,
`ctx.fromPosition`/`ctx.toPosition`, stesso schema di Clown Stupido id
530) per rimescolare il Deck quando passa da Attacco a Difesa scoperta
— scatta solo per un cambio Posizione di un mostro GIÀ scoperto, mai
per un Flip (distinzione naturale del hook, nessun controllo aggiuntivo
necessario).

Il Macellaio del Bistrot (1099): `onDealsBattleDamage` per far pescare
2 carte all'avversario.

Il Piccolo Spadaccino di Aile (1100): Ignition, tributa 1 ALTRO proprio
mostro (`i !== ctx.index` esclude se stessa, a differenza di Unità
Scagliapietre 1102 sotto che la include) per +700 ATK fino a fine
turno via `ctx.grantTemporaryAtkDefBonus`.

Unità Scagliapietre (1102): Ignition, tributa 1 mostro Tipo Guerriero
(se stessa inclusa — il testo reale non la esclude, come Tirapiedi
Alato id 1054/Fata Isterica id 1083) per distruggere 1 mostro con DEF
pari o inferiore all'ATK di questa carta — l'ATK viene letto PRIMA
dell'eventuale auto-tributo, fedele al ruling reale (il costo si paga
prima che l'effetto scelga il bersaglio).

Spirito dell'Acqua (1103, Aqua Spirit)/Garuda lo Spirito del Vento
(1104): completano il ciclo "Spirit" insieme a 1094/1101 sopra, stesso
schema di Special Summon dalla mano bandendo dal Cimitero. **Bug reale
trovato e corretto PRIMA di scrivere queste due carte**: i due hook
`def.onOpponentStandbyPhase`/`def.onOpponentEndPhase` (duel-engine.js)
scansionavano SOLO la zona Magia/Trappola (`stFieldOf`), mai quella
Mostro — nessuna carta precedente ne aveva bisogno da un Mostro, quindi
il limite era passato inosservato. Esteso ad ANCHE scansionare
`fieldOf(opponent)` per entrambi i trigger (additivo: le chiamate
esistenti su 'st' restano identiche) — senza questa estensione, Spirito
dell'Acqua/Garuda non avrebbero mai reagito, nonostante il codice
sembrasse corretto isolatamente. Spirito dell'Acqua aggiunge il
bersaglio a `gameState.cannotChangePositionUidsThisTurn` (già
esistente, nato per Maledizione di Anubis id 655) per il vincolo "resta
in quella Posizione per il resto del turno" che Garuda non ha.
Verificato con il vero dispatcher (`DuelEngine.firePhaseTrigger`), non
solo chiamando l'hook a mano, proprio per intercettare bug di
questo tipo.

Rimandate con motivazione documentata: Steel Scorpion (serve un
conteggio "N TURNI da adesso, End Phase specifica dell'avversario" —
diverso e più preciso dei conteggi "N Standby/End Phase" già esistenti,
che contano fasi non turni completi); The Hunter with 7 Weapons (serve
un hook simmetrico "prima del calcolo danni" che dia il riferimento
all'avversario indipendentemente dal ruolo attacco/difesa — oggi
`grantDamageStepOnlyBonus` esiste ma nessun trigger automatico lo
imposta in base a un Tipo dichiarato); Thunder Nyan Nyan (autodistruzione
su una condizione continua — chiamare `ctx.destroyMonster` da dentro
`static()`, mai fatto finora in questo file, rischia interazioni non
verificate con il resto del ciclo di ricalcolo). **Twin-Headed Wolf,
segnalato qui come rimandato insieme a Mystical Knight of Jackal, è
stato invece chiuso nella dodicesima ondata subito dopo** — vedi quella
sezione: il hook mancante non era poi così mancante, esisteva già con
un nome diverso (`onDestroysMonsterInBattle`, nato per Bestia
Ingranaggio Antico id 833), semplicemente non l'avevo trovato subito.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-pgd-banish-summon-batch11.spec.js`): Special Summon
dalla mano con bando reale dal Cimitero per 5 carte diverse (1/1/2/1/1
mostri), bonus/malus ATK che compaiono e scompaiono esattamente nella
fase giusta, Ignition+FLIP per 2 carte con bersagli diversi (Magia/
Trappola vs mostro), rimescolamento Deck dopo un vero cambio Posizione,
pesca forzata dell'avversario, tributo che esclude se stessa vs tributo
che la include, distruzione condizionata al confronto DEF/ATK, cambio
di Posizione avversaria attraverso il vero dispatcher `firePhaseTrigger`
(non l'hook chiamato a mano) per Spirito dell'Acqua/Garuda. Suite
46/46 verde.

Prossimo ID libero in `data/cards.json`: **1105**.

### Chiuse: dodicesima ondata, 10 Mostri Effetto minori (id 1105-1114)

**Scoperta/errore importante di questa ondata, corretto sul momento**:
per Vampire Baby/Winged Sage Falcos/Cavaliere Mistico di Sciacallo
serviva un hook "quando QUESTA carta distrugge un mostro in battaglia"
(dal lato di chi VINCE lo scontro) — ho costruito un hook nuovo,
`def.onDestroysMonsterByBattle` (actions.js/`fireOnDestroy`, dispatchato
da TUTTI E 6 i punti di `resolveBattleDamage` che possono distruggere un
mostro), prima di accorgermi che esisteva GIÀ un hook per un bisogno
simile: `def.onDestroysMonsterInBattle` (usato da Bestia Ingranaggio
Antico id 833, Divoratempo id 480, Skull Servant id 526, Zombyra
l'Oscuro id 625, Flamberge del Male Infranto - Baou id 727), dispatchato
da `applyBattleDestroyBonus`. **I due NON sono intercambiabili**: quello
vecchio scatta SOLO quando l'ATTACCANTE vince distruggendo il difensore
(mai su un pareggio o quando è il DIFENSORE a distruggere l'attaccante),
quello nuovo copre invece tutti e 6 i casi. Piuttosto che rifare da capo
le 3 carte già scritte con il hook nuovo (rischiando di introdurre una
regressione nel codice di risoluzione battaglia già stabile toccando
`applyBattleDestroyBonus`), ho tenuto DELIBERATAMENTE i due hook
separati — vedi il commento su `fireOnDestroy` in actions.js per la
spiegazione completa, e Lupo Bicefalo (id 1114) qui sotto, che riusa
INVECE il hook vecchio (il suo bisogno reale rientra nel caso più
stretto già coperto). **Lezione per una futura sessione**: prima di
costruire un nuovo hook "quando questa carta fa X", cercare SEMPRE nel
file se un hook con un nome leggermente diverso ma lo stesso spirito
esiste già (qui `grep onDestroys` avrebbe bastato) — un controllo che
in questo caso ho saltato, scoprendo il duplicato solo mentre cercavo
di riusare la stessa infrastruttura per Lupo Bicefalo. Unificare i due
hook in uno solo resta un possibile lavoro di pulizia futuro, non
urgente (nessun conflitto pratico oggi: nessuna carta dichiara entrambi
i nomi).

Drago Tiranno (1105, Tyrant Dragon): `def.getExtraAttackCount` (già
esistente, dinamico, nato per Samurai Armato - Ben Kei id 721) per il
secondo attacco condizionato; stesso schema di Drago Teschio Demoniaco
(id 1044) per negare e distruggere le Trappole che lo bersagliano.
SEMPLIFICAZIONE dichiarata sulla restrizione "non Special Summonabile
dal Cimitero senza tributare 1 Drago" — nessun checkpoint condiviso
verifica un costo di questo tipo per OGNI possibile via di rianimazione
in questo motore (ognuna gestisce la propria logica in modo indipendente).

Vampire Baby (1106): `onDestroysMonsterByBattle` (nuovo) per registrare
il bersaglio distrutto, poi `onBattlePhaseEnd` (già esistente) per
completare la Special Summon se il bersaglio è ancora nel Cimitero
avversario alla fine della Battle Phase.

Bazoo il Divora-Anime (1107): nuovo store generico e riusabile
`gameState.untilOpponentTurnAtkDefBonus`/`untilOpponentTurnActiveUidsFor`
(game-flow.js/changeTurn, duel-engine.js/getEffectiveAtk-Def) per un
bonus ATK "fino alla fine del turno avversario" — stessa identica
semantica di `orgothAtkDefBonus` (id 395) ma senza duplicarla una terza
volta (dopo Orgoth e l'estensione di Spada Sigillante di Orichalcos id
396): la PRIMA volta che questo schema diventa davvero generico invece
di essere copiato a mano per ogni nuova carta.

Falcos il Saggio Alato (1108)/Cavaliere Mistico di Sciacallo (1109):
stesso `onDestroysMonsterByBattle`, Falcos con il vincolo aggiuntivo
"solo se il bersaglio era in Posizione di Attacco" — nuovo campo
`ctx.destroyedWasAttackPosition` sul hook, popolato da un 5° parametro
aggiunto a `fireOnDestroy` in TUTTI e 6 i punti che la chiamano in
`resolveBattleDamage` (actions.js), ognuno già sapendo la Posizione del
bersaglio al proprio interno.

Mummia Errante (1110): Ignition una volta per turno per coprirsi
(stesso schema di Des Lacooda id 1052). SEMPLIFICAZIONE dichiarata: la
clausola "riordina i mostri coperti" non ha alcun effetto funzionale in
questo motore (l'ordine delle caselle non conta per nessuna meccanica
esistente).

Apprendista Strega (1111): stesso identico schema di Hoshiningen (id
1074), Attributi invertiti (+500 OSCURITÀ, -400 LUCE).

Spirito Silvano (1112): Ignition, manda al Cimitero 1 Equip agganciata
a sé (`slot.card.equippedToUid`, già esistente) per infliggere 500 danni.

Yado Karu (1113): `def.onPositionChange` (già esistente) per rimandare
la mano in fondo al Deck quando passa da Attacco a Difesa. SEMPLIFICAZIONE
dichiarata: rimanda sempre TUTTA la mano invece di un numero/ordine a
scelta.

Lupo Bicefalo (1114, Twin-Headed Wolf): riusa l'ESISTENTE
`onDestroysMonsterInBattle` (non il nuovo `onDestroysMonsterByBattle` —
il suo bisogno reale, "questa carta distrugge in battaglia", rientra
nel caso più stretto "attaccante vince" già coperto), stesso schema
PERMANENTE di Bestia Ingranaggio Antico (id 833) per negare per sempre
gli effetti di un Mostro Flip distrutto, condizionato al controllare un
altro mostro Demone.

Rimandate con motivazione documentata (invariate dall'undicesima
ondata, non riaperte qui): Steel Scorpion, The Hunter with 7 Weapons,
Thunder Nyan Nyan.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-pgd-mrd-battle-destroyer-batch12.spec.js`): secondo
attacco condizionato ai mostri avversari residui, negazione+distruzione
di una Trappola bersaglio, Special Summon ritardata di un mostro
distrutto in battaglia (e nessuna Special Summon se non se n'è
distrutto nessuno), banditura di fino a 3 mostri con bonus ATK che
compare e scompare esattamente alla scadenza "fine turno avversario",
rimando in cima al Deck condizionato alla Posizione di Attacco (Falcos)
vs incondizionato (Sciacallo), Ignition per coprirsi, bonus/malus
Attributo su entrambi i lati, invio al Cimitero di un Equip specifico
con danno diretto, svuotamento della mano in fondo al Deck, negazione
permanente di un Mostro Flip condizionata alla presenza di un altro
Demone (e mai su un mostro non-Flip). Suite 47/47 verde.

Prossimo ID libero in `data/cards.json`: **1115**.

### Chiuse: tredicesima ondata, 3 Mostri Effetto minori (id 1115-1117)

Piccola ondata di chiusura rapida, resa possibile da una scoperta fatta
per caso mentre si verificava il registro CLAUDE.md: `def.onOwnAttackDeclare`
(dispatchato SOLO sull'ATTACCANTE stesso, mai un broadcast a tutto il
campo — nato per Jirai Gumo id 316, già usato anche per la correzione
di fedeltà di Spirit Ryu id 630 in una sessione precedente) è esattamente
l'hook che serviva per Scorpione dalle 8 Chele (1115): "quando questa
carta attacca un mostro coperto in Difesa, ATK diventa 2400 solo per il
calcolo dei danni" — combinato con `ctx.grantDamageStepOnlyBonus` (già
esistente, nato per Fuoco di Copertura id 852), zero infrastruttura
nuova.

Uomo con Wdjat (1116)/Cobraman Sakuzy (1117): entrambe "guarda 1 (o
tutte le) carta/e coperta/e dell'avversario, poi rimettila/e nella
posizione originale" — nessun cambiamento di stato nel testo reale
stesso, quindi implementate come una rivelazione nel log di duello
(`ctx.log`), senza toccare `isFaceDown`/posizione di alcuna carta.
Cobraman Sakuzy riusa lo stesso schema Ignition di Des Lacooda (id
1052) per coprirsi da sola.

**Correzione anche a CLAUDE.md in questa stessa sessione**: la sezione
"Carte con limiti noti" del file affermava ancora "1 sola Categoria A
genuinamente aperta, id 630" — una nota stale, perché id 630 (Spirit
Ryu) risultava già chiuso nel dataset reale (nessun `missingEffectNote`,
testo effetto già corretto). Corretto il file con una nota che spiega
cosa era successo, invece di lasciare un'affermazione falsa nel
documento di riferimento del progetto.

Verificato con un vero test attraverso il motore reale
(`tests/specs/pgd-damage-step-peek-batch13.spec.js`): il bonus ATK si
applica SOLO contro un bersaglio coperto in Difesa (non scoperto, non
altre Posizioni) e si consuma dopo una sola lettura, l'Ignition per
coprirsi funziona, le due carte "rivelatrici" non lanciano eccezioni e
non alterano lo stato delle carte coperte che rivelano. Suite 48/48 verde.

Prossimo ID libero in `data/cards.json`: **1118**.

### Chiuse: quattordicesima ondata, 4 Mostri Effetto minori (id 1118-1121)

Sovrano Oscuro Ha Des (1118, Dark Ruler Ha Des): "nega gli effetti dei
mostri distrutti in battaglia dai TUOI mostri Demone" — nuovo
`gameState.negatesFiendBattleKillsFor` (per-owner, ricalcolato ogni
render dal proprio `static()`), consultato nello stesso punto di
`fireOnDestroy` (actions.js) già usato da Onda di Diffusione (id 747):
stesso schema `monsterEffectsNegatedUidsFor`+`negatedEffectsForeverUids`,
condizione diversa (`opponentBattleCard.race === 'Demone'` invece di un
uid specifico) invece di un uid marcato in anticipo. SEMPLIFICAZIONE
dichiarata sulla restrizione "non Special Summonabile dal Cimitero" —
stesso limite già accettato per Drago Tiranno (id 1105, dodicesima
ondata): nessun checkpoint condiviso per OGNI possibile via di
rianimazione.

Gradius' Option (1119): riusa la coppia generica
`canSpecialSummonFromHand`/`paySpecialSummonCost` per scegliere 1
"Gradius" scoperto (già presente nel dataset, id 274) invece di un vero
costo. **Nuovo `def.destroysSelfIfLinkedMonsterMissing`
(recomputeStaticEffects, duel-engine.js)**: un mostro "agganciato" a un
ALTRO mostro (non un Equip) che si autodistrugge se quel mostro lascia
il Terreno — stesso posto/stesso spirito della pulizia già esistente
per gli Equip con bersaglio non più valido (zona 'st'), ma per la zona
Mostro: mutazione DIRETTA di stato (`graveyardOf`/`fieldOf`), **MAI
`ctx.destroyMonster`** — questa funzione gira dentro un render
(chiamata da `updateUI()`), e un `fireTrigger` a metà lo richiamerebbe
di nuovo a metà dello stesso render (stessa ragione già documentata per
l'equivalente Equip). Riusabile da qualunque futura carta con lo stesso
bisogno "resto in vita solo finché un altro mostro specifico resta
scoperto". ATK/DEF ricalcolati ogni render per essere identici a
Gradius (`gameState.atkDefBonus`).

Il Cacciatore dalle 7 Armi (1120, The Hunter with 7 Weapons): riusa
`def.damageStepBonus(ctx)` (già esistente, generico per
ATTACCANTE-O-DIFENSORE — `role`/`opponentCard`/`owner` — a differenza
di `onOwnAttackDeclare` usato per Scorpione dalle 8 Chele id 1115 nella
tredicesima ondata, che copre solo il ruolo di attaccante) per il
bonus "+1000 ATK contro il Tipo dichiarato" in ENTRAMBI i ruoli.
SEMPLIFICAZIONE dichiarata sul Tipo dichiarato (il più diffuso tra i
mostri scoperti dell'avversario, stesso schema già accettato per Virus
Infetta-Tribù).

Thunder Nyan Nyan (1121): autodistruzione condizionata a "controlli un
mostro non-LUCE" — **deliberatamente NON verificata dentro `static()`**
(stesso motivo di Gradius' Option sopra: un'azione distruttiva dentro
`static()` è rischiosa), ma tramite i monitor broadcast già esistenti
`onAnyNormalOrFlipSummon`/`onAnySpecialSummon` (nati per Misterioso
Burattinaio id 579/Torre d'Ossa Divora-Anime id 664, già riusati per
una reazione distruttiva da Tigre Re Wanghu/Kotodama id 1077/1078 nella
nona ondata) — controlla la condizione ad ogni nuovo mostro che entra
sul proprio Terreno, non ad ogni render. SEMPLIFICAZIONE dichiarata:
non copre un cambio di controllo diretto (senza una vera Evocazione)
che porti un mostro non-LUCE sotto il proprio controllo.

Rimandate con motivazione documentata (invariate): Banisher of the
Light, Ceremonial Bell, Drill Bug, Fushioh Richie, Great Dezard,
Helpoemer, Lava Golem, Moisture Creature, Patrician of Darkness,
Serpentine Princess, Skull Knight #2.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-mrd-linked-monster-batch14.spec.js`): la negazione di
Sovrano Oscuro Ha Des testata con una BATTAGLIA VERA via `resolveAttack`
(non un `fireTrigger` sintetico — il codice nuovo vive dentro
`fireOnDestroy`, una funzione interna di `actions.js` mai chiamata da
fuori), distinguendo un attaccante Demone da uno che non lo è; Gradius'
Option con ATK/DEF verificati identici a Gradius e autodistruzione
verificata dopo la rimozione di Gradius dal Terreno; Il Cacciatore
dalle 7 Armi con bonus applicato solo contro il Tipo dichiarato;
Thunder Nyan Nyan che sopravvive con soli mostri LUCE ma si autodistrugge
non appena arriva un mostro non-LUCE. Suite 49/49 verde.

Prossimo ID libero in `data/cards.json`: **1122**.

## Chiusa: Steel Scorpion (id 1122)

Testo reale: "A non Machine-Type Monster attacking 'Steel Scorpion' will
be destroyed at the End Phase of your opponent's 2nd turn after the
attack." Serviva un pezzo di infrastruttura genuinamente NUOVO: nessun
hook di questo motore scattava DIRETTAMENTE (non via Chain) sul mostro
PRESO DI MIRA da un attacco — esisteva solo il Chain-based
`onAttackDeclare`, riservato ad abilità OPZIONALI attivabili dal
difensore (es. Suijin/Kazejin "puoi annullare l'attacco"), mai a un
trigger FORZATO e automatico come questo.

Due pezzi nuovi, entrambi pensati generici e riusabili (non
hardcoded per questa carta sola), coerenti con la preferenza già
consolidata di costruire capacità condivise invece di hack per singola
carta:
- **`def.onBeingAttacked(ctx)`** (duel-engine.js, nuovo step "1.5)"
  dentro il dispatch di `TRIGGER.ON_ATTACK_DECLARE`, subito dopo il già
  esistente `onOwnAttackDeclare` lato attaccante): dispatch automatico
  sul difensore, `ctx = {card, attackerOwner, attackerIndex,
  targetIndex}`, rispetta `isMonsterCardEffectsNegated` come ogni altro
  hook automatico del motore.
- **`ctx.queueDelayedDestroyAtOpponentEndPhase(queuedByOwner,
  targetOwner, targetCard, ends)`** + **`DuelEngine.processDelayedDestroyAtOpponentEndPhase(endPhaseOwner)`**
  (agganciata in `enterEndPhase()`, game-flow.js, accanto alla già
  esistente `processSelfDestructAtOpponentEndPhase`): gemella
  concettuale di quel meccanismo pre-esistente, ma per un MOSTRO
  ALTRUI (l'attaccante, non chi mette in coda l'effetto) e in zona
  `fieldOf` invece di `stFieldOf` — il conteggio decrementa solo alla
  End Phase di `targetOwner` (il TURNO DELL'ATTACCANTE, non quello del
  controllore di Scorpione d'Acciaio: il testo dice "2° turno
  dell'avversario dopo l'attacco", cioè il turno di chi ha attaccato).
  Riusabile SENZA alcuna modifica per qualunque futura carta con lo
  stesso identico bisogno "distruggi un mostro specifico fra N turni
  avversari da adesso".

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-steel-scorpion-delayed-destroy.spec.js`): una
battaglia REALE via `resolveAttack` (non un `fireTrigger` sintetico)
mette in coda la distruzione solo se l'attaccante NON è di Tipo
Macchina, con `targetOwner` uguale al proprietario dell'ATTACCANTE (non
del difensore); il conteggio non decrementa alla End Phase sbagliata e
distrugge il mostro solo alla 2ª End Phase corretta, finendo nel
Cimitero del suo vero proprietario. Suite 50/50 verde.

Prossimo ID libero in `data/cards.json`: **1123**.

## Chiusa: Helpoemer (id 1123)

Testo reale (errata 2020): "Cannot be Special Summoned from the GY. At
the end of your opponent's Battle Phase, if this card is in the GY
because it was destroyed by battle: Make your opponent discard 1
random card. This card must be in the GY to activate and to resolve
this effect."

Nuova capacità generica del motore, non un hack per questa sola carta:
**`def.canTriggerFromGraveyard: true`** (duel-engine.js, dentro
`firePhaseTrigger`) — prima d'ora quella funzione scansionava solo
`fieldOf`/`stFieldOf`/`fieldSpellOf` del proprietario per OGNI trigger
di fase (Standby/End/BattlePhaseEnd/ecc.), mai il Cimitero. Ora, per
qualunque `handlerName`, scansiona anche `graveyardOf(owner)` per le
carte che dichiarano questo opt-in — diverso da
`fireOwnMainPhase1GraveyardActivations` (quello è per la propria Main
Phase, con un `canActivate` esplicito, pensato per un'attivazione
VOLONTARIA one-shot) e da `def.activatableFromGraveyard` (reattivo a un
evento specifico, non a un cambio fase): qui il trigger è FORZATO e
automatico, riusabile SENZA modifiche da qualunque futura carta con lo
stesso bisogno "se sono nel Cimitero quando scatta questa fase" (Standby,
End, BattlePhaseEnd o qualunque altro nome di handler esistente/futuro).

Il resto riusa infrastruttura già esistente, zero nuova plumbing:
`gameState.battleDestroyedThisTurnFor` (tracker per-proprietario nato
per Sentinella Cremisi/Lady Panther nella dodicesima ondata) per sapere
se QUESTA istanza è finita nel Cimitero per una distruzione in
battaglia; `ctx.discardRandomFromHand` (helper condiviso, stesso già
usato da Criosfinge id 761). Il vincolo "Battle Phase dell'AVVERSARIO,
non la propria" si legge confrontando `ctx.gameState.currentPlayer`
(chi vive la fase) con `ctx.owner` (il controllore di Helpoemer).

SEMPLIFICAZIONE dichiarata e documentata in `cards.json`: "non può
essere Special Summonata dal Cimitero" non è applicata — richiederebbe
controllare ~105 chiamate a `ctx.specialSummon` sparse in
`card-effects.js` (nessun checkpoint condiviso "Special Summon dal
Cimitero" esiste in questo motore, a differenza di `ctx.declareTarget`
per il targeting), sproporzionato per questa singola clausola di una
sola carta — stesso principio di sproporzione già accettato per le
carte "Categoria B" di questo stesso file.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-helpoemer-graveyard-battle-phase-end.spec.js`): una
battaglia REALE via `resolveAttack` (non un `fireTrigger` sintetico)
che distrugge Helpoemer fa scartare 1 carta all'avversario alla
successiva `firePhaseTrigger('onBattlePhaseEnd', ...)`; Helpoemer nel
Cimitero ma NON distrutto in battaglia (es. scartato) non fa scattare
nulla; durante la PROPRIA Battle Phase (non quella dell'avversario)
l'effetto non scatta nemmeno se distrutto in battaglia. Suite 51/51
verde.

Prossimo ID libero in `data/cards.json`: **1124**.

## Chiusa: Falena Perfetta, Drago Meteora, Drago Nero Meteora (id 1124-1126)

Richiesta esplicita dell'utente, FUORI dal backlog "prima serie" sopra
(l'utente ha chiesto queste 3 carte per nome durante la sessione, dopo
aver notato la loro assenza confrontando il dataset): la terza
evoluzione della catena di Falena Piccola/Bozzolo dell'Evoluzione, e la
coppia vanilla Drago Meteora + la sua Fusione con Drago Nero Occhi
Rossi. Zero infrastruttura nuova per tutte e 3 — puro riuso:

- **Falena Perfetta / Perfectly Ultimate Great Moth (1124)**: identica a
  Larva Mostruosa (id 50, 2° turno)/Grande Falena (id 52, 4° turno), già
  implementate prima di questa sessione — stesso `canSpecialSummonFromHand`/
  `paySpecialSummonCost` che sacrifica "Falena Piccola" (id 522)
  equipaggiata con "Bozzolo dell'Evoluzione" (id 157). L'unica differenza
  reale del testo ("6° turno o SUCCESSIVO", non un turno esatto) ha
  richiesto una piccola variante dell'helper esistente
  (`findPetitMothReadyForCocoonSummonAtLeast`, confronto `>=` invece di
  `===`) — le altre due non l'avevano mai avuta perché nessun mazzo di
  test le aveva mai lasciate scadere oltre la finestra.
- **Drago Meteora / Meteor Dragon (1125)**: Mostro Normale vanilla puro
  (Drago/TERRA/6/1800/2000) — nessuna registrazione in `card-effects.js`,
  stesso stile di "Falena Piccola" id 522.
- **Drago Nero Meteora / Meteor Black Dragon (1126)**: Mostro Fusione
  vanilla (Drago/FUOCO/8/3500/2000), Fusione di "Drago Nero Occhi Rossi"
  (id 12) + "Drago Meteora" (id 1125) — riusa `def.fusionMaterials`, già
  generico (stesso identico schema di "Drago Nero del Teschio" id 102,
  Fusione di Teschio Evocato + Drago Nero Occhi Rossi).

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-moth-meteor-dragons-batch15.spec.js`): Falena Perfetta
NON Special Summonabile al 5° turno proprio, SÌ esattamente al 6°, SÌ
anche al 7° ("o successivo"), con Falena Piccola effettivamente
sacrificata; Drago Meteora verificato come vanilla puro senza handler;
Drago Nero Meteora trovato come fondibile da `getFusableExtraDeckMonsters`
ed Evocato per davvero via `ACTIONS.fusionSummon`, con entrambi i
materiali finiti nel Cimitero. Suite 52/52 verde (2 fallimenti visti in
un primo giro, "Obbligo d'attacco condiviso" e "Soldato di Susa",
confermati FLAKY preesistenti e non collegati a queste 3 carte — spariti
al secondo giro completo, senza alcuna modifica al codice).

Prossimo ID libero in `data/cards.json`: **1127**.

## Chiusa: Campanella Cerimoniale, Skull Knight #2 (id 1127-1128)

Le due carte del backlog rivalutate come più fattibili a fine sessione
(raccomandazione data all'utente, approvata): a differenza di Banisher
of the Light (floodgate enorme "ogni carta mandata al Cimitero viene
bandita", centinaia di punti da toccare, resta rimandata) e delle altre
7 ancora aperte, queste due erano più abbordabili di quanto la nota
originale suggerisse.

- **Campanella Cerimoniale / Ceremonial Bell (1127)**: il vero testo
  ("entrambi i giocatori tengono la mano rivelata") è puro effetto di
  UI, zero logica di gioco. Nuovo floodgate GLOBALE booleano
  `gameState.bothHandsRevealed` (non per-owner: riguarda sempre
  entrambe le mani), ricalcolato in `recomputeStaticEffects()`,
  consultato da `renderBotHand()` (game-flow.js) — che fino ad ora
  mostrava SEMPRE e SOLO dorsi per la mano del bot, una scelta di design
  deliberata documentata nel suo stesso commento ("così si vede a colpo
  d'occhio quante carte ha in mano senza che il gioco 'bari' mostrandone
  il contenuto"). Con Campanella Cerimoniale scoperta (di ENTRAMBI i
  lati), quella funzione mostra le vere carte (`createCardElement`,
  senza handler di click/drag: resta pura informazione, mai
  interagibile) invece dei dorsi.
- **Skull Knight #2 (1128)**: la nota originale sottostimava la
  fattibilità ("serve sapere se il Tributo di questa carta è servito a
  un'Evocazione Tributo di un mostro Demone SPECIFICO — `onSacrificedForTribute`
  non porta con sé questa informazione"). Soluzione: nuovo parametro
  OPZIONALE `summonedCard` su `def.onSacrificedForTribute`/
  `DuelEngine.notifySacrificedForTribute(owner, tributedCard, summonedCard)`
  — passato SOLO dai 3 chiamanti che rappresentano una vera Evocazione
  Tributo (`performTributeSacrifice`/`performGearCastleTributeSacrifice`
  in actions.js, l'equivalente in bot.js), MAI dagli altri 6 chiamanti
  esistenti che sacrificano una carta come COSTO di qualcos'altro
  (un'Ignition, un costo d'attacco tipo Guerriero Pantera id 399, un
  Special Summon da Cimitero come Metamorfosi id 886) — additivo al
  100%, ogni chiamante non toccato continua a funzionare identico con
  `ctx.summonedCard` semplicemente `null`. Riusabile SENZA alcuna
  modifica da qualunque futura carta con lo stesso bisogno "sapere COSA
  è stato Evocato con questo Tributo". Il resto riusa il pattern già
  esistente di Ultima Volontà (id 555, Fisher-Yates diretto sull'array
  del Deck) invece di un nuovo helper "rimescola e basta" — nessun'altra
  carta ne ha ancora bisogno.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-srl-ceremonial-bell-skull-knight-batch16.spec.js`):
la mano del bot mostra solo dorsi di default, le vere carte (verificate
via `data-uid` nel DOM) con Campanella Cerimoniale scoperta, e torna
coperta se la carta lascia il Terreno; Skull Knight #2 Special Summona
una nuova copia dal Deck SOLO quando il mostro Evocato Tributo è
davvero di Tipo Demone, MAI per un Tipo diverso, MAI per un sacrificio
senza alcuna Evocazione Tributo associata (simulando un costo
d'attacco). Suite 53/53 verde.

Prossimo ID libero in `data/cards.json`: **1129**.

## Chiusa: Great Dezard, Fushioh Richie (id 1129-1130)

Coppia con evoluzione a stadi collegata, approvata dall'utente come
seguito naturale della raccomandazione precedente ("più lavoro ma
fattibile con l'esperienza già accumulata"). Confermato più complessa
della stima iniziale (la clausola "annulla+distruggi Magie/Trappole che
bersagliano questa carta", identica su ENTRAMBE le carte, si è rivelata
un vero limite strutturale — vedi sotto), ma il resto si è chiuso senza
sorprese, riusando quasi solo infrastruttura già esistente:

- **Great Dezard (1129)**: contatore per-istanza `card._battleDestructionCount`,
  incrementato dal già esistente `def.onDestroysMonsterByBattle`
  (nato nella dodicesima ondata di questa sessione) — a 2 distruzioni in
  battaglia, sblocca un Ignition che tributa Great Dezard per Special
  Summonare Fushioh Richie da mano o Deck. Lo slot liberato dal tributo
  di Great Dezard stesso è SEMPRE quello usato per Fushioh Richie
  (tributare libera sempre esattamente 1 casella): nessuna ricerca di
  slot separata necessaria, una piccola scorciatoia che evita del tutto
  il problema "il Terreno potrebbe essere pieno".
- **Fushioh Richie (1130)**: `cannotNormalSummon: true` e nessun'altra
  via di Evocazione registrata — l'UNICO modo in cui entra in campo è
  tramite l'`activate()` di Great Dezard, stesso schema già consolidato
  di Larva Mostruosa/Grande Falena (id 50/52). "Puoi girarti a faccia in
  giù in Difesa una volta per turno" riusa LETTERALMENTE lo stesso
  pattern già scritto per Mummia dall'Ascia Gigante (id 1071, ottava
  ondata) — `canActivate`/`activate` con `ctx.hasUsedOncePerTurn`/
  `ctx.markUsedOncePerTurn`, zero differenze concettuali. "Quando si gira
  scoperta, Special Summon 1 Zombie dal Cimitero" riusa `onFlip`, lo
  stesso hook di qualunque altro Mostro Flip — e siccome un Flip Summon
  MANUALE (cambio Posizione da coperto in Difesa a scoperto in Attacco)
  già scatena `TRIGGER.ON_FLIP` in questo motore (bug trovato e corretto
  in una sessione precedente, non in questa), non è servito costruire
  nulla di nuovo per il "si gira scoperta" nemmeno nel caso di un cambio
  Posizione manuale, solo per una rivelazione da battaglia.

**SEMPLIFICAZIONE dichiarata su ENTRAMBE le carte** (vedi
`missingEffectNote` in `cards.json`): la clausola "annulla l'attivazione
e gli effetti di ogni Magia/Trappola che bersaglia QUESTA carta, poi
distruggila" non è implementata. Non è un limite di pigrizia ma
strutturale: richiederebbe sapere, PRIMA che una Magia/Trappola a
bersaglio si risolva, se il bersaglio scelto è ESATTAMENTE questa
istanza — il meccanismo esistente per il pre-annuncio del bersaglio
(`def.declaredTargeting`, consultato da Campo di Riryoku id 636/La
Perla del Drago id 652/Scudo Magico Tipo-8 id 689) espone solo la
CATEGORIA dichiarata dalla carta in cima alla Chain (count/cardType/
race), mai l'istanza precisa presa di mira. Verificato leggendo la
registrazione reale di Campo di Riryoku: anche LUI, di fronte allo
stesso limite, nega SEMPRE la Magia a bersaglio-singolo-mostro in cima
alla Chain indipendentemente da CHI bersaglia — una semplificazione già
accettata altrove, ma che qui sarebbe stata scorretta (proteggerebbe
OGNI mostro proprio, non solo questa carta specifica) e quindi non
riproposta. Stesso identico limite già documentato per le 9 carte
"Categoria B checkpoint di targeting" di questo file — nessuna nuova
carta aggiunta a quel gruppo, semplicemente le prime due che lo
condividono AL DI FUORI di quel gruppo originario.

Verificato con un vero test attraverso il motore reale
(`tests/specs/lod-great-dezard-fushioh-richie-batch17.spec.js`): il
contatore di Great Dezard blocca l'Ignition sotto 2 distruzioni e lo
sblocca esattamente a 2 (hook chiamato direttamente via ctx, stesso
stile già accettato per `onDestroysMonsterByBattle` nella dodicesima
ondata, dato che la battaglia REALE che lo dispaccia è già verificata
altrove); l'attivazione vera tributa Great Dezard e Special Summona
Fushioh Richie nello slot liberato; Fushioh Richie non Evocabile
Normalmente; il self-flip Ignition rispetta il limite una-volta-per-
turno; l'`onFlip` Special Summona un mostro Zombie SOLO se presente nel
Cimitero. Suite 54/54 verde.

Prossimo ID libero in `data/cards.json`: **1131**.
