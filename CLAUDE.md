# Yu-Gi-Oh! Millennium Duel Arena — contesto per Claude

Duello Yu-Gi-Oh completo in HTML/JS puro, **nessun build, nessun bundler,
nessun framework**: ogni pagina è un file `.html` apribile anche solo con
doppio click (`file://`), con `<script src="...">` in sequenza fissa.
Autore unico (Jacopo/jacopofa92), repo Git **privato**
`jacopofa92/millennium-duel-arena` (prima `YuGiOhGame`) a un solo branch
attivo (`main`).

**Dove gira (dal 2026-10-11)**: sito su Cloudflare Workers
(`https://millennium-duel-arena.core10games.workers.dev`), ricostruito
da solo a ogni push su main con `npm run pubblica` (copia minificata in
`dist/`). GitHub Pages non si usa più (il repository è privato). Server
Multiplayer su Render: `millennium-duel-arena-relay`. APK di produzione in
`C:\AndroidDev\YuGiOhGameAndroidProd`, puntata al sito Cloudflare. La suite
su GitHub parte solo a mano o su pull request (2.000 minuti al mese del piano
Free per i repository privati); a ogni push gira solo il controllo sintassi.

**Mappa corrente breve**: leggere prima `PROJECT_MAP.md`. Contiene
architettura, fonti di verità, comandi, rischi e stato dei lavori attivi senza
dover rileggere tutta la cronologia di questo file. Questo documento resta la
memoria dettagliata delle decisioni e dei fix precedenti.

**Rispondi sempre in italiano in chat** in questo progetto (preferenza
esplicita dell'utente, vale per ogni sessione).

## Avvio e test rapidi

- Il gioco stesso non ha comandi di build: si apre direttamente
  `duelMonstersCore.html` (o le altre pagine) nel browser.
- **"Duello Demo" (`duelMonstersCore.html`) è il banco di prova standard** per
  ogni modifica alla logica di duello — è dove va verificata a mano
  qualunque modifica prima di considerarla finita. Nota: il suo stato
  iniziale non rispecchia perfettamente un duello vero (vedi
  `js/engine/duel-sandbox.js`) — se un test lì fallisce in un modo strano,
  verifica prima che non sia un limite della sandbox stessa.
- `npm test` esegue la suite di regressione Playwright in `tests/`
  (104 file spec ad oggi — il numero invecchia da solo, contarli con
  `ls tests/specs/*.spec.js` invece di fidarsi di questa riga) — vedi
  `tests/README.md` per la struttura e come scriverne di nuove. Gira
  anche in CI (`.github/workflows/test.yml`) ad ogni push/PR su `main`.
- ⚠️ **NON lanciare la suite completa di propria iniziativa**: è
  l'utente a decidere quando ("Non avviare la suite di test. Ti dico io
  quando avviarla"). Si eseguono gli spec toccati o a rischio, filtrando
  per nome (`node tests/run-all.js <parte-del-nome>`), e nel messaggio di
  commit si dichiara che la suite completa non è stata eseguita.
- `node scripts/check-syntax.js` (`npm run check`) passa `node --check`
  su tutti i .js in un paio di secondi: è il modo più veloce per
  scoprire se una modifica ha rotto un file — molto prima che i test
  falliscano tutti insieme con un errore criptico.
- **Controllo pre-commit** (`.githooks/pre-commit` → `scripts/pre-commit.js`):
  sintassi dei .js in stage, accenti corrotti nelle righe aggiunte (la
  "è" trasformata in una A con tilde più un simbolo; una riga che deve
  citarli davvero porta il marcatore `[ok-accenti]`), BOM UTF-8, e
  `data/cards.json` in stage senza il file
  generato. Si attiva UNA volta per clone con `npm run hooks` (imposta
  `core.hooksPath`, che non viaggia col repository); su questo PC è già
  attivo. Se ferma un commit, si corregge il problema: non si salta con
  `--no-verify`.
- Multiplayer richiede `server/server.js` (Node nativo, nessuna
  dipendenza) — vedi `README.md` per come avviarlo.

## Struttura del codice

Mappa completa e ragionata in **`docs/architecture/GUIDA_RIUTILIZZO.md`** (leggerla prima di
un refactor ampio) — riassunto:

```
js/engine/   motore: duel-engine.js, actions.js, game-flow.js,
             card-effects.js (helper condivisi + convenzioni) e
             card-effects-1..8.js (i blocchi register per-carta),
             effect-templates.js
js/ai/       ai-controller.js (facciata) + ai-medium.js/ai-hard.js/ai-shared.js/bot.js
js/ui/       card-renderer.js, effects.js, duel-cinematics.js, icon-library.js...
             cartoteca-view.js (+ .css): LA Cartoteca, UNA sola implementazione montata da cartoteca.html (pagina dedicata).
             Dalla 1.4.47 index.html e' SOLO il menu: Cartoteca, Profilo, Impostazioni, Regole, Negozio, Sfide e Duello Libero
             sono pagine dedicate raggiunte da link (niente piu' viste SPA/router: musica e loader restano coerenti, il menu e'
             leggero). Una schermata nuova = una pagina nuova; la logica condivisa sta in componenti (js/ui/*-view.js).
js/data/     cards-data.generated.js (NON editare a mano, vedi sotto), cards-db.js, deck/personaggi,
             challenges-db.js (catalogo Sfide, vedi sfide.html)
js/challenges/  challenge-tracker.js — motore di tracking delle Sfide (recordProgress generico
                 type+match), aggancio da js/duel-session.js e js/engine/duel-engine.js
js/multiplayer/  network.js, mp-lobby.js, multiplayer.js (client WebSocket)
js/cloud/    cloud-sync.js (account, salvataggio, carte custom), auth-gate.js
             (accesso obbligatorio), auto-sync.js (carica mentre giochi),
             server-date.js (ora del server), supabase-config.js
server/      server.js — relay WebSocket puro, nessuna logica di gioco lato server
tests/       suite di regressione versionata (Playwright) — vedi tests/README.md
```

**Dati carte**: `data/cards.json` è la fonte; `scripts/build-cards-data.js`
lo compila in `js/data/cards-data.generated.js`, che il gioco carica
davvero. Dopo ogni modifica a `cards.json` rilanciare
`node scripts/build-cards-data.js` — editare il file generato a mano si
perde al prossimo build.

## Convenzioni consolidate (dalle sessioni precedenti)

- **Copertura effetti**: l'obiettivo è ogni carta con l'effetto reale
  pienamente implementato, non solo il sottoinsieme facile/sicuro.
- **Lavoro sul backlog carte**: procedere senza fermarsi ripetutamente a
  chiedere "continuo?" tra una carta e l'altra — andare avanti finché non
  si è genuinamente bloccati.
- **Fonte di verità per un effetto carta**: [YGOPRODeck](https://ygoprodeck.com)
  come riferimento primario per testo/regole reali.
- **Trappole**: vanno sempre Set coperte prima di poter essere attivate —
  mai attivabili direttamente dalla mano.
- **Carte duplicate/imprecise** in `cards-db.js`/`cards.json`: si
  cancellano, non si segnalano soltanto.
- **Immagini carta**: sempre un ritaglio della sola illustrazione dentro
  la cornice CSS della carta — mai uno scan intero pre-renderizzato,
  anche quando disponibile.
- **Estensione delle foto: SEMPRE `.jpg`, mai `.jpeg`** (carte, mappe,
  personaggi, arene, sfondi). Prima convivevano le due e ogni file nuovo
  costringeva a indovinare quale usare nel codice; convertite tutte
  (1162 file rinominati) e sorvegliato da
  `tests/specs/guardrail-estensione-immagini.spec.js`, che boccia anche un
  riferimento a `images/` che punta a un file che non esiste (tranne una lista
  chiusa di file opzionali, dichiarata nel test). Un file nuovo si salva
  già come `.jpg`.
- **Commenti nel codice**: generosi e orientati al PERCHÉ (vincoli
  nascosti, invarianti, bug specifici aggirati) — il codice deve restare
  editabile a mano, senza assistenza AI, da chi lo legge dopo. Non
  spiegare il COSA quando i nomi già lo dicono.
- **I nomi delle carte Yu-Gi-Oh sono i nomi ufficiali Konami in italiano**
  (allineati il 2026-10-21, 625 carte rinominate: elenco "prima/ora" e carte
  rimaste invariate col motivo in `docs/planning/NOMI_KONAMI_RINOMINA.md`).
  **Il codice cerca molte carte PER NOME** (`name.includes('Amazzone')`,
  `name === 'Sorelle Arpie'`, `startsWith('Lady Arpia')`, `mentionsNames`/
  `treatedAsNames`, i pacchetti a tema del Negozio...): cambiare un nome, o
  aggiungere una carta che una di queste ricerche troverebbe, cambia il
  comportamento SENZA errori. Lo sorveglia `tests/specs/guardrail-nomi-carte.spec.js`
  (registro congelato in `tests/data/ricerche-per-nome.json`): se fallisce,
  guardare cosa trova ora la ricerca; se il cambiamento e' voluto,
  `node tests/helpers/ricerche-per-nome.js --aggiorna`. **Una nuova ricerca per
  nome nel motore va scritta cosi' che trovi le carte volute e poi registrata
  col comando qui sopra**; per identificare una carta preferire `card.id` o
  un campo (`archetypes`, `race`...) al nome. Le carte che il nuovo nome farebbe
  entrare in una ricerca ma che prima ne erano fuori sono escluse a mano
  (`ESCLUSE_PER_NOME` in `card-effects.js`, `ECCEZIONI_NOME` in `shop-catalog.js`).
  Se un nuovo nome contiene un apostrofo, dentro una stringa `'...'` serve `\'`.
  **Carte doppie eliminate (2026-10-21)**: 8 carte erano la stessa carta reale di un'altra
  (616, 617, 163, 747, 668, 1024, 723, 609): tolte da dati, effetti e immagini; i loro id NON si
  riusano mai. Chi le possedeva le ritrova sulla carta che resta (`CARTE_ELIMINATE` in
  `js/save-manager.js`, vale per ogni salvataggio che entra). Spec `carte-doppie-eliminate`.
- **Illustrazioni alternative delle carte (2026-10-21)**: 43 carte hanno 73-74 illustrazioni ufficiali
  in più (`images/cards/alt/<id>-<n>.jpg` + miniature in `alt/thumbs/`, catalogo in
  `js/data/artwork-alternativi.js`, cernita in `docs/planning/ARTWORK_ALTERNATIVI_CERNITA.md`).
  Ogni illustrazione ha uno `sblocco` = la FONTE che la regala, di due tipi (scelti dall'utente):
  **bacino a sorteggio** (`torre-piano-15`, `torre-conquistata`, `torneo:<id>` a Difficile: ad ogni
  riuscita si vince UNA sola illustrazione a caso fra quelle ancora da sbloccare, finché il bacino non è
  vuoto; `ArtworkAlternativi.premiaDaFonte`, chiamata da `Rewards.forTournament` e da `chiudi()` di
  `js/modes/torre-mode.js`) e **tappa fissa** (`storia:<campagna>:<capitolo>`: oggi 5 capitoli di Memorie
  Proibite a Difficile, una volta sola; `premiaStoria`, chiamata da `avanza` in story-progress.js; il Regno
  delle Ombre non ne dà di proposito). Nessuna Sfida le regala più (provato e tolto). Per spostare una
  illustrazione si cambia solo il suo `sblocco`. La scelta è per carta
  (`save.artworks`, `ArtworkAlternativi.scegli`) e vale ovunque perché `getCardImagePath`/`getCardThumbPath`
  la leggono: **ogni pagina che carica `card-renderer.js` deve caricare anche `artwork-alternativi.js`**
  (lo sorveglia `guardrail-pagine-con-carte`). UI: bollino in alto a destra sulla tessera (solo dove c'è
  `data-card-badges`) e fila di miniature nella scheda condivisa `card-detail.js` (bloccate in grigio,
  anteprima possibile, pulsante spento con la frase che dice come si sblocca). **Un'illustrazione
  originale NON compare fra le alternative**: l'originale è confrontata pixel per pixel con quelle
  ufficiali (per 251 Sepoltura Sciocca nessuna coincide, quindi entrambe le ufficiali sono alternative).
  Spec `artwork-alternativi`.
- **L'IA non deve attivare carte che le fanno male (2026-10-22, segnalato giocando: Kaiba in vantaggio di
  LP si sacrifica un mostro forte con Metamorfosi per una Fusione scarsa; i bot potenziano il mostro del
  GIOCATORE).** Cause: il bot attivava ogni carta "attivabile" (il commento diceva "le carte di risposta
  sono tutte puro vantaggio", falso) e dove una carta non dice come scegliere il bersaglio prendeva il
  PRIMO dell'elenco, che parte dal giocatore. Rimedi, da riusare per ogni carta nuova:
  `def.aiCanActivate(ctx)` (veto per-carta per carte con un costo o una scelta che il bot non sa
  valutare) passa dal filtro unico `AI_SHARED.attivazioneSensata` (js/ai/ai-shared.js), che vale per la
  mano, per le carte Set e per le risposte in Catena (`chooseChainResponse`) e in piu' prova davvero le
  Magie Terreno (le mette un istante, ricalcola i bonus, misura chi guadagna), blocca i costi in LP che
  lasciano meno di 2000 LP e le Trappole di solo potenziamento fuori dalla Battle Phase; la scelta del bot
  fra i bersagli (`sceltaAutomaticaDelBot` in card-effects.js, usata da `chooseFieldCardTarget`) manda i
  potenziamenti sul proprio mostro piu' forte e le rimozioni sul piu' forte avversario — SOLO per le carte
  a bersaglio singolo ("bersaglio 1 mostro"): le carte a piu' passi (Riryoku, Scatola Magica) decidono con
  `pickForBot`/`favorisce`; i Rituali sacrificano la combinazione di mostri che costa meno
  (`performRitualTribute`), non i mostri di Livello piu' alto. **Il controllo a tappeto e'
  `tools/audit-attivazioni-ia.js`** (passo base: ogni Magia/Trappola attivabile su campi di prova, deve dare
  zero sospetti; `--reattive`: ogni Trappola in risposta a un attacco/Evocazione/Magia, con/senza la Trappola;
  `--mostri`: abilita' dei mostri ed Evocazioni Speciali; `--mai`: carte che nessun campo di prova rende
  attivabili) e lo sorveglia `tests/specs/ia-attivazioni-sensate.spec.js`. I falsi sospetti valutati a mano
  stanno elencati nel tool con il motivo: un nuovo sospetto va letto carta per carta, non silenziato.
  **Copertura (1.4.53)**: il passo base prova anche campi costruiti sulle razze/attributi/nomi citati dal testo
  della carta, un campo "pieno" (Cimiteri da 5+, Magie/Trappole scoperte avversarie, Deck da cercare) e la
  Standby Phase; `--reattive` ha anche Flip Summon, Evocazione Speciale, Mostro Settato, effetto di un mostro,
  Trappola del giocatore e Magia a bersaglio (`--non-scattate` elenca le Trappole mai viste in azione, `!!` se
  nemmeno il passo base le attiva; `--log` stampa il registro dei casi peggiorativi). Restano fuori per
  costruzione le carte che chiedono la Draw Phase avversaria (216), nomi/Terreni rari (482, 612, 817),
  "nessuna carta in mano" (745), e le Spirit Message (867-870, solo via Tavola del Destino).
  **Trovato dall'audit**: le Continue con solo `static` (206, 212, 240, 371, 426, 634, 310, 221) non avevano
  `activate`, quindi nessuno poteva attivarle: ora ce l'hanno (e un `aiCanActivate`). Una Continua nuova senza
  `activate` e senza un hook reattivo e' una carta morta.
- **Bordo carta mobile "troppo spesso"**: quasi sempre un problema di
  rapporto arte/cornice, non della proprietà CSS `border` in sé.

## Stato dell'infrastruttura (audit di sessione, verificato con evidenze)

Fatto finora:
- ✅ Suite di test versionata (`tests/`, 15 spec, ora anche in CI).
- ✅ `try/catch` ai punti d'ingresso chiave (`handleCardClick`,
  `safeCallCardHandler`, listener globali `error`/`unhandledrejection`) —
  un bug in una singola carta non blocca più l'intero motore.
  `safeCallCardHandler` copre ormai OGNI chiamata a un handler per-carta
  in `duel-engine.js` (~30 punti: `activate`/`static` più tutti i trigger
  reattivi `onXXX` in `fireTrigger`/`firePhaseTrigger` e affini) — prima
  copriva solo `activate`/`static` (`resolveChain`/`recomputeStaticEffects`),
  lasciando `onFlip`/`onDestroy`/`onSummon`/ecc. capaci di risalire la
  pila e bloccare una Chain o una `resolveAttack` a metà.
- ✅ Escaping HTML (`escapeHtml()` in `game-flow.js`) per nome/effetto
  carta ovunque finiscano in `innerHTML` — le carte personalizzate
  (`crea-carta.html`) sono testo libero dell'utente, quindi un vettore
  XSS reale (rilevante anche in multiplayer).

Rischi noti, ancora aperti (deliberatamente non affrontati finora — bassa
priorità o richiedono un refactor ampio):
- ~~`card-effects.js` è ~19.000 righe in un solo file~~ — **CHIUSO**: era
  arrivato a 23.800 righe, ora è diviso in un file di helper condivisi
  più 8 parti di sole registrazioni (vedi il bullet dedicato più sotto).
- Nessun modulo ES/bundler: `<script>` globali con ordine di carico
  fisso, la stessa lista di ~20-30 script è duplicata a mano in almeno
  4-8 pagine HTML (rischio di drift se una pagina viene aggiornata e le
  altre no). Il MARKUP della topbar (non la lista script in sé) è stato
  affrontato con lo stesso spirito — vedi `js/ui/topbar.js` più sotto.
- `gameState` è un "God Object" (100+ proprietà top-level, letto/scritto
  da oltre 1000 punti) — nessuna incapsulazione/validazione.
- `actions.js` e `game-flow.js` non usano il pattern IIFE (a differenza
  di `duel-engine.js`/`card-effects.js`): ogni funzione top-level lì è un
  vero global su `window`.
- Nessun linting/formatting configurato, nessun cache-busting sui tag
  `<script>`.
- Alcune carte hanno un `missingEffectNote` in `data/cards.json` — il
  numero si conta con `grep missingEffectNote data/cards.json`, non si
  riporta qui (invecchierebbe). Vedi la sezione "Carte con limiti noti"
  in fondo a questo file per come sono divise: nessuna descrive più uno
  scostamento aperto, sono promemoria su limiti del motore o carte in cui
  la scelta la fa il motore.
- ✅ `declaredTargeting` (card-effects.js, vedi il commento sul campo in
  cima al file): nuovo campo dichiarativo generico che permette a una
  carta reattiva sulla Chain (es. Campo di Riryoku id 636) di sapere COSA
  sta per bersagliare l'attivazione in cima, PRIMA che si risolva
  davvero — il motore normalmente sceglie i bersagli dentro `activate()`,
  che gira DOPO che la finestra di risposta si è già aperta (ordine
  opposto al gioco reale). Oggi lo dichiarano solo le 14 carte
  effettivamente necessarie a Campo di Riryoku (636)/La Perla del Drago
  (652)/Scudo Magico Tipo-8 (689), non un audit dell'intero dataset —
  vedi il commento sul campo per la lista.
- ✅ `batchToken` opzionale su `ACTIONS.destroySpellTrap` (duel-engine.js,
  vedi il commento sulla funzione): collega tra loro più chiamate a
  `destroySpellTrap` che fanno parte della STESSA attivazione (es.
  Piumino delle Arpie id 291: un `destroySpellTrap` per carta in un
  `forEach`), così Trappola Fasulla (id 600, `redirectsTrapDestroyToSelf`)
  protegge OGNI Trappola del lotto, non solo la prima. Additivo/opzionale:
  ogni chiamante che non lo passa (la stragrande maggioranza) si comporta
  esattamente come prima.
- **`repeatableWhileContinuous: true`** (card-effects.js, già esistente
  prima di questa sessione — usato da Offerta Suprema id 559/Pietra del
  Potere Nero Pece id 751, ora anche da Drago Nero Pece id 404/Spada
  Sigillante di Orichalcos id 396): permette di ricliccare una carta
  Continua GIÀ scoperta in campo (zona 'st') per rilanciarne `activate()`
  da capo — la carta stessa distingue gli stati leggendo il proprio
  `ctx.card` (es. `equippedToOwner` impostato o no). **Prima di
  dichiarare "serve nuova infrastruttura" per una carta con un'abilità
  Ignition riattivabile mentre è già in campo (es. lo stacco volontario
  di un Mostro Union, o l'estensione di un Equip già agganciato),
  controllare se questo meccanismo già esistente basta** — copre più
  casi di quanto sembri a prima vista dal solo missingEffectNote. Per una
  durata "fino a fine turno avversario" abbinata (es. id 396), riusa lo
  stesso schema store-separato + scadenza in `changeTurn()` già rodato da
  Orgoth l'Implacabile (`orgothActiveUidsFor`/`orgothAtkDefBonus`, id
  395) — copiare quel pattern, non reinventarlo.
- ✅ **`redirectToBanishIfFlagged(owner, card)` (duel-engine.js, vedi il
  commento sulla funzione)**: nuovo flag PER-ISTANZA (`card.mustBanishOnLeavingField`,
  non per-definizione — il caso d'uso è "SOLO questa copia, perché
  Special Summonata da una carta specifica, deve finire bandita invece
  che nella sua destinazione normale", non "questo id ha sempre questo
  comportamento") consultato da un helper condiviso, chiamato da
  `destroyMonster`/`notifySacrificedForTribute` (duel-engine.js) e da
  ciascuno dei ~6 punti "a mano" di `resolveBattleDamage`
  (js/engine/actions.js, mai centralizzata per la distruzione in
  battaglia) — `returnMonsterToHand` ha invece un controllo dedicato
  (non passa mai dal Cimitero). Usato per la prima volta da Cerchio
  degli Inferi (id 498). **Chiariva l'analisi precedente su id 498/808**
  (che sembravano entrambi bloccati dalla stessa "rimozione
  decentralizzata"): id 498 chiedeva di REINDIRIZZARE una rimozione già
  in corso verso il Cimitero — soluzione "correggi SUBITO DOPO" (il
  chiamante ha già spostato la carta, il redirect la sposta di nuovo,
  nessuna intercettazione PRIMA della rimozione necessaria), quindi
  trattabile toccando solo i pochi punti che mandano un MOSTRO al
  Cimitero. id 808 sembrava strutturalmente diverso (deve IMPEDIRE un
  bando PRIMA che avvenga, non correggerlo dopo) — ma vedi il bullet su
  `blockBanishFromField` qui sotto: chiuso comunque nella stessa
  sessione, il vincolo reale ("finché scoperta sul Terreno") si è
  rivelato riguardare un numero di punti molto più piccolo del temuto.
- ✅ **`blockBanishFromField(ctx, card)` (card-effects.js, in cima al
  file): id 808 (Uovo Giurassico Miracoloso) chiuso**. La stima
  originale di "~28 chiamanti di ACTIONS.banish da controllare" contava
  OGNI bando del motore, ma il testo reale protegge SOLO "finché
  scoperta sul Terreno" — un bando dal Cimitero/mano/Deck resta sempre
  permesso. Filtrando per QUESTO, i punti da toccare erano solo 11 (10
  in card-effects.js + 1 in `getBanishFusableExtraDeckMonsters`,
  duel-engine.js) — un ordine di grandezza in meno. A differenza di
  `redirectToBanishIfFlagged` (che corregge DOPO), qui serve davvero
  intercettare PRIMA della rimozione dal Terreno: `def.cannotBeBanishedWhileOnField`
  (flag per-definizione, non per-istanza — a differenza di id 498 qui
  sopra, questa protezione è sempre vera per OGNI copia della carta, non
  solo per una Special Summonata in un modo specifico), controllato
  PRIMA di ogni `field[i] = null` che precede un `ctx.banish`/
  `ctx.banishTemporarily`. **Lezione per un futuro caso simile**: quando
  un conteggio "N chiamanti da toccare" sembra scoraggiante, verificare
  SEMPRE se il vincolo reale della carta è più stretto del generico "in
  ogni caso" (qui: solo dal Terreno) — il conteggio vero può essere
  molto più piccolo.
- ✅ **Destiny Board implementato (id 192 Santuario Oscuro, quasi
  chiusa — resta solo una SEMPLIFICAZIONE di nicchia documentata, vedi
  la tabella sotto)** — prima vera "nuova meccanica di vittoria
  alternativa" di questo motore, utile come riferimento se ne servisse
  un'altra in futuro. 5 carte nuove aggiunte al dataset (id 866 Destiny Board, id
  867-870 Spirit Message "I"/"N"/"A"/"L" — le ultime 3 clonano la
  registrazione di 867 tramite `cloneEffectOf`, meccanismo già esistente
  in card-effects.js, mai usato prima di questa sessione). Pattern
  usati, tutti già esistenti nel motore, nessuno inventato da zero:
  nuovo hook `onOpponentEndPhase` in `firePhaseTrigger` (duel-engine.js,
  gemello di `onOpponentStandbyPhase` già esistente, solo per la End
  Phase); vittoria automatica controllata in `checkGameOver()`
  (game-flow.js, `hasDestinyBoardComplete`), stesso schema di
  `hasExodiaAssembled`/`EXODIA_PIECE_IDS` per Exodia il Proibito — un
  controllo "clean" fuori dalla risoluzione di un singolo effetto, MAI
  dentro `endDuel()` direttamente da una carta. La Spirit Message
  Special Summonata da Santuario Oscuro non è un token separato: la
  STESSA carta viene mutata da Magia a Mostro (`card.type` riassegnato
  a runtime, con level/race/attribute/attack/defense aggiunti) — stesso
  stile di mutazione diretta già usato altrove nel motore per casi
  simili (es. `card.attack -= 500` permanente di Drago Berserk id 110).
  SEMPLIFICAZIONE dichiarata e documentata nella carta: quel Mostro non
  è "immune agli effetti Carta eccetto Destiny Board" (solo "non può
  essere bersaglio d'attacco") — quell'immunità sarebbe condizionata
  alla forma Mostro della carta, mentre i floodgate di immunità
  esistenti (`cannotBeTargetedByCardEffects` ecc.) sono flag fissi per
  definizione: estenderli avrebbe richiesto toccare il checkpoint di
  targeting condiviso usato da altre 3 carte, per un'interazione di
  nicchia (serve avere sia Destiny Board sia Santuario Oscuro scoperti
  insieme).
- ✅ **id 781 (Roc dalla Valle della Foschia) chiuso — generalizzato
  `ctx.discardChosenFromHand`**: l'hook `onSentToGraveyardFromHand` di
  781 esisteva già, ma scattava solo per gli scarti passati dai due
  helper condivisi (`discardRandomFromHand`/`discardChosenFromHand`), non
  per lo scarto-come-COSTO di un'ALTRA carta — 22 siti in
  `card-effects.js` facevano ancora `hand.splice(...)` +
  `graveyard.push(...)` a mano, bypassando l'hook. Migrati tutti e 22 a
  `ctx.discardChosenFromHand(owner, index)` (18 sostituzioni dirette + 1
  riscritto a loop, id 111 Anima del Berserker, che scarta l'intera mano
  in un colpo solo — non una singola sostituzione). In 2 di quei 22 siti
  (Genesi del Vampiro id 656, Scavo Fossile id 823) l'indice della carta
  da rianimare dal Cimitero era calcolato PRIMA dello scarto: ora il
  CANDIDATO si sceglie prima (per valore/Livello, come da testo) ma
  l'INDICE si ricalcola per `uid` DOPO lo scarto, così un'eventuale
  reazione che altera il Cimitero durante `discardChosenFromHand` (es.
  proprio 781 che si rimescola nel Deck) non lascia un indice invalido o
  spostato. **Lezione per un futuro caso simile**: quando una carta
  reagisce a "scartata dalla mano" ma sembra coprire solo un
  sottoinsieme dei casi reali, verificare SEMPRE se gli scarti-come-costo
  di ALTRE carte passano dallo stesso helper condiviso o da uno
  splice/push scritto a mano — è un pattern che si ripete ogni volta che
  si introduce un nuovo choke point generico dopo che il codice
  preesistente aveva già molte implementazioni dirette.
- ✅ **id 192 (Santuario Oscuro) chiuso per intero — nuovo
  `gameState.immuneToCardEffectsExceptDestinyBoardUids`**: mancava solo
  che il Mostro generato da Santuario Oscuro fosse "immune agli effetti
  Carta eccetto Destiny Board". Stesso schema PER-UID ricalcolato ad
  ogni render di `cannotBeAttackTargetUids` (già esistente per "non può
  essere bersaglio d'attacco" sulla stessa carta), ma consultato dal
  checkpoint di targeting condiviso (`declareCardEffectTarget`,
  duel-engine.js) invece che da `resolveAttack` — a differenza di
  `def.cannotBeTargetedByCardEffects` (fisso per DEFINIZIONE, es. i 3
  Dei Egizi), questo è per-ISTANZA: la stessa carta id 867-870 nella sua
  forma Magia normale (piazzata da Destiny Board senza Santuario Oscuro)
  resta bersagliabile come sempre. Chiude id 192 allo stesso identico
  standard già accettato per le altre 9 carte con una nota simile (vedi
  Categoria B qui sotto): copre il targeting via quel checkpoint
  condiviso, non ogni possibile effetto di massa non mirato (nessun
  checkpoint del genere esiste in questo motore).
- ✅ **id 396 (Spada Sigillante di Orichalcos) chiuso per intero — nuovo
  `findSpellTrapQuickEffectCandidates` + coppia di hook
  `canActivateAsQuickEffect`/`activateAsQuickEffect`**: mancava solo la
  terza clausola, un vero Effetto Veloce ("scarta 1 carta per
  distruggere 1 carta scoperta sul Terreno, una volta per turno")
  utilizzabile anche durante il turno avversario — prima genuinamente
  impossibile, perché questo motore apre una finestra di priorità SOLO
  in risposta a un'attivazione altrui già in corso (`openActivationWindow`)
  o a un trigger nominato (`onAttackDeclare`/`onOpponentSummon`/ecc.),
  MAI spontaneamente ad ogni cambio fase con "nessuno ha fatto nulla".
  Soluzione: `findSpellTrapQuickEffectCandidates` (duel-engine.js) è la
  gemella-per-zona-'st' di `findMonsterQuickEffectCandidates` già
  esistente per i mostri (stesso opt-in `def.canRespondAsQuickEffect`),
  aggiunta alla stessa lista di candidati di risposta dentro
  `openActivationWindow` — così id 396 (già scoperta in campo) può
  rispondere quando SI APRE una Chain per qualunque motivo, proprio
  o dell'avversario, coprendo il caso reale più comune di un Effetto
  Veloce. Poiché la carta ha GIÀ due abilità diverse dietro
  `canActivate`/`activate` (aggancio ed estensione), la terza usa una
  coppia di hook SEPARATA (`canActivateAsQuickEffect`/
  `activateAsQuickEffect`) invece di sovraccaricare la stessa coppia con
  un terzo comportamento nascosto dietro un flag di contesto — il
  dispatch in `resolveChain`/`openActivationWindow` è già generico per
  nome (`def[link.handlerName](link.ctx)`), quindi aggiungere un nuovo
  nome di hook è stato sufficiente, nessuna modifica al dispatcher
  stesso. **Riusabile per qualunque futura carta con lo stesso bisogno**
  (un Effetto Veloce distinto dalle altre abilità della stessa carta,
  attivabile in risposta a una Chain già aperta). SEMPLIFICAZIONE
  residua onesta, stesso standard delle altre chiusure di questa
  sessione: risponde solo quando la finestra è già aperta da
  un'attivazione altrui, non in ogni momento teorico del turno
  avversario in cui non succede nulla — quella richiederebbe una vera
  finestra di priorità ad OGNI cambio fase, toccando ogni singolo punto
  di transizione fase del motore, sproporzionato per questa carta.
  Verificato con un test di integrazione REALE attraverso
  `DuelEngine.activateCard` + `openActivationWindow` (non solo gli hook
  isolati), stesso pattern di `chain-resolution.spec.js`.
- ✅ **Audit di consistenza codice↔tracking (richiesto esplicitamente
  dall'utente dopo aver notato contraddizioni)**: `grep missingEffectNote
  data/cards.json` non è l'unica fonte di verità sulle carte con un
  comportamento diverso dal testo reale — un commento "SEMPLIFICAZIONE"
  in `card-effects.js` può descrivere un vero scostamento SENZA che la
  carta abbia mai avuto un `missingEffectNote` corrispondente in
  `cards.json` (es. id 459/128/267 sotto: il codice lo ammetteva
  onestamente da tempo, ma `cards.json` non lo tracciava — non erano
  contraddizioni introdotte in questa sessione, solo mai state
  sincronizzate). Un audit mirato (grep di frasi-segnale come "il testo
  reale è/richiede", "invece di", "non implementata", distinte dalle
  banali "sceglie da sola il bersaglio invece di un'interfaccia dedicata"
  già accettate ovunque) ha trovato 4 casi reali, di cui 3 chiusi e 1
  documentato onestamente come ancora aperto — vedi la tabella
  aggiornata subito sotto. **Lezione per una futura sessione**: quando i
  due si disallineano, il commento nel codice va sempre preso come
  fonte di verità più aggiornata (è lì che si scrive mentre si
  implementa/scopre il limite) — `cards.json` va allineato AD esso, non
  il contrario.
  - ✅ **id 459 (Ninja d'Assalto) chiuso**: era un effetto Ignition
    normale (solo propria Main Phase) invece del vero Effetto Veloce del
    testo. Bastava `canRespondAsQuickEffect: true` sulla registrazione
    già esistente — infrastruttura già pronta da PRIMA di questa
    sessione (`findMonsterQuickEffectCandidates`, la stessa già usata da
    Spadaccino Mistico LV6 id 865), zero lavoro nuovo su
    `duel-engine.js`. A differenza di id 396, questa carta ha UNA sola
    abilità: nessuna coppia di hook dedicata necessaria, stesso
    `canActivate`/`activate` per click manuale e risposta.
  - ✅ **id 128 (Buco Trappola senza Fondo) chiuso**: "distruggilo e
    bandiscilo" finiva solo nel Cimitero (mai bandito). Bastava
    impostare `card.mustBanishOnLeavingField = true` sul bersaglio
    PRIMA di `ctx.destroyMonster` — flag PER-ISTANZA già esistente
    (nato per Cerchio degli Inferi id 498 in questa stessa sessione,
    vedi sopra), che ridirige da sola la destinazione dopo la
    distruzione senza bypassare gli hook "quando questa carta viene
    distrutta". Il commento originale sosteneva "nessuna zona di bando
    separata per i mostri in questo motore" — falso: il motore bandisce
    mostri regolarmente (Buco Dimensionale id 201, Guerriero D.D. id
    179, ecc.), il commento era semplicemente obsoleto.
  - ✅ **id 267 (Gilford il Fulmine) chiuso**: Evocava con i 2 Tributi
    standard di un Livello 8 invece dei 3 richiesti dal testo reale
    della carta (non un floodgate di potenza come i 3 Dei Egizi, è
    testo letterale). Aggiunto `card.id === 267` alla stessa eccezione
    già esistente in `getTributesRequired` (cards-db.js) per gli Dei
    Egizi — una riga, stesso pattern.
  - ⏳ **id 630 (Spirit Ryu) — genuinamente ancora aperta, ORA
    documentata con un `missingEffectNote` (prima non lo era)**: è un
    effetto Ignition attivabile una volta in qualunque momento della
    propria Battle Phase invece che nel preciso istante in cui la carta
    dichiara un attacco, e il bonus dura fino a fine TURNO
    (`ctx.grantTemporaryAtkDefBonus`, l'unico store con quella scadenza
    in questo motore) invece che fino a fine Battle Phase. Correggerlo
    per intero servirebbe due pezzi di infrastruttura nuovi per una
    carta sola (un trigger "questa carta ha appena dichiarato un
    attacco" — oggi esiste solo la risposta del DIFENSORE,
    `onAttackDeclare`; e uno store di durata scaduto a fine Battle
    Phase, non fine turno) — stesso principio di sproporzione già
    accettato per id 396/id 192, lasciato volutamente così ma ORA
    tracciato in modo onesto invece che silenzioso.
- ✅ **`ctx.destroyTargetedMonster(targetOwner, targetIndex, options)`
  (duel-engine.js, ACTIONS, subito dopo `declareTarget`)**: risposta
  diretta alla domanda "devo aggiornare il checkpoint di targeting a
  mano per ogni carta nuova?" — combina `declareTarget(...)` +
  `destroyMonster(...)` in una sola chiamata per il caso più comune
  ("un effetto sceglie 1 mostro e lo distrugge"), tornando
  `{ allowed, targetOwner, targetIndex, card }` (`card` è il mostro
  EFFETTIVAMENTE distrutto, letto prima della rimozione — utile per il
  log anche dopo un redirect di Specchietto della Fata). Non rende il
  checkpoint automatico al 100% (capire se un effetto è "mirato" o "di
  massa" resta una scelta di chi scrive la carta, non deducibile dal
  solo `destroyMonster`), ma rende il percorso corretto quello più
  comodo da scrivere invece di uno a due passaggi facile da dimenticare
  o sbagliare nell'ordine — usarlo SEMPRE per una nuova carta con
  quell'esatto schema. Accompagnato da un test guardrail
  (`targeting-checkpoint-guardrail.spec.js`, analisi statica del
  sorgente, nessun duello coinvolto): non impedisce di dimenticarsi il
  checkpoint su una carta nuova (nessuna euristica testuale è
  abbastanza affidabile da distinguere "mirato" da "di massa" senza
  falsi positivi), ma impedisce una REGRESSIONE silenziosa — il numero
  di chiamate reali al checkpoint non deve mai scendere sotto una soglia
  nota, altrimenti vuol dire che una chiamata esistente è stata rimossa
  senza essere sostituita.
- ✅ **Cinematica di vittoria condivisa da OGNI condizione di vittoria
  istantanea/alternativa (`FX.playInstantWinCinematic`,
  `js/ui/effects.js` + `triggerInstantWin`, `game-flow.js`)**: stessa
  identica priorità già usata da `FX.playMonsterSummonEffect` per
  un'Evocazione di alto Livello — 1) filmato dedicato se esiste
  (`video/vittorie/<kind>.mp4`, via `VisualEffects.getVideoFor`, oggi la
  cartella `video/` non esiste ancora nel repository, quindi ricade
  sempre sul fallback), altrimenti 2) una sequenza CSS (bagliore dorato
  in successione sulle carte coinvolte, poi un flash + banner col testo
  della condizione a schermo intero). `endDuel()` scatta solo DOPO che
  la cinematica finisce, non prima — `gameState.instantWinCinematicPlaying`
  blocca chiamate rientranti a `checkGameOver()` (che `updateUI()`
  richiama molto spesso) mentre la cinematica gira, altrimenti
  ripartirebbe da capo ad ogni render. Nata per Exodia (5 pezzi in
  mano, `triggerExodiaWin`), generalizzata SUBITO dopo (nella stessa
  sessione, su richiesta esplicita dell'utente: "stessa cosa per altre
  eventuali vittorie istantanee") a Destiny Board (5 carte in zona
  Magia/Trappola, mostrata a schermo per ENTRAMBI i lati a differenza
  della mano — `triggerDestinyBoardWin`) ed Elefante Volante (nessun
  "insieme di pezzi", una singola carta — `triggerFlyingElephantWin`,
  `pieceElements` sempre vuoto). `findCardElementsByUid(containerId,
  uids)` è l'helper condiviso da tutti e 3 per trovare i DOM element
  delle carte coinvolte (per il giocatore umano: mano = `playerHand`,
  Terreno/Magia-Trappola = `playerFieldBoard`/`botFieldBoard` — la mano
  del bot non è mai mostrata a schermo, quindi resta sempre vuota per
  lui). **Una FUTURA vittoria istantanea deve solo chiamare
  `triggerInstantWin(kind, bannerText, logMessage, playerWon,
  pieceElements)` da `checkGameOver()`** — non reinventare guardrail/
  cinematica/log/endDuel da capo, né copiare una funzione trigger*Win
  intera: sono già tutte una chiamata sola a `triggerInstantWin`.
- ✅ **Topbar condivisa (`js/ui/topbar.js` + `js/ui/topbar.css`)**:
  mitiga (SOLO per la topbar, non per l'intera lista `<script>` — quel
  rischio più ampio resta aperto, vedi sotto) il rischio di drift tra
  pagine duplicate a mano documentato più sotto in questo file. Un
  audit ha trovato lo stesso blocco `.topbar`/`.back-btn`/`.topbar-title`
  (pulsante Indietro + titolo) copiato quasi identico in 11 pagine, con
  derive già in corso (z-index diverso tra cartoteca.html/
  creazione-deck.html, `letter-spacing`/`font-size` leggermente diversi
  qua e là, breakpoint mobile ASSENTI DEL TUTTO in duello-sandbox.html —
  bug reale, corretto passando al componente condiviso). Migrate tutte
  e 11: `PageTopbar.render('#topbarMount', { icon, title, subtitle?,
  backHref?, onBack? })` sostituisce il markup scritto a mano, torna
  l'elemento `.topbar` creato per chi ha bisogno di aggiungerci
  qualcosa in più (`.appendChild(...)` — usato da creazione-deck.html
  per il badge "N/30 Deck" e cartoteca.html per "N carte"). Due pagine
  avevano un vincolo REALE non rimovibile, preservato con un override
  minimo mirato invece di forzare il valore canonico: creazione-deck.html
  (`z-index: 40`, perché `.editor-header` è una seconda barra sticky
  appena sotto che deve restarci sotto) e multiplayer.html
  (`position: relative` invece di `sticky`, perché sotto viene iniettata
  l'intera arena di duello con una propria gestione dello scroll). La
  Cartoteca aveva anche una legenda orfana ("⛔ effetto non
  implementato · 🟡 effetto implementato parzialmente") dimenticata
  dalla rimozione dei badge di sviluppo in una sessione precedente —
  ripulita qui.
- ✅ **Continuità musicale tra pagine, bug reale trovato e chiuso
  (`js/audio/audio-manager.js`)**: la musica sembrava "fermarsi e
  riprendere in ritardo" ad ogni cambio pagina, a volte "ripartire da
  capo" anche con la stessa traccia — non un problema di logica (il
  meccanismo di continuità, posizione+traccia salvate in
  `sessionStorage` e ripristinate al `canplay`, era già corretto), ma
  l'**autoplay bloccato dal browser su `file://`** ad ogni nuovo
  caricamento di pagina: `tryPlay()` andava già in `catch` e provava a
  mostrare un hint (`showHint()`), ma **`#musicHint` non esisteva in
  NESSUNA pagina del progetto** — l'elemento non è mai stato costruito
  nel markup, quindi l'utente non vedeva alcun segnale, e la musica
  ripartiva solo al PROSSIMO click a caso su un elemento qualsiasi
  (spesso il click che porta via dalla pagina, in un ciclo che sembra
  "non riprendere mai"). Corretto creando `#musicHint` dinamicamente da
  `initAudioManager()` (stesso schema già usato per `<audio
  id="bgMusicAudio">`: nessuna pagina deve costruirselo da sé) — resta
  visibile finché l'utente non interagisce davvero (non un timeout
  fisso che sparirebbe comunque), poi si nasconde subito quando
  `audio.play()` va a buon fine. Verificato empiricamente con
  Playwright: dopo un click su una pagina precedente e la navigazione a
  `duelMonstersCore.html` con la stessa traccia forzata via
  `?music=...`, `currentTime` riprende correttamente dal punto lasciato
  (non da 0) non appena l'utente clicca di nuovo. Aggiunta anche, nella
  stessa funzione, la regola CSS nativa `@view-transition { navigation:
  auto; }` (Chrome/Edge 126+, "Cross-Document View Transitions") per
  ammorbidire il passaggio "brusco" tra una pagina e l'altra — puro CSS
  ignorato senza rischi sui browser che non la conoscono, **niente
  intercettazione di click**: funziona automaticamente sia per un click
  su un `<a href>` sia per un `location.href = ...` impostato da JS
  (usato ovunque nel progetto), senza toccare nessuno degli
  onclick/handler di navigazione già esistenti (`topbar.js`,
  `handleBackClick` di duello-libero.html, ecc.) — un'alternativa
  deliberatamente più sicura a un'intercettazione manuale dei click,
  che avrebbe richiesto toccare ogni punto di navigazione del progetto
  con un rischio di regressione reale.
  **Vicolo cieco verificato e scartato, per non riprovarci in una
  sessione futura**: un trucco "avvia l'audio muto (sempre permesso dal
  browser), poi togli il muto via script senza alcun gesto dell'utente"
  sembrava funzionare nei test — ma solo perché `page.evaluate()` di
  Playwright concede LUI STESSO un gesto implicito a qualunque `play()`
  invocata al suo interno (confermato: perfino un `play()` NON muto,
  senza alcun trucco, riusciva se chiamato da dentro `page.evaluate()`
  — un artefatto del test, non il comportamento reale). Con l'audio
  creato ed eseguito dal normale script della pagina (nessun
  `evaluate()` di mezzo, lo stesso percorso di un utente vero), perfino
  l'autoplay MUTO viene rifiutato su `file://` senza un gesto reale.
  **Non esiste un modo lato client per aggirare l'autoplay bloccato dal
  browser quando manca un vero gesto dell'utente su quella pagina — è
  una policy di sicurezza deliberata, non un bug risolvibile in JS.**
  L'unica cosa realistica resta reagire il più presto possibile al
  PRIMO gesto vero (click, tocco, tasto, persino uno scroll — tutti e 4
  ascoltati in `tryPlay()`), così nella normale navigazione la musica
  riprende nello stesso istante in cui l'utente clicca quello che è
  venuto a fare, senza una vera "azione di sblocco" percepita a parte.
  **Lezione di metodo per testare `audio.play()`/autoplay con
  Playwright in futuro**: mai fidarsi di un test che chiama `play()`
  direttamente dentro `page.evaluate()` — verificare SEMPRE lasciando
  che sia lo script della PAGINA STESSA (quello che gira naturalmente
  al caricamento, non un comando iniettato da Playwright) a chiamarlo.
- ⚠️ **SUPERATO dalla 1.4.47: `index.html` non ha più viste né router
  (`registerView`/`showView`, `.app-view`, `@scope`, id prefissati): il
  menu è solo un elenco di link a pagine dedicate, una copia per schermata.
  Il testo qui sotto resta come cronologia e come elenco di insidie
  (ordine degli `<script>`, id mancati dallo script di prefissazione).**
- ✅ **Profilo e Duello Libero fusi dentro `index.html` come viste SPA**
  (richiesta esplicita dell'utente, con scope ridotto in corsa da "tutte
  le pagine menu" a solo queste 2 — le altre 8 pagine menu, Negozio/
  Impostazioni/Regole/Tornei/Crea Carta/Multiplayer/Creazione Deck/
  Cartoteca, restano pagine `.html` separate come prima, INVARIATE):
  stesso identico problema di fondo dei fix audio/transizione qui sopra
  (musica che si interrompe, transizione brusca) ma risolto alla radice
  per queste 2 sole pagine invece che mitigato — restando DENTRO lo
  stesso documento non c'è alcuna vera navigazione, quindi nessuna
  musica da far ripartire. Router SPA generico e riusabile (non
  hardcoded per queste 2 viste): `registerView(name, initFn)` +
  `showView(name)` + `hideAllShells()` + `showMenuFromView()`, in un
  proprio `<script>` posizionato SUBITO dopo `#menuToast`, PRIMA del
  markup di ogni vista fusa — **deliberatamente PRIMA e non insieme al
  resto della logica menu/gate (che sta molto più in basso nel file):
  lo `<script>` di ogni vista chiama `registerView(...)` al proprio
  caricamento (l'ordine dei tag `<script>` in una pagina HTML è
  sequenziale), quindi la funzione `registerView` deve già esistere
  quando l'HTML della vista viene parsato — bug reale trovato e corretto
  in questa stessa sessione, prima che il router finisse in fondo al
  file insieme al resto: `registerView is not defined`.** Ogni vista
  fusa è un `<div class="app-view" id="view-<nome>">` nascosto di
  default (`display:none`), con CSS isolata via `@scope (#view-<nome>)
  { :scope { ... } ... }` (il selettore `:scope` dentro il blocco
  sostituisce sia il vecchio `body`/`body::before` della pagina
  originale sia `:root` per le variabili CSS SOLO di quella vista — es.
  `--cube-w` ha un valore diverso in Profilo, 150px, e in Duello Libero,
  190px: se fosse rimasta su `:root` globale le due viste si
  sovrascriverebbero a vicenda; `--gold`/`--gold-strong`, uguali
  ovunque, sono invece SOLO globali in `:root`, non ripetute in ogni
  vista) — supportato nella versione Chromium/Edge imbarcata da
  Playwright in questa sessione (151.0.7922.34), quindi le regole CSS
  originali di ogni pagina sono state incollate quasi pari pari, senza
  riscrivere ogni selettore a mano. Ogni id della pagina originale è
  stato prefissato (`profilo-`/`libero-`) per non collidere con gli
  stessi id di un'altra vista fusa o del menu — fatto con uno script
  PowerShell usa-e-getta (sostituzioni mirate su una lista nota di id,
  non un regex globale alla cieca) invece che a mano: **quello script
  però NON copre ogni forma in cui un id può comparire in JS** — ha
  mancato 3 casi reali in questa sessione, tutti corretti a mano dopo un
  controllo mirato: un confronto diretto di stringa
  (`event.target.id === 'diffModal'`, non un `getElementById`), un id
  passato come primo argomento posizionale a una funzione invece che
  scritto come stringa letterale al punto d'uso (`PageTopbar.render('#topbarMount', ...)`),
  e un id passato per NOME a una funzione wrapper che lo passa a sua
  volta a `getElementById` (`getRandomOption('fieldSelect')` dentro
  Duello Libero) — **per una futura vista fusa, dopo lo script di
  prefissazione automatica, cercare ESPLICITAMENTE anche questi 3
  pattern a mano, il regex meccanico non li vede.** Inizializzazione
  LAZY per ogni vista (`VIEW_INITIALIZERS`/`viewsAlreadyInitialized`):
  lo script di una vista non gira al caricamento di `index.html`, solo
  alla PRIMA volta che viene mostrata, e lo stato resta intatto (filtri,
  nome inserito, ecc.) tornando al menu e rientrando. **Bug reale
  trovato e corretto**: `showMenuFromView()` inizialmente chiamava solo
  `showMenu()` (che mostra `#menuShell` ma non nasconde le `.app-view`
  già visibili) invece di `hideAllShells()` + `showMenu()` — il sintomo
  sarebbe stato la vista appena lasciata ancora visibile SOTTO il menu
  al ritorno. Il pulsante "Sfida un Duellante" nella vista Profilo (che
  nella pagina originale navigava a `duello-libero.html`) ora chiama
  `showView('duello-libero')` invece di navigare — stesso principio,
  applicare la stessa conversione ad ogni link che colleghi due viste
  ORA entrambe fuse, non solo agli `href` verso pagine ancora esterne.
  **La pagina standalone `duello-libero.html` (a differenza di
  `profilo.html`, ormai raggiungibile solo aprendola a mano) NON è
  stata rimossa e NON va rimossa**: resta il bersaglio hardcoded reale
  di `DuelSession.RETURN_URLS.free`/`.story` in `js/duel-session.js` —
  dove porta il pulsante "Continua" a fine Duello Libero — quindi la
  vista fusa è un SECONDO modo di raggiungere la stessa schermata (dal
  menu), non un sostituto. Verificato con Playwright (non solo lettura
  del codice): caricamento pulito di `index.html` senza errori,
  Profilo (dati/deck/record renderizzati, salvataggio nome, back button,
  stato preservato tra visite), Duello Libero (35 personaggi
  renderizzati, apertura modale difficoltà, costruzione URL verso
  `duelMonstersCore.html` con campo/musica/personaggio/difficoltà
  corretti, confronto diretto delle richieste di rete fallite contro la
  pagina standalone per escludere regressioni — risultato identico, 1
  sola immagine personaggio mancante in entrambe, preesistente). Suite
  Playwright del motore 35/35 verde (invariata, incluso
  `duello-libero-smoke.spec.js`, che testa `duelMonstersCore.html`
  direttamente via query string e non è quindi toccato da questa fusione).
- ✅ **Sistema "Sfide" (`sfide.html`) — nuova pagina, richiesta esplicita
  dell'utente, con un primo catalogo di 14 sfide già pronte** (id/testo in
  `js/data/challenges-db.js`): sconfiggi un personaggio N volte (Yugi,
  Kaiba, Pegasus, Marik), evoca una carta specifica N volte (Drago Bianco
  Occhi Blu, Mago Nero, Drago Nero Occhi Rossi, Testa Proibita, Jinzo,
  Kuriboh, Slifer), 3 traguardi di vittorie totali (1/10/50). Ogni sfida
  ha già un campo `reward` (sempre `null` per ora) — segnaposto per un
  sistema di ricompense futuro esplicitamente richiesto ma non ancora
  implementato, così una sfida futura non richiederà una migrazione dati.
  Architettura a 3 pezzi generici (nessuna funzione dedicata per singola
  sfida):
  - `js/challenges/challenge-tracker.js`: `ChallengeTracker.recordProgress(type, params)`
    fa il matching contro `challenges-db.js` (campo `match`) e incrementa
    `SaveManager.getChallengeProgress/setChallengeProgress` (nuovo campo
    `save.challenges`, stesso schema backfill retrocompatibile già usato
    per `currency`/`ownedPacks` — vedi `load()`/`createNew()`/
    `applyExternalSave()` in `js/save-manager.js`). Una FUTURA sfida con
    un `type` già esistente non richiede alcuna modifica al tracker, solo
    una nuova voce nel catalogo.
  - `js/ui/challenge-banner.js` + `.css`: banner "🏆 Sfida completata!" in
    alto a destra (verificato con screenshot Playwright: nessuna
    sovrapposizione con LP/topbar), in coda se più sfide si completano di
    seguito. Mostrato SUBITO se la pagina corrente lo ha caricato,
    altrimenti accodato in `sessionStorage`
    (`ChallengeTracker.drainPendingBanners()`) perché la PROSSIMA pagina
    con il banner caricato lo mostri al proprio avvio — generico apposta,
    per un futuro hook su una pagina diversa da `duelMonstersCore.html`.
  - Due punti di aggancio nel motore, individuati passando dal punto
    centralizzato ESISTENTE invece di duplicare la logica: `DuelSession.finish()`
    in `js/duel-session.js` (dopo `recordCharacterResult`, solo se
    `playerWon === true` e `session.opponent.id` esiste — mai per il Bot
    generico del Duello Demo, mai per un Pareggio) per
    `defeatCharacter`/`winDuels`; il dispatcher condiviso
    `ON_NORMAL_SUMMON`/`ON_SPECIAL_SUMMON` dentro `fireTrigger()` in
    `js/engine/duel-engine.js` (stesso punto già usato da
    `reactToAnyNormalOrFlipSummon`/`reactToAnySpecialSummon`) per
    `summonMonster`, filtrato a `ctx.owner === 'player'` (mai il bot) e
    con `ctx.summonedCard.id !== -1` (mai un Token). Verificato con un
    vero test di regressione
    (`tests/specs/challenge-tracker-hooks.spec.js`, tramite
    `ctx.specialSummon(...)`, non un `fireTrigger` sintetico — quello
    romperebbe `reactToAnyNormalOrFlipSummon`, che si aspetta la carta
    già davvero piazzata sul Terreno) che un'Evocazione del giocatore fa
    avanzare la sfida, quella del bot no, un Token non lancia eccezioni.
  `duelMonstersCore.html` è l'unica pagina che carica tutti e 3 i pezzi
  oggi (dove succedono gli eventi reali); `sfide.html` carica
  catalogo+tracker (per leggere il progresso) e banner (per coerenza
  futura, anche se oggi nessun evento può scattare mentre ci si è sopra).
  `sw.js` aggiornato (bump a v4) con tutti i file nuovi.
- ✅ **Due bug reali segnalati dall'utente subito dopo il giro precedente,
  entrambi corretti**:
  - **"Non c'è più la musica" — regressione reale della sessione
    precedente**: rimuovere il prompt "tocca per riprendere" assumeva che
    l'utente arrivasse SEMPRE a `duelMonstersCore.html` dopo aver già
    cliccato qualcosa altrove (es. il gate di `index.html`) nella stessa
    sessione di navigazione — ma "Duello Demo" (`duelMonstersCore.html`)
    è il **banco di prova standard di questo stesso progetto** (vedi in
    cima a questo file) e si apre spesso DIRETTAMENTE, come primissima
    pagina della sessione, SENZA alcun click pregresso — e il ciclo
    naturale della demo gioca da solo (bot/pescate automatiche) senza
    richiedere click per un bel po'. In quel caso l'autoplay resta
    bloccato dal browser e, avendo tolto ogni segnale visibile, l'utente
    restava con silenzio totale senza sapere perché. **Riprodotto e
    verificato con Playwright** (apertura diretta, nessun click, 2s di
    attesa: `audio.paused === true`). Corretto con un pulsantino "🔈"
    minimo (`ensureFallbackButton()` in `js/audio/audio-manager.js`) che
    appare SOLO quando l'autoplay è davvero bloccato (mai altrimenti) e
    sparisce non appena la musica riparte — piccolo, in un angolo, senza
    testo: non è una regressione della richiesta precedente
    dell'utente (quella contestava un BANNER A PIENA LARGHEZZA con
    scritto "tocca per riprendere" sempre visibile, non l'idea di un
    recupero visibile in sé). **Lezione per una futura sessione**: quando
    si assume che "l'utente ha sempre già interagito prima" per
    giustificare la rimozione di un fallback visibile, verificare quella
    assunzione contro il FLUSSO DI TEST/USO REALE del progetto (qui
    documentato esplicitamente in cima a questo file), non solo contro il
    flusso "ideale" attraverso il menu — i due possono divergere, e la
    sessione precedente aveva verificato solo il secondo.
  - **Testo "Carta coperta" (e nomi carta) visibile per una frazione di
    secondo sulle carte, specialmente ai cambi fase — bug preesistente,
    non introdotto in questa sessione, ma segnalato ora**: `renderFields()`
    (`js/engine/game-flow.js`) ricostruisce l'INTERO Terreno da zero ad
    ogni `updateUI()` (quindi anche solo a un cambio fase), quindi ogni
    `<img>` di ogni carta viene ricreata e forza il browser a
    ridecodificarla — nella breve finestra prima che l'immagine sia
    pronta, un `alt` non vuoto può essere dipinto sopra la cornice CSS già
    visibile sotto. Corretto impostando `alt=""` (immagine dichiaratamente
    decorativa: il nome/stato è già leggibile nella cornice CSS stessa)
    su tutte e 4 le `<img>` di `js/ui/card-renderer.js`
    (`applyCardBackVisual`/l'illustrazione `artOnly`/lo scan intero/la
    pila del Deck) — i browser non dipingono mai testo per un'immagine con
    `alt=""`, né in caricamento né in errore. **Non risolve la causa di
    fondo (il re-render completo del Terreno ad ogni `updateUI()`, invece
    di un aggiornamento incrementale/diffing) — quella resta un limite
    architetturale più ampio, sproporzionato da affrontare per questo
    sintomo specifico**, ma elimina il sintomo visibile segnalato.
- ✅ **"Ancora non va" — il fix precedente sulla musica non bastava,
  chiuso per davvero**: il pulsantino di recupero da solo non bastava
  perché il SIPARIO dell'intro (`js/ui/duel-cinematics.js`) continuava ad
  aprirsi a un tempo fisso indipendentemente da se la musica stesse
  DAVVERO suonando — `audioIsReady()` controllava solo
  `audio.readyState >= 3` (abbastanza bufferizzata per un play()
  affidabile SE permesso), non `!audio.paused` (sta REALMENTE suonando):
  se l'autoplay restava bloccato (nessun gesto pregresso — il caso comune
  aprendo "Duello Demo" direttamente), readyState arrivava comunque a 4 e
  il sipario si apriva su un campo già muto, esattamente la richiesta
  esplicita dell'utente violata ("non voglio che l'audio non si sia
  ancora caricato quando ho iniziato a giocare"). Corretto in due parti:
  1) `audioIsReady()` ora controlla `!audio.paused` (riproduzione vera),
     non solo il buffer — il sipario aspetta la musica REALE, col tetto
     di sicurezza (`AUDIO_READY_SAFETY_MS`, 6s) invariato a garantire che
     non resti bloccato per sempre se l'utente non interagisce affatto.
  2) Nuovo `DuelMusic.ensurePlaying()` (`js/audio/audio-manager.js`,
     idempotente — chiamarla a riproduzione già in corso non fa nulla) e
     `attemptPlay()`/`onPlayBlocked()` estratti da `tryPlay()` per essere
     riusabili da un chiamante ESPLICITO, non solo dai listener generici
     `pointerdown`/`keydown`/... su `document` (più fragili: un gestore
     di un'altra carta/elemento potrebbe fermare la propagazione
     dell'evento prima che arrivi lì — pattern comune in questo motore).
     Il click sull'overlay dell'intro (skip, "Clicca per saltare" —
     SEMPRE visibile) ora chiama `DuelMusic.ensurePlaying()` PRIMA di
     alzare il sipario: un gesto reale di cui la cinematica ha già
     certezza diretta, non un'inferenza indiretta. **Verificato con
     Playwright su 3 scenari distinti** (mai assunti, sempre misurati):
     nessun click → sipario aperto dopo ~7.1s (teatrale 2.9s + tetto di
     sicurezza), musica ancora bloccata (limite di policy del browser
     genuinamente invalicabile, non un bug); click sull'overlay durante
     l'intro → sipario aperto quasi subito E musica confermata in
     riproduzione (`paused:false`); click sul pulsantino "🔈" durante
     l'intro → musica parte, il poll di `attemptRaiseCurtain` lo rileva
     al giro successivo e il sipario si apre. Suite motore 36/36 verde
     (invariata — `tests/helpers/harness.js#openDuel` clicca già
     `.di-skip` appena disponibile, stesso percorso "immediato" dello
     scenario 2, quindi nessun test ora aspetta i 6s del tetto di
     sicurezza). **Lezione per una futura sessione**: quando un
     `readyState`/segnale di "pronto" non implica anche "sta davvero
     succedendo" (qui: bufferizzato ≠ in riproduzione, per via
     dell'autoplay bloccato), un gating basato solo sul primo porta
     esattamente allo stesso sintomo che doveva prevenire — verificare
     sempre lo stato REALE (`!audio.paused`), non un proxy indiretto.
- ✅ **"Non va ancora l'audio" — causa REALE trovata e chiusa (non solo
  un altro sintomo mascherato)**: i due fix precedenti (pulsantino di
  recupero, sipario che aspetta la riproduzione vera) erano corretti ma
  insufficienti, perché il listener di fallback che dovevano attivare
  non scattava MAI per le due interazioni più comuni di un vero duello.
  `startHandCardDrag` (`js/engine/actions.js:161-168`, trascinare una
  carta dalla mano) e `startAttackDrag` (`js/engine/game-flow.js:1500-1502`,
  trascinare un mostro per attaccare) chiamano ENTRAMBE
  `event.stopPropagation()` proprio sull'evento `pointerdown` (per
  impedire che un secondo evento `click` sintetico duplichi l'azione su
  mobile — motivo legittimo, codice preesistente non toccato). Il
  fallback di `js/audio/audio-manager.js` ascoltava `pointerdown` su
  `document` in fase di BUBBLE (il default): quello `stopPropagation()`
  lo fermava PRIMA che risalisse fin lì, quindi le due azioni più
  naturali con cui un giocatore comincia a interagire con un duello
  reale non sbloccavano mai l'audio — anche dopo diversi click veri
  sulle carte, la musica restava muta. **Perché non emerso nei test
  precedenti**: ogni test Playwright di questa sessione cliccava sempre
  altrove (il pulsante skip dell'intro, il pulsantino di recupero), mai
  su una VERA carta — il percorso rotto non è mai stato esercitato fino
  a un test mirato scritto apposta dopo il terzo "non va ancora"
  dell'utente. Corretto passando i 4 listener di fallback
  (`pointerdown`/`keydown`/`wheel`/`touchstart`) alla fase di CAPTURE
  (`{ once: true, passive: true, capture: true }`) invece che bubble: la
  fase di capture scorre da `document` VERSO il bersaglio, PRIMA che
  l'evento arrivi lì — nessuno `stopPropagation()` a valle (chiamato
  durante bubble, dopo) può più fermarla in anticipo. **Verificato con
  Playwright usando `page.mouse.down()`/`move()`/`up()` (input reali,
  trusted — non un `dispatchEvent()` sintetico, che l'autoplay policy
  del browser ignorerebbe comunque)** su ENTRAMBE le interazioni prima
  rotte: trascinare una carta dalla mano e trascinare un mostro per
  attaccare, in entrambi i casi partendo da un duello aperto
  direttamente senza alcun click pregresso (`audio.paused` passa da
  `true` a `false` dopo il trascinamento). Suite motore 36/36 verde
  (invariata). **Lezione di metodo per una futura sessione**: quando un
  fallback "al primo gesto dell'utente" continua a non scattare
  nonostante la logica sembri corretta, sospettare SEMPRE
  `event.stopPropagation()` da qualche parte nella catena DOM tra il
  bersaglio reale del click e `document` — specialmente in un motore con
  drag-and-drop (frequente qui: card-effects/game-flow usano
  `stopPropagation()` di proposito in più punti) — e verificare con un
  gesto VERO sul bersaglio REALE che l'utente userebbe per primo (qui:
  una carta, non un bottone di comodo), non solo su un elemento
  qualunque che capita a portata di mano nel test.
- ✅ **"Ancora niente" (4° giro) — RIPULITO, tornato semplice su
  richiesta esplicita e diretta dell'utente**: dopo tre correzioni
  successive (pulsantino di recupero, sipario che aspetta la
  riproduzione vera con tetto di sicurezza, fix capture-phase) l'utente
  ha segnalato che la musica era di nuovo del tutto assente (incluso
  `mainTheme.mp3` sulle pagine menu) e ha rifiutato ESPLICITAMENTE
  qualunque forma di attesa legata all'audio prima di entrare nel
  duello ("non bloccare il loading... neanche mettere attesa musica...
  è orrendo... risolvi le schifezze"). Non è stato possibile riprodurre
  "mainTheme assente" con Playwright (un click vero sul gate lo fa
  partire correttamente anche dopo ogni fix precedente) — resta
  un'incognita se fosse uno stato/cache del browser reale dell'utente o
  un effetto collaterale non riprodotto della complessità accumulata.
  Data l'impossibilità di isolare la causa e la richiesta esplicita di
  smettere di aggiungere logica, la risposta corretta non era un quinto
  fix ma una **rimozione netta di tutto ciò che non era strettamente
  necessario**: tolti integralmente da `js/ui/duel-cinematics.js` il
  gating `audioIsReady`/`attemptRaiseCurtain`/`AUDIO_READY_SAFETY_MS`
  (il sipario torna a un `setTimeout(raiseCurtain, INTRO_SHOW_MS)`
  fisso, IDENTICO all'originale, mai più legato allo stato dell'audio)
  e la relativa classe CSS `.di-loading-pending` in
  `js/ui/duel-cinematics.css`; tolti da `js/audio/audio-manager.js` la
  dissolvenza di volume (`fadeInToTargetVolume`/`targetVolume`, tornato
  un `audio.volume = volume` diretto come in origine), il pulsantino
  "🔈" (`ensureFallbackButton`/`hideFallbackButton`), e lo strato
  `attemptPlay`/`onPlayBlocked`/`playAttemptInFlight`/
  `DuelMusic.ensurePlaying` (tornato un semplice `tryPlay()` con un solo
  `.catch()`). **L'UNICA parte mantenuta dei giri precedenti**: i
  listener di fallback dentro `tryPlay()` restano in fase CAPTURE
  (`{ once: true, passive: true, capture: true }`) — quello era un bug
  REALE e verificato (vedi il bullet sopra), non un ornamento, e
  toglierlo avrebbe reintrodotto il problema originale di
  `stopPropagation()` sulle carte. Nessuna UI visibile, nessuna attesa,
  nessuna dissolvenza: la pagina si comporta di nuovo esattamente come
  "all'inizio" (parole dell'utente) più quel singolo fix silenzioso.
  Verificato di nuovo con Playwright: `mainTheme.mp3` parte con un click
  vero sul gate (volume pieno immediato, nessun ritardo), il sipario del
  duello si apre sempre a tempo fisso (~2.9s, mai oltre, testato fino a
  ~3.9s totali dal `goto()` includendo il boot del motore), il
  trascinamento di una carta dalla mano sblocca ancora l'audio se
  bloccato. Suite motore 36/36 verde. **Lezione per una futura
  sessione, la più importante di questo intero filone**: di fronte a
  correzioni ripetute che il committente continua a respingere, la
  mossa giusta NON è un ennesimo livello di logica difensiva aggiunta
  sopra al precedente (rischia di introdurre esattamente i bug
  imprevedibili che l'utente ha poi segnalato) — è FERMARSI, chiedersi
  onestamente se la complessità accumulata sia essa stessa il problema,
  e se il committente lo chiede esplicitamente, RIMUOVERE fino al punto
  più semplice che soddisfa ancora il requisito verificato più solido
  (qui: il fix capture-phase, l'unico con una riproduzione concreta e
  ripetibile di un bug reale), scartando ogni raffinamento speculativo
  costruito sopra ipotesi mai confermate (il gating sul readyState, la
  dissolvenza, il tetto di sicurezza).
- ✅ **Torneo "Regno dei Duellanti" (`torneo-regno-duellanti.html`),
  ora completo fino al Campione: mappa a bivi + Castello di Pegasus
  (semifinale/finale/Pegasus).** Il seguito DENTRO il castello (chiuso
  in una seconda sessione, dopo la prima che si era fermata
  deliberatamente a "sei entrato nel Castello") è un vero tabellone a
  eliminazione diretta: 3 Duellanti del roster (mai Kaiba, già
  affrontato a parte al Cancello) sorteggiati come altri finalisti;
  semifinale contro uno di loro (+10-15 Stelle a caso se vinta), finale
  contro un altro dei due rimanenti (stesso premio), poi Pegasus in
  persona (+15 Stelle fisse, stato "campione" — una schermata di
  vittoria stub, il premio finale vero resta da decidere). A
  differenza della mappa aperta (puntata di Stelle, si può perdere solo
  quello che si è puntato), il Castello è vittoria-o-fuori: una
  sconfitta in QUALUNQUE tappa elimina dal torneo senza bisogno di
  contare le Stelle residue. Zero infrastruttura nuova di base
  necessaria: solo nuovi campi nello stato del torneo (`castleStage`/
  `castleFinalists`/`castleSemifinalOpponent`/`castleFinalOpponent`) e
  tre nuove schermate — la stessa base (`SaveManager.getTournamentState`/
  `mode=tournament` in `duel-session.js`/la breadcrolla
  `ygoLastDuelOutcome`) regge entrambe le metà senza modifiche. Mappa a
  bivi generata "man mano" (stile Crash
  Bandicoot 1 — 2/3 percorsi ad ogni passo, MAI un grafo intero
  precalcolato: molto più semplice da costruire/renderizzare di una
  vera mappa 2D con percorsi disegnati, e indistinguibile per il
  giocatore visto che ogni percorso è comunque "a sorpresa" finché non
  lo si sceglie). Pool di Duellanti incontrabili SOLO il cast reale del
  Regno dei Duellanti (Rex Raptor/Weevil Underwood/Mako Tsunami/Panik/
  Bonz/Fratelli Paradosso/Mai Valentine/Bandit Keith) — Kaiba e Pegasus
  non possono mai comparire come incontro casuale per costruzione
  (compaiono solo nel percorso speciale "Verso il Castello", sbloccato
  a 10 Stelle). Infrastruttura nuova pensata riusabile per un FUTURO
  secondo torneo (Battle City, già presente come "Prossimamente" in
  `tornei.html`), non specifica di questo: `SaveManager.getTournamentState(id)`/
  `setTournamentState(id, state)` (contenitore generico sotto
  `save.tournaments[id]`, forma libera decisa da ogni torneo);
  `save.currency.starChips` (esisteva già da tempo, mai usato da
  nessuna feature) diventa il vero portafoglio Stelle; nuova modalità
  `duelMonstersCore.html?mode=tournament&tournament=<id>` in
  `js/duel-session.js`, con `TOURNAMENT_RETURN_URLS` a mappare
  torneo→pagina di ritorno (un futuro torneo aggiunge una riga sola);
  nuova breadcrolla generica `sessionStorage['ygoLastDuelOutcome']`
  (mode/tournamentId/playerWon/opponentId/timestamp), scritta da
  `DuelSession.finish()` per OGNI duello — le modalità che non ne hanno
  bisogno la ignorano, non è un hack solo per questo torneo. Verificato
  con Playwright forzando deterministicamente ogni ramo (premio/insidia/
  vittoria/sconfitta/eliminazione a 0 Stelle/entrambi gli esiti del
  Cancello di Kaiba), non solo affidandosi al caso — vedi i test
  scratch di sessione per il pattern (manipolare `SaveManager`/
  `Math.random` via `page.evaluate` invece di sperare in un lancio
  fortunato). Suite motore 36/36 verde.
- ✅ **Schermata di caricamento condivisa ad ogni cambio pagina
  (`js/ui/page-loader.js`/`.css`)**, richiesta esplicita dell'utente,
  distinta dallo splash d'apertura di `index.html` (quello resta
  un'esperienza a parte, mostrata una sola volta a sessione — questa
  compare invece ad OGNI navigazione tra le pagine del gioco, ALMENO 2
  secondi, stesso principio "camuffa il caricamento reale" ma un disco
  ciano/blu al posto dell'anello dorato dello splash, per restare
  visivamente distinguibili). Componente condiviso (come `js/ui/topbar.js`)
  incluso in tutte le pagine: `<link>` nell'head + `<script>` come
  PRIMISSIMO elemento di `<body>` (garantisce la copertura dal primo
  frame dipinto, stesso principio già usato per lo splash/per il vecchio
  `#preIntroCover`). Nasconde da sola dopo il `window.load` + il minimo
  di 2s, a meno che la pagina non imposti `window.PAGE_LOADER_MANUAL_HIDE = true`
  per controllare da sola il momento esatto in cui sparire.
  `duelMonstersCore.html` **sostituisce interamente il vecchio
  `#preIntroCover` statico** con questo stesso componente (manual-hide,
  nessun minimo di 2s: `PageLoader.hide()` chiamata da
  `duel-session.js#start()` nello STESSO punto in cui prima veniva
  rimosso `#preIntroCover` — la regola "il caricamento del duello non
  deve mai aspettare nulla" resta intatta, la cinematica VS parte
  esattamente come prima). `index.html` ha un caso speciale (nuovo flag
  generico `window.PAGE_LOADER_SKIP`, per qualunque pagina volesse
  disattivarlo del tutto): alla PRIMISSIMA apertura dell'app in questa
  sessione compare SOLO lo splash dedicato (niente loader, altrimenti lo
  coprirebbe per l'intera durata avendo uno z-index più alto); ad ogni
  RITORNO al menu da un'altra pagina (splash già visto in questa sessione)
  compare invece questo loader al posto del vecchio "salta dritto al
  menu" istantaneo. Verificato con Playwright su 4 scenari (comparsa
  immediata + minimo 2s rispettato su una pagina normale; nessun ritardo
  artificiale prima della cinematica VS su `duelMonstersCore.html`; solo
  splash e zero loader creato alla prima apertura di `index.html`; loader
  con minimo 2s e splash rimasto nascosto al ritorno). Suite motore
  56/56 verde (invariata).
- ⚠️ **Modifica audio revertata su richiesta esplicita dell'utente**: in
  questa stessa sessione era stato aggiunto `mousemove` ai listener di
  fallback che sbloccano l'autoplay musicale (`js/audio/audio-manager.js`,
  `tryPlay()`) — l'utente ha segnalato subito dopo che questo aveva
  "rotto il gioco" (musica non più avviabile). Rimosso integralmente
  senza indagare oltre se fosse davvero la causa (vedi la memoria
  salvata `simplify-dont-stack-fixes.md`: di fronte a una rottura
  segnalata, il primo passo è sempre tornare allo stato precedente noto-
  funzionante, non aggiungere un'altra ipotesi sopra). Restano SOLO i 4
  listener originali (`pointerdown`/`keydown`/`wheel`/`touchstart`, fase
  capture). Aggiunta per prudenza una rete di sicurezza a tempo (10s) in
  `js/ui/page-loader.js` per la modalità `PAGE_LOADER_MANUAL_HIDE` (es.
  `duelMonstersCore.html`), nel dubbio che fosse invece quest'altra
  novità della stessa sessione a poter restare bloccata per sempre in
  qualche percorso d'errore non ancora osservato.
- ✅ **14 carte "banisci/tributa N carte dal Cimitero/Terreno" per la
  Special Summon dalla mano corrette — stessa famiglia di bug di
  "ricerca dal Deck senza vera scelta" qui sotto, ma pattern diverso**:
  Inferno (677), Fenrir (698), Stregone del Caos (740, 1 LUCE + 1
  OSCURITÀ), Gigantes (757), Silpheed (779), Necropaura Oscura (891, 3x
  Demone), Anima di Purezza e Luce (1093, 2x LUCE), Spirito delle
  Fiamme/Roccia/Acqua/Vento (1094/1101/1103/1104), Drago Toon Occhi Blu
  (123) e Manga Ryu-Ran (606, tributo di 2 mostri qualsiasi) sceglievano
  sempre i primi N candidati trovati. **Perché non si può riusare
  `searchGraveyardWithChoice`/`searchDeckWithChoice` qui**: quei due
  aprono il picker in modo ASINCRONO e vanno bene per un effetto
  REATTIVO (onDestroy/onFlip/activate() dopo che l'azione principale è
  già avvenuta) — ma il valore di ritorno di `paySpecialSummonCost` GATE
  SINCRONAMENTE se `DuelEngine.trySpecialSummonFromHand`
  (duel-engine.js) procede con la vera Special Summon: un picker
  asincrono lì dentro tornerebbe vero PRIMA che la scelta sia fatta,
  sommonando subito e pagando il costo dopo (o mai) — bug quasi
  introdotto in questa stessa sessione con un primo tentativo su Inferno
  poi corretto prima del commit. Soluzione: generalizza il meccanismo
  GIÀ ESISTENTE per Teschio Evocato Toon (id 486,
  `getSpecialSummonSacrificeCandidates`/`pendingSpecialSummonSacrificeUid`,
  lasciato invariato) spostando la scelta PRIMA, nel click handler
  (`offerSpecialSummonBanishChoice`/`offerSpecialSummonTributeChoice`,
  nuove funzioni globali in `actions.js`) — la scelta finisce in
  `gameState.pendingSpecialSummonBanishUids`/`TributeUids`, letta e
  consumata da `resolveSpecialSummonBanishCost`/`resolveSpecialSummonTributeCost`
  (nuovi helper condivisi in `card-effects.js`), che restano quindi
  sincroni come ogni altro `paySpecialSummonCost`. Entrambe le funzioni
  di offerta accettano un array di predicati, uno per carta richiesta
  (ripetuto per un conteggio omogeneo, diverso per un costo eterogeneo
  come id 740) e aprono un picker SOLO se esistono davvero più
  candidati del minimo richiesto. **Riusabile per qualunque futura carta
  con lo stesso identico bisogno** ("scegli N carte per un costo che
  deve gate sincronamente la prosecuzione", non solo Special Summon).
  Exxod (753, tributo singolo con nome specifico) riusa invece il
  meccanismo preesistente di id 486, pensato apposta per una scelta
  singola. Scrivendo il test per questa carta è emerso un bug reale
  PREESISTENTE e scorrelato: `.name.includes('Sfinge')` era
  case-sensitive e non riconosceva mai "Hieracosfinge"/"Criosfinge" (la
  "s" minuscola nel nome composto) — corretto con `isSphinxNamed(card)`,
  confronto case-insensitive. **Lezione per una futura sessione**:
  quando un costo di Special Summon dalla mano ha bisogno di una scelta
  VERA tra più candidati, non aprire mai un picker dentro
  `paySpecialSummonCost` stessa — la scelta va sempre fatta PRIMA, nel
  click handler, con lo schema `offerSpecialSummon*Choice` +
  `pendingSpecialSummon*Uids` + `resolveSpecialSummon*Cost` qui sopra.
  Suite motore 58/58 verde.
- ✅ **19 carte "cerca/banisce dal Cimitero senza vera scelta" corrette
  (continuazione dell'audit su richiesta esplicita dell'utente)**:
  Maschera dell'Oscurità (602), Sepoltura Prematura (633), Il Guerriero
  Ritorna in Vita (725), Fata della Primavera (728), Onda Sismica (818),
  Officina dell'Ingranaggio Antico (837), Richiamo degli Infestati
  (136), Capo dei Guardiani della Tomba (899), La Fanciulla Indulgente
  (901), Lanciere Sciocco (1036), Fushioh Richie (1130), Genesi del
  Vampiro (656, doppia scelta scarto+rianimazione), Gilford la Leggenda
  (709, equip in sequenza finché restano caselle libere), Spada Divina
  - Lama della Fenice (722, 2 scelte in sequenza), Libro della Vita
  (669, 2 Cimiteri diversi), Cerchio degli Inferi (498, 2 siti),
  Fabbrica dell'Ingranaggio Antico (841, rivelazione + bando a soglia
  di Livello) e Metamorfosi (886, doppia scelta tributo+Extra Deck) —
  stessa famiglia di "primo candidato trovato invece di vera scelta"
  della batch precedente (17 carte lato Deck), qui lato Cimitero.
  Generalizzato anche `searchDeckWithChoice` con una nuova opzione
  `options.deckOwner` (default `ctx.owner`) per le carte che cercano
  nel Deck dell'AVVERSARIO (Signore/Dama dei Vampiri, Ninna Nanna
  dell'Obbedienza, Scassinatori Scorpioni Oscuri) mentre resta il
  proprietario dell'effetto a scegliere.
  **Due bug reali scorrelati trovati scrivendo i test di questa
  correzione**:
  - **Lanciere Sciocco (1036)**: `destroyMonster` (duel-engine.js) manda
    GIÀ la carta stessa al proprio Cimitero PRIMA di sparare `onDestroy`
    — un filtro `type === 'monster'` senza escludere `ctx.card.uid`
    trovava quindi SE STESSA come falso candidato aggiuntivo (2
    "candidati" invece di 1), aprendo un picker con una scelta fasulla
    invece di auto-selezionare l'unico vero mostro da rianimare.
    Corretto aggiungendo `c.uid !== ctx.card.uid` al filtro. **Lezione
    per un futuro caso simile**: quando un `onDestroy` cerca nel PROPRIO
    Cimitero con un filtro ampio (es. "qualsiasi mostro"), verificare
    sempre se quel filtro potrebbe includere la carta STESSA appena
    distrutta (già presente lì al momento del trigger).
  - **`searchZoneWithChoice`/`takeCard` (card-effects.js) rimuove GIÀ la
    carta dalla zona PRIMA di chiamare `onChosen`** — corretto per un
    effetto REATTIVO che sposta la carta altrove (mano/Terreno, dove
    la rimozione generica basta), ma `ctx.banishFromGraveyard` richiede
    che la carta sia ANCORA nel Cimitero per funzionare (fa il suo
    proprio `grave.indexOf` + controllo Necrovalley id 890) — chiamarlo
    su una carta già rimossa da `takeCard` falliva SEMPRE in silenzio
    (tornava `false` senza mai bandire). Bug introdotto e poi corretto
    nella stessa sessione per Spada Divina (722)/Fabbrica
    dell'Ingranaggio Antico (841)/Libro della Vita (669, lato Cimitero
    avversario) — tutti e 3 chiamavano `banishFromGraveyard` DOPO
    `searchGraveyardWithChoice`. Nuovo helper condiviso
    `banishFromGraveyardWithChoice(ctx, graveyardOwner, filterFn,
    options, onBanished)`: non rimuove nulla da solo, lascia scegliere
    tra i candidati (senza toccarli) e delega rimozione+Necrovalley a
    `banishFromGraveyard` stesso. **Riusabile per qualunque futura carta
    con lo stesso bisogno** ("scegli 1 carta dal Cimitero da BANDIRE",
    non solo da spostare) — usare SEMPRE questo, mai
    `searchGraveyardWithChoice` seguito da un `banishFromGraveyard`
    separato sulla carta scelta.
  Rimosso il `missingEffectNote` ormai risolto di Metamorfosi (886);
  aggiunto quello mancante (mai tracciato prima) per La Fanciulla
  Indulgente (901, condizione "distrutto in battaglia in questo turno"
  non filtrata); ristretto quello di Lanciere Sciocco (1036, resta solo
  "sempre scoperto in Attacco, mai Difesa coperta"). **Bug di TEST
  trovato e corretto a parte (non del motore)**: scrivendo
  `tests/specs/graveyard-search-real-choice.spec.js` un test falliva in
  modo diverso ad ogni esecuzione (a volte un conteggio di candidati
  sbagliato, a volte un timeout) SOLO quando lanciato dentro la suite
  completa (`npm test`), mai isolato — `freezeNaturalGameLoop()`
  (harness.js) congela SOLO le decisioni autonome del bot, MAI la
  cascata di transizione fase già in volo dal caricamento della pagina
  (Draw→Standby→Main Phase 1, vedi "Un'insidia reale già presa in
  questa suite" in `tests/README.md`) — quella cascata può completarsi
  DOPO il freeze e interferire con le manipolazioni dirette di
  `gameState` di un test che inizia subito a lavorare. Risolto
  aggiungendo un breve `page.waitForTimeout` all'inizio del test per
  lasciarla assestare PRIMA di iniziare. **Lezione per un futuro test
  con lo stesso sintomo** ("fallisce in modo diverso ogni volta, solo
  nella suite completa, mai isolato"): sospettare questa esatta cascata
  prima di continuare ad allungare i timeout dei passi successivi, che
  non risolve la causa reale.
- ✅ **3 bug segnalati dall'utente, tutti chiusi nella stessa sessione**:
  1) **Raggi ruotanti che a volte non toccavano i bordi schermo** (menu
     principale, intro/vittoria/sconfitta del duello): usavano un
     `inset` in percentuale (`-30%`/`-35%`), che scala con lo STESSO
     rapporto d'aspetto del contenitore — su uno schermo molto
     stretto/alto (mobile in verticale) il riquadro ruotato non copre
     più gli angoli reali a certi angoli di rotazione (verificato con
     la trigonometria: un rapporto H/W di ~2.2 richiede un fattore di
     crescita di ~2.24× a 45°, oltre il ~1.6-1.7× usato). Corretto in
     `.menu-bg-rays` (index.html)/`.di-rays`/`.do-rays`
     (duel-cinematics.css): `250vmax` fisso invece di una percentuale
     del contenitore, centrato via margini negativi — sempre più grande
     della diagonale reale dello schermo, qualunque rapporto d'aspetto.
  2) **"Il video di Exodia parte e si blocca"**: non era bloccato, veniva
     TAGLIATO A METÀ da un tetto di sicurezza fisso a 12s in
     `playVideoOverlay` (`js/ui/effects.js`) — `video/vittorie/exodiawin.mp4`
     (aggiunto al repository in questa sessione, prima non tracciato)
     dura 18.27s, quindi veniva sempre interrotto prima della fine
     (confermato tracciando `currentTime`/`readyState`/`paused` nel
     tempo: il video giocava perfettamente fino al taglio). Corretto
     ricalibrando il tetto sulla vera durata (`video.duration`, letta
     da `'loadedmetadata'`) + 5s di margine — la rete di sicurezza resta
     SOLO per un video che non arriva mai a `'ended'`/`'error'`
     (bloccato, mal codificato), non per uno che gioca semplicemente più
     a lungo del tetto indovinato. Il commento di
     `visual-effects-library.js` che diceva "la cartella video/ non
     esiste ancora" era obsoleto (contiene già `video/evocazioni/*.mp4`
     da una sessione precedente) — aggiornato.
  3) **Colore del page-loader stonato**: era ciano/blu (scelta
     deliberata di una sessione precedente per distinguerlo dallo
     splash d'apertura), tolto su richiesta dell'utente e sostituito
     con lo stesso oro/ambra del resto del menu
     (`--gold`/`--gold-strong`, `#f7d774`/`#f39c12`) — resta
     distinguibile dallo splash per FORMA (disco vs anello) e
     frequenza (ad ogni cambio pagina, non solo all'apertura), non più
     per colore.
  Suite motore 59/59 verde (rilanciata più volte per escludere flakiness).
- ✅ **Accesso con approvazione admin OBBLIGATORIO per giocare — replica
  esplicitamente richiesta dall'utente del meccanismo del progetto
  "Fioxify" (stesso autore, `Sviluppo/Fioxify` accanto a questo repo).
  Sviluppato su branch `feature/auth-approval-fioxify`, poi MERGIATO in
  `main` su richiesta esplicita dell'utente ("mergia in main") e il
  branch è stato eliminato (locale + remoto) — il progetto torna così
  alla convenzione consueta di un solo branch attivo.** Prima di questa
  sessione l'accesso cloud
  (`js/cloud/cloud-sync.js`) era puramente OPZIONALE (il gate di
  `index.html` offriva anche "Continua in locale") — decisione esplicita
  dell'utente, tra 3 opzioni proposte via AskUserQuestion, di renderlo
  OBBLIGATORIO ovunque (web + APK), rimuovendo quell'opzione.
  - **`supabase/schema.sql`**: nuova tabella `public.profiles` (id,
    email, `status` pending/approved/rejected, `is_admin`) + trigger
    `handle_new_user` (crea il profilo alla registrazione) + funzioni
    `is_admin_user`/`is_approved`/`check_registration_email` (RPC letta
    anche da anon, per un messaggio preciso in fase di registrazione se
    l'email esiste già) + trigger anti-auto-approvazione + policy RLS
    per `profiles` e per gating le insert/update su `saves`/`custom_cards`
    dietro `is_approved()` (difesa in profondità, oltre al blocco lato
    client). **L'utente deve eseguire questo script nell'SQL Editor
    Supabase di persona** (non posso farlo io: la sola chiave che ho,
    `anon`, non ha i permessi DDL) — vedi `supabase/README.md`, aggiornato
    con la procedura completa incluso "come creare il primo admin".
    ⚠️ **QUESTA FRASE NON VALE PIÙ**: da quando esiste un connettore
    Supabase fra gli strumenti, le migrazioni le posso applicare io —
    vedi il bullet «POSSO APPLICARE MIGRAZIONI SUPABASE DA SOLO» in fondo
    a questa sezione.
  - **`js/cloud/cloud-sync.js`**: `signIn` ora verifica lo status del
    profilo e nega l'accesso (con signOut immediato) se non
    'approved'/admin; `signUp` controlla PRIMA l'email via RPC (messaggio
    preciso: già in attesa/già approvata/rifiutata) poi fa sempre
    signOut dopo la registrazione (nessuna sessione finché non approvato).
    Nuovo `waitForUser()` (Promise risolta SOLO dopo che la sessione
    persistita è stata davvero controllata — a differenza di
    `onAuthChange`, che chiama subito il suo ascoltatore con
    `cachedUser` ancora `null` perché `getSession()` è asincrona: usarlo
    SEMPRE per decidere se reindirizzare al login, mai il primo giro di
    `onAuthChange`). Nuovo **`ensureApprovedSession()`** — il pezzo
    chiave per la domanda esplicita dell'utente su APK/offline: prova
    SEMPRE una riconferma online fresca (con un tetto di 6s), ma se la
    rete non risponde ricade su un marcatore locale
    (`ygoApprovedUserId` in localStorage) scritto SOLO da un'ultima
    verifica online RIUSCITA per quello specifico uid — non è una cache
    HTTP/Service-Worker che scade da sola, è un marcatore esplicito
    per-utente: un account approvato una volta resta utilizzabile
    offline sullo stesso dispositivo, ma un account rifiutato/revocato
    DOPO viene comunque bloccato al prossimo controllo online, mai per
    sempre offline. Nuove funzioni admin (`adminListProfiles`/
    `adminSetProfileStatus`/`adminPendingCount`), tutte pass-through a
    query dirette (le policy RLS in schema.sql sono la vera barriera).
  - **`js/cloud/auth-gate.js` (NUOVO)**: incluso come PRIMO script di
    OGNI pagina di gioco (stesso pattern di inclusione di
    `js/ui/page-loader.js`/`js/ui/topbar.js`, 13 pagine toccate) —
    aspetta `waitForUser()`, poi `ensureApprovedSession()`, e rimanda a
    `index.html?blocked=pending|rejected` se non approvato. `index.html`
    stesso imposta `window.AUTH_GATE_SKIP` implicitamente non caricando
    questo script (mostra lui stesso il login). `profilo.html`
    (standalone, raggiungibile solo a mano) aveva GIÀ i 3 script
    Supabase ma caricati troppo tardi (a metà pagina) — consolidati in
    un unico punto, in cima, altrimenti sarebbero stati caricati DUE
    volte nella stessa pagina (client Supabase duplicato).
  - **`admin.html` (NUOVA pagina)**: pannello Admin (lista "in attesa"
    con Approva/Rifiuta + lista completa sola-lettura) — carica
    `auth-gate.js` per la baseline "approvato", PIÙ un controllo
    aggiuntivo inline `CloudSync.isAdmin()` (auth-gate.js da solo si
    ferma ad "approvato", non basta per questa pagina). Voce "Admin" nel
    menu principale (`index.html`) aggiunta dinamicamente in
    `renderMenu()` SOLO se `CloudSync.isAdmin()`.
  - **`index.html`**: gate riscritto — rimosso "Continua in locale"/
    "Nuova Partita (locale)" (`showGate`/`openNewGameModal` semplificati
    di conseguenza, ramo `fromGate` morto rimosso), validazione client
    (campi vuoti/lunghezza/mismatch) prima di chiamare `CloudSync.signUp`.
    `initGate()` ora aspetta `waitForUser()` + `ensureApprovedSession()`
    prima di decidere Gate vs Menu invece di un bypass sincrono su
    `!cloudUsable` (che ora mostra `showGateUnavailable()`, un vero
    errore bloccante — un account è OBBLIGATORIO, non c'è più nulla verso
    cui ripiegare). **Bug reale trovato e corretto nello stesso giro**:
    "Cambia account" (Profilo) puliva solo `sessionStorage` senza un vero
    `signOut()` — con la sessione Supabase ancora valida, il gate al
    ricaricamento l'avrebbe ritrovata e sarebbe tornato dritto al menu,
    senza mai dare la possibilità di accedere con un account diverso.
    **Redesign successivo del form, su segnalazione esplicita
    dell'utente** ("accedi/registrati fanno un giochetto strano... se
    clicco accedi rimane il conferma password"): il primo tentativo
    (un unico form condiviso con un campo "Conferma password" a comparsa
    progressiva, mostrato al primo click su "Registrati") aveva
    un'architettura sbagliata — cambiando idea da Registrati ad Accedi il
    campo extra restava visibile. Sostituito con due tab indipendenti
    (`#gateTabLogin`/`#gateTabRegister`) su due pannelli separati
    (`#gateLoginPanel`/`#gateRegisterPanel`), ciascuno coi propri
    input/stato (`setGateStatus('login'|'register', ...)`) — stessa
    struttura a tab del progetto Fioxify. **Bug reale trovato durante
    questo refactor**: `resolveCloudConflict()` faceva ancora riferimento
    alla variabile locale `gateStatus` del vecchio form condiviso,
    rimossa nel redesign — avrebbe lanciato `ReferenceError` al primo
    fallimento di un fetch del salvataggio cloud. Ulteriore fix su
    segnalazione dell'utente ("il box della login... non deve
    autosistemarsi per restare centrale... deve espandersi verso il
    basso"): `.gate-shell` passata da `justify-content:center` (faceva
    saltare l'intera card quando si passava al pannello Registrati, più
    alto) a `justify-content:flex-start` con un padding-top che
    approssima la posizione precedente — la card ora si ancora in alto e
    cresce verso il basso, verificato via Playwright (0px di
    spostamento del logo tra i due tab). Il pulsante Esci è stato
    restilizzato da link testuale spento a pillola con bordo, sempre su
    richiesta esplicita. `js/ui/page-loader.js`: `MIN_MS` ridotto da
    2000 a 1000 (richiesta esplicita "portalo a un minimo di 1 secondo").
  - **Bug di TEST (non del motore) trovato e corretto**: l'intera suite
    Playwright (`tests/`) apre `duelMonstersCore.html` direttamente —
    con l'accesso ora obbligatorio, `auth-gate.js` l'avrebbe rimandata a
    `index.html` PRIMA che `gameState`/`DuelEngine` finissero di
    caricare, rompendo tutti i 58 test esistenti. Corretto in
    `tests/helpers/harness.js#openDuel` con
    `page.addInitScript(() => { window.AUTH_GATE_SKIP = true; })` PRIMA
    della navigazione — imposta il flag di opt-out già esistente
    (pensato per `index.html`) allo stesso modo in cui lo farebbe uno
    sviluppatore reale, senza toccare in alcun modo il comportamento del
    gate per un utente vero (che quel flag non lo imposta mai). Suite
    59/59 verde, rilanciata più volte.
  - ✅ **Blocco email/account admin, risolto (con una via diversa da
    quella prevista)**: la registrazione via `CloudSync.signUp` per
    `jacopo@duelarena.it` falliva con
    `{"code":400,"error_code":"email_address_invalid",...}` — verificato
    via chiamata REST diretta a `/auth/v1/signup`, e via
    `Resolve-DnsName -Type MX/A` che il dominio `duelarena.it` non aveva
    (a quel tempo) alcun record DNS: Supabase Auth verifica la
    deliverability dell'email, non solo il formato, quindi la rifiutava
    a monte. L'utente ha risolto creando l'account DIRETTAMENTE dalla
    dashboard Supabase (Authentication → Users → Add user), un percorso
    che bypassa questa validazione lato client/signup — poi promosso ad
    admin con la query SQL in fondo a `supabase/schema.sql`, dopo il fix
    del trigger `protect_profile_privileged_columns` (vedi sopra, bug
    reale trovato eseguendo proprio questa query: `auth.uid()` è sempre
    NULL in una query lanciata a mano nell'SQL Editor). **Lezione per un
    futuro account amministratore bloccato dalla stessa validazione**:
    creare l'utente dalla dashboard Supabase invece di insistere con
    `signUp`, se il dominio dell'email non ha ancora DNS/MX validi.
  - **Ancora non fatto, noto e accettato dopo il merge in `main`**:
    `docs/architecture/GUIDA_RIUTILIZZO.md` non aggiornata con `js/cloud/auth-gate.js`/
    `admin.html`; nessun test Playwright dedicato per il flusso di
    approvazione (impossibile scriverne uno vero senza un progetto
    Supabase di test separato — la suite esistente bypassa il gate
    apposta, vedi sopra); comportamento NON verificato end-to-end contro
    un vero duello giocato con un account realmente approvato online (solo
    la creazione/promozione dell'account admin è stata confermata
    dall'utente). Se un futuro accesso reale si comporta in modo
    inatteso, ripartire da qui prima di aggiungere nuova logica.
- ✅ **3 bug reali + un riequilibrio IA/mazzi, tutti dalla stessa
  sessione**: il badge ATK/DEF sotto una carta in campo era già corretto
  (usa già `DuelEngine.getEffectiveAtk/getEffectiveDef`); il vero bug era
  nella riga "ATK X • DEF Y" del pannello informazioni carta
  (`updateCardInfoPanel`, `js/engine/game-flow.js`), che leggeva ancora
  `card.attack`/`card.defense` grezzi mentre l'anteprima subito sopra,
  nello stesso pannello, mostrava già il valore effettivo — corretto
  usando la stessa funzione. L'Evocazione Normale del bot
  (`botSummonMonster`, `js/ai/bot.js`) e quella dell'avversario reale in
  Multiplayer (`applyRemoteSummon`, `js/multiplayer/multiplayer.js`)
  chiamavano `FX.playSummonCircle` direttamente invece di
  `FX.playMonsterSummonEffect` (che controlla PRIMA un filmato dedicato/
  la convergenza elementale di Livello 7+): il bot/avversario otteneva
  quindi SEMPRE il cerchio generico anche per una carta con effetto
  speciale che il giocatore vede regolarmente — corretti entrambi.
  `ACTIONS.takeControl` (`js/engine/duel-engine.js`, il choke point unico
  per Cambio di Cuore/Furto Improvviso/Scambio di Creature/ecc.) non
  azzerava `hasAttacked`/`canChangePosition` sul mostro rubato: quei due
  flag si azzerano SOLO per il campo del giocatore di turno all'inizio
  del proprio turno, mai per quello dell'avversario, quindi un mostro
  rubato a metà turno ereditava lo stato RESIDUO dell'ultimo turno di chi
  lo possedeva prima — spesso restando bloccato in Difesa senza modo di
  girarlo in Attacco. Corretto azzerando entrambi i flag dentro
  `takeControl` stesso.
- ✅ **Riequilibrio mazzi Duellanti + moderazione IA Difficile +
  rinomina "Medio"→"Normale"**, su segnalazione esplicita dell'utente
  ("tutti i bot vanno contro ogni probabilità... sempre buco nero,
  cilindro magico, riflesso"). Causa reale trovata analizzando TUTTI i 34
  mazzi in `js/data/character-decks.js`: non un bug di mescolamento
  (Fisher-Yates in `buildDeckFromSpec`, `js/data/cards-db.js`, già
  corretto) ma la composizione stessa — OGNI mazzo, senza eccezioni,
  includeva IDENTICO lo stesso pacchetto Cilindro Magico (id 10) x2-3 +
  Buco Trappola (id 40) x2 + Forza dello Specchio (id 382) x2 + Buco
  Nero (id 7) x1-2 in 32/34 mazzi — 7-8 carte su 40 (fino al 20%) sempre
  le stesse 4 rimozioni generiche fortissime a prescindere dal
  personaggio. **Lezione per una futura sessione**: quando "sembra che
  il caso vada sempre contro l'utente", verificare PRIMA la
  composizione/densità dei dati (qui: quante copie di cosa in ogni mazzo)
  prima di sospettare il generatore casuale — qui il generatore era già
  corretto, il problema era a monte. Ridotte a 1 copia le 4 carte in
  tutti i 34 mazzi, slot liberati redistribuiti su un pool di 6 Magie/
  Trappole difensive generiche (Waboku 503, Mura del Castello 143,
  Armatura Sakuretsu 793, Incantesimo Ombra 439, Capro Espiatorio 434,
  Sette Attrezzi del Bandito 599) — richiesta esplicita "magari mette
  qualche magia o trappola difensiva" — con uno script usa-e-getta che
  ruota il pool per mazzo e verifica che ogni mazzo resti a 40 carte
  prima di scrivere il file, preservando tutti i commenti di
  ambientazione esistenti (mai toccati, solo l'array `main`). IA
  Difficile (`js/ai/ai-hard.js`) usava OGNI Magia/Trappola disponibile
  ogni turno senza limite — ora max 2 Magie attivate + 2 Trappole Settate
  per turno dalla mano (`MAX_ACTIVATE_PER_TURN`/`MAX_SET_PER_TURN`,
  stesso oggetto `usedThisTurn` già condiviso con IA_MEDIA) + max 2
  attivazioni proattive di carte già Set (`js/ai/bot.js`, ridotto da 5) —
  resta più aggressiva di IA_MEDIA (1+1) ma non più illimitata. Etichetta
  "Medio" rinominata in "Normale" OVUNQUE visibile al giocatore (pulsanti
  difficoltà, badge in duello, sottotitolo cinematica VS, toast di sfida)
  tramite un nuovo `session.difficultyLabel` (`js/duel-session.js`) che
  traduce SOLO la visualizzazione — il valore interno resta "Medio" in
  `data-difficulty`/`?difficulty=`/`DIFFICULTY_LABEL_TO_KEY`/stato
  salvato del Torneo, per non dover toccare URL o salvataggi persistiti
  per un semplice cambio di nome (stesso principio già in uso: la classe
  CSS del badge resta derivata dal valore interno `diff--medio`, così lo
  stile arancione non si rompe). **Trovato ma NON toccato in questa
  sessione (fuori scope, segnalato per una sessione futura)**: id 392
  "Nega l'Attacco" e id 820 "Nega Attacco" in `data/cards.json` sembrano
  una vera carta duplicata (stesso effetto letterale, entrambe già
  registrate in `card-effects.js`) — da investigare e risolvere seguendo
  la convenzione "si cancellano, non si segnalano soltanto", verificando
  prima se uno dei due id è già usato in un mazzo/nel pool carte casuali
  prima di rimuoverlo.
- ✅ **Freccia d'attacco più elaborata + 3 bug reali**, tutti dalla stessa
  sessione. La freccia (duelMonstersCore.html) è passata da una linea
  rossa piatta a un tratto sfumato con doppio bagliore, flusso animato
  di trattini verso il bersaglio, anello pulsante nel punto di origine,
  punta più grande — più un'evidenziazione del bersaglio agganciato
  durante il trascinamento, calcolata con la STESSA euristica di
  `endAttackDrag`/`findNearestBotMonsterSlot` (mai un'anteprima
  indipendente che potrebbe mentire su cosa scatterebbe al rilascio).
  `executeAttack` (actions.js) ora chiude sempre il pannello info carta
  all'inizio, se lasciato aperto da un hover precedente. **Bug reale
  trovato investigando "l'avatar dell'avversario si sposta per una
  frazione di secondo ad ogni cambio turno"**: `#botInfo` era rimasto
  DENTRO `.game-container`, mentre `#playerInfo` ne era già stato
  estratto in una sessione precedente per lo stesso identico motivo
  (un commento lì lo spiegava già) — un ancestor con un `transform` CSS
  diventa il containing block per i propri discendenti
  `position:fixed`, quindi `.fx-shake` (un `translate3d(...)` applicato
  a `.game-container` ad OGNI cambio turno per l'annuncio "TURNO")
  faceva scattare `#botInfo` insieme allo scuotimento invece di restare
  fermo al vero angolo del viewport. Spostato fuori esattamente come
  `#playerInfo`. **Lezione per una futura sessione**: se un elemento
  `position:fixed` "salta" o si comporta stranamente solo in certe
  animazioni, sospettare SEMPRE un `transform`/`filter`/`perspective`
  su un antenato — e controllare se un elemento fratello con lo stesso
  identico problema strutturale è già stato spostato fuori in passato
  per un trigger diverso (qui: l'intro camera-3D), lasciando l'altro
  ancora vulnerabile. Aggiunto anche un nuovo blocco
  `@media (orientation: portrait)`: su verticale la mano (nostra in
  basso, del bot in alto) è centrata su TUTTA la larghezza di
  `.game-container`, che in verticale coincide quasi con l'intero
  schermo — le carte più esterne finivano sotto/sopra il box fisso
  nome+LP+avatar, sovrapponendosi. **Primo tentativo (poi corretto,
  vedi sotto)**: un padding laterale asimmetrico per restringere l'area
  di centraggio, ma le carte restavano comunque nella STESSA riga
  orizzontale dell'avatar.
- ✅ **Correzione della sessione successiva, dopo aver visto lo schermo
  reale del telefono collegato**: il padding laterale qui sopra non
  bastava — l'utente ha chiesto una riga TUTTA SUA per la mano, separata
  in verticale dall'avatar, non condivisa lateralmente con esso.
  Sostituito con un margine VERTICALE (margin-top per `.hand--bot`,
  margin-bottom per `.hand`) pari all'altezza del box avatar (48px fisso
  su mobile) più il suo offset dal bordo schermo — nuova variabile
  `--duelist-box-offset` condivisa con `#botInfo`/`#playerInfo`, così i
  due valori non si disallineano mai. **Lezione per una futura
  sessione**: quando un fix di layout "sembra corretto" da un test
  automatizzato ma l'utente lo respinge dopo aver visto il dispositivo
  reale, il modo più veloce per capire la richiesta VERA è chiedere
  (o farsi mandare) uno screenshot del device reale invece di continuare
  a indovinare varianti dello stesso approccio sbagliato — qui bastava
  guardarlo per capire che serviva una riga separata, non un
  aggiustamento di padding.
- ✅ **Verifica end-to-end su dispositivo Android reale collegato via
  adb** (richiesta esplicita dell'utente, "ho il telefono collegato"):
  scoperti DUE APK distinti (non solo il dev-shell già noto in
  `C:\AndroidDev\YuGiOhGameAndroid`) — un secondo progetto
  `C:\AndroidDev\YuGiOhGameAndroidProd` (`capacitor.config.json` punta a
  `https://jacopofa92.github.io/YuGiOhGame/`, non alla LAN) genera
  l'APK `com.jacopofa92.yugiohduelarena.prod`, già installata sul
  telefono dell'utente. GitHub Pages serve `main` direttamente (nessun
  workflow di deploy nel repo, confermato verificando `manifest.json` in
  produzione dopo un push) — stesso identico principio "installa una
  volta, mai più ricompilare" del dev-shell locale, solo via URL
  pubblico invece di LAN: **anche l'APK di produzione non richiede MAI
  una vera ricompilazione Gradle per un cambio HTML/JS/CSS**. Verificato
  con screenshot reali via `adb exec-out screencap`/`adb shell
  screencap` + `adb pull` (la redirezione PowerShell `>` corrompe
  l'output binario di `exec-out`: usare sempre `screencap -p
  /sdcard/x.png` poi `adb pull`, mai la pipe diretta). Il dev-shell
  locale, invece, richiede che il telefono sia sulla STESSA rete WiFi
  del PC (non basta il cavo USB/adb) — trovato un caso reale in cui il
  telefono era su dati cellulari (5G) senza alcun WiFi attivo
  (`adb shell ip -4 addr` non mostrava alcuna interfaccia wlan0 con IP),
  quindi l'app dev-shell mostrava schermo nero: non un bug, un problema
  di rete lato dispositivo, verificabile così in una sessione futura
  prima di sospettare il codice.
- ✅ **IA: mai Evocare i pezzi di Exodia** (`AI_SHARED.shouldHoldForExodia`,
  `js/ai/ai-shared.js`, usata da `chooseSummon` in ai-medium.js/ai-hard.js),
  richiesta esplicita dell'utente ("se Yugi Muto (e/o il nonno) ha le
  carte di Exodia, deve tenerle in mano e non giocarle... deve puntare
  ad avere i 5 pezzi"). Il bot poteva Evocare Normalmente un pezzo di
  Exodia il Proibito (`EXODIA_PIECE_IDS`, game-flow.js) come un mostro
  qualunque, vanificando l'obiettivo di assemblarli tutti e 5 in mano
  per la vittoria istantanea (`hasExodiaAssembled`) — i pezzi hanno
  comunque statistiche di battaglia trascurabili (200-300 ATK/DEF).
  Generico per id carta, non per personaggio: si applica da sola a
  QUALUNQUE mazzo del bot li contenga (verificato: solo Yugi Muto ed
  Espa Roba nel dataset attuale, mai Solomon Muto nonostante il dubbio
  dell'utente).
- ✅ **id 671 (Dispositivo di Evacuazione Forzata) chiuso — nuovo
  `chooseFieldMonsterTarget` (card-effects.js)**: bug reale segnalato
  dall'utente ("deve far scegliere 1 mostro sul terreno... ma non lo
  fa"). Sceglieva sempre il primo mostro scoperto trovato (l'avversario
  prima, poi il proprio Terreno) invece di una vera scelta. Corretto
  riusando la STESSA interfaccia già consolidata per una scelta tra
  carte vere (`window.DuelEngineUI.openCardListPicker` — stesso schema
  già usato in actions.js per scegliere quale mostro sacrificare per un
  attacco con Tributo extra): i candidati sul Terreno sono già vere
  `card`, nessuna UI nuova da costruire. **Riusabile per qualunque
  futura carta con lo stesso bisogno** ("scegli 1 mostro vero tra più
  candidati già sul Terreno, proprio e/o dell'avversario"). Il bot
  continua a scegliere da solo il primo candidato, invariato. Bug minore
  scoperto nello stesso punto: il pannello d'anteprima del picker
  (`showCardInfo`, actions.js) leggeva ATK/DEF grezzi invece di quelli
  effettivi — stesso identico bug/fix già applicato a
  `updateCardInfoPanel` in questa sessione.
- ✅ **13 nuovi Duellanti in Duello Libero, tema Forbidden Memories — i
  guardiani del dungeon del Labirinto**, richiesti esplicitamente
  dall'utente e posizionati tra Sacerdotessa Isis ed Heishin: Ocean
  Mage/High Mage Secmeton (Acqua), Forest Mage/High Mage Anubisius
  (Zombie/Guardiani della Tomba), Mountain Mage/High Mage Atenza
  (Roccia/Drago), Desert Mage/High Mage Martis (Bestia Alata/Macchina),
  Meadow Mage/High Mage Kepura (Fata/Bestia), più Labyrinth Mage
  (Incantatore/Trappole Counter), Sebek (Dinosauro/Rettile) e Neku
  (Guerriero/Drago) senza controparte "base". Ogni mazzo: 20 mostri + 11
  Magie + 9 Trappole = 40, stesso criterio di diluizione dei 4 rimozione-
  generiche già applicato al resto del roster in questa sessione (mai
  più di 1 copia di Buco Nero/Cilindro Magico/Buco Trappola/Forza dello
  Specchio). **Metodo per un futuro giro di content-creation simile**:
  delegare la catalogazione dei pool di carte candidate per tema
  (razza/attributo su `data/cards.json`) a un agente Explore dedicato
  PRIMA di assemblare i mazzi a mano — con 13 mazzi da costruire sarebbe
  stato altrimenti troppo lento cercare manualmente ogni razza una per
  volta. Verificare SEMPRE con uno script usa-e-getta che ogni mazzo
  totalizzi davvero 40 (il conteggio a mano di liste lunghe è
  soggetto a errori: 9 dei 13 mazzi di questa sessione sono usciti a 39
  al primo tentativo, per un singolo `{id,qty}` contato male). Rimosso
  "Duel Master K" (nessun altro riferimento nel codice a parte
  characters-db.js/character-decks.js, rimozione pulita).
- ✅ **10 bug da `docs/planning/TODOLIST_BUGS.md` (file di lavoro dell'utente, ogni punto
  ora smarcato `[x]`), tutti risolti nella stessa sessione**:
  1) **Magie Veloci (subtype `quick-play`) attivabili SOLO in Main Phase,
     mai in Battle Phase**: `actions.js#handleCardClickInner` gate va va
     tutte le interazioni di mano/Terreno a `isMainPhase`, senza
     eccezioni — per testo reale una Magia Veloce si attiva con lo stesso
     timing di una Trappola. Corretto con un'eccezione puntuale (mano E
     già Set sul Terreno) che aggiunge la Battle Phase del proprio turno
     SOLO per `card.subtype === 'quick-play'` — non un vero sistema di
     priorità ad ogni fase (limite strutturale già documentato altrove in
     questo file per l'"Effetto Veloce"), ma copre il caso reale più
     comune. Il turno avversario resta fuori scope (nessuna carta di
     questo motore può rispondere "a piacere" fuori da una Chain già
     aperta).
  2) **Scelte via `openCardListPicker` che non ridisegnavano nulla**
     (es. Maga della Fede id 588: aggiunge una Magia scelta alla mano, ma
     restava invisibile finché non arrivava un render successivo per un
     altro motivo): il picker è asincrono (si apre, il chiamante ha già
     fatto il proprio `updateUI()` PRIMA di aprirlo), quindi la mutazione
     dentro `onSelect` non veniva mai ridisegnata da sola. **Bug
     REALE trovato risolvendo QUESTO**: il primo tentativo chiamava il
     vero `updateUI()` (che richiama anche `recomputeStaticEffects()`) —
     per una carta con una scelta in SEQUENZA (es. Gilford la Leggenda id
     709: equipaggia più Equip una alla volta, ogni scelta riapre subito
     il picker successivo) questo faceva ripulire a metà catena Carte
     Equipaggiamento non ancora del tutto valide, corrompendo lo stato
     (scoperto scrivendo un test mirato, non dall'utente). Corretto con
     un refresh DELIBERATAMENTE leggero (`renderPlayerHand`/
     `renderBotHand`/`renderFields`/`renderEquipLinks`, MAI il vero
     `updateUI()`) applicato in 3 punti (`openCardListPicker`,
     `openPositionPicker`, `openChoicePopover` — tutte le scelte
     asincrone condivise di questo motore) — stesso principio anche per
     il bug #9 qui sotto. **Lezione per un futuro caso simile**: quando
     serve un refresh dopo una scelta asincrona in una possibile
     SEQUENZA di scelte, mai il refresh "completo" — solo i render
     puramente visivi, mai un ricalcolo degli effetti Continui a metà
     catena.
  3) **"Scarta 1 carta [dalla mano]" come costo/effetto di un'altra
     carta non lasciava mai scegliere QUALE**: ~15 carte (Tributo ai
     Dannati 492, Chiron il Mago 150, Notte Meccanica 153, Rottura di
     Raigeki 624, Drago Armato LV5/LV7 641/864, Virus Infetta-Tribù 697,
     Flamberge del Male Infranto 727, Vortice Fulmineo 729, Ninja
     Signora Yae 780, Festa Isterica 790, Scavo Fossile 823, Trapano
     Ingranaggio Antico 842, Ritorno dei Dannati 418, Ala Grigia 1073,
     Confisca 874) scartavano sempre `ctx.hand(ctx.owner)[0]` invece di
     una vera scelta — stessa identica famiglia di "primo candidato
     invece di scelta" già chiusa altrove in questo file per Deck/
     Cimitero/Terreno, qui per la mano. Nuovo helper condiviso
     `offerHandDiscardChoice(ctx, options, onDiscarded)`
     (card-effects.js, accanto a `chooseFieldMonsterTarget`):
     `options.filter` per i costi che vincolano il TIPO di scarto (es.
     "scarta 1 Magia" di Chiron), `options.handOwner` (default
     `ctx.owner`) per le poche carte che fanno scegliere una carta dalla
     mano DELL'AVVERSARIO (Confisca id 874, stesso principio di Amazzone
     Maestra delle Catene id 86 — missingEffectNote rimosso),
     `options.pickForBot` per un'euristica dedicata quando l'auto-scelta
     del bot non deve essere solo "la prima" (Confisca:
     AI_SHARED.scoreCardImpact). **Deliberatamente NON migrate**: le
     carte Trappola Contatore "scarta 1 carta per annullare" (189, 361,
     396, 689, 752) che rispondono DENTRO una Chain già aperta — il loro
     `activate()` legge `gameState.chain.links` assumendo che
     `canActivate()` l'abbia già garantito sincronamente; aprire un
     picker asincrono lì avrebbe richiesto toccare la delicata
     risoluzione della Chain per un guadagno marginale (quelle carte
     hanno comunque quasi sempre un solo candidato reale). **Bug
     correlato ma opposto trovato e corretto nello stesso giro**: Dicelops
     (863) usava `discardChosenFromHand(..., 0)` per il proprio scarto
     "a caso" (dado 1/2-5) — sempre la PRIMA carta, mai davvero casuale;
     corretto con `discardRandomFromHand`, l'esatto contrario del bug
     principale (qui l'imprevedibilità è il comportamento corretto, non
     una scelta).
  4)/7) **"Deck Spellcaster"/"Deck Fiamma" (Structure Deck SD6/SD3,
     `js/data/starter-structure-decks.js`, clonabili da Creazione Deck)
     segnalati "buggati"**: **bug reale grave trovato e chiuso** in
     Ritorno di Fiamma / Backfire (id 690, Trappola Continua del mazzo
     Fiamma): il suo `canActivate` leggeva `ctx.destroyedCard.attribute`
     — un campo che esiste SOLO nel ctx reattivo passato a
     `onOwnMonsterDestroyed`, MAI nel ctx di un'attivazione manuale
     (mettere scoperta la Trappola dal Terreno) — quindi lanciava SEMPRE
     un'eccezione, rendendo la carta impossibile da attivare in
     qualunque momento reale del gioco. Il filtro Attributo FUOCO andava
     dentro `onOwnMonsterDestroyed` stesso (dove ora è), non in
     `canActivate` (che non ha bisogno di alcuna condizione extra: la
     Trappola è sempre attivabile con la normale tempistica). **Metodo
     per un futuro audit di deck simile**: un harness Playwright che
     richiama OGNI hook (`canActivate`/`activate`/`static`/`onSummon`/
     ecc.) di ogni carta del mazzo con un board minimo popolato,
     catturando le eccezioni — individua in pochi secondi bug come
     questo che altrimenti richiederebbero di giocare a mano fino a
     pescare la carta giusta nel momento giusto (falsi positivi vanno
     comunque scartati a mano: `activate()` delle Trappole Contatore
     189/689/752 nell'audit lanciava un errore perché il test non
     allestisce `gameState.chain`, precondizione che `canActivate()`
     garantisce già nel gioco reale). Il mazzo Spellcaster ha ricevuto
     anche il fix del bug #2 (Maga della Fede, id 588, è nel suo pool) e
     del bug #3 (Vortice Fulmineo, id 729).
  5) **Nessuna carta di questo motore "aspettava" un modale/scelta
     aperta**: `phaseTransitionTimeout` (cambi fase, inizio turno del
     bot) usava `setTimeout` puro ovunque, senza alcun controllo se un
     modale o una scelta fosse ancora a schermo — causa concreta della
     "sovrapposizione" del bug #10 qui sotto. Nuovo
     `isBlockingModalOpen()` (game-flow.js): vero se un
     `.modal-backdrop.open` (activateModal/cardListPickerModal/
     surrenderModal), un `#quickPopover` (creato/rimosso da
     openQuickPopover/closeQuickPopover), o una selezione
     "clicca sul campo" (`gameState.pendingTributeSummon`/
     `pendingHandDiscard`) sono presenti — un unico punto invece di
     ripetere la lista a mano ad ogni nuovo controllo futuro. Nuovo
     `schedulePhaseTransition(fn, delay)` sostituisce OGNI
     `phaseTransitionTimeout = setTimeout(...)` di game-flow.js: se al
     momento di scattare c'è ancora una scelta bloccante aperta, si
     riprova dopo 300ms invece di procedere. Il ciclo autonomo del bot
     (bot.js) non è stato toccato (già protetto in gran parte da Promise
     dedicate attorno alle proprie scelte note, vedi il commento in
     `botTurn`) — dato che `changeTurn` stesso ora aspetta, il turno del
     bot non può nemmeno INIZIARE finché il giocatore ha qualcosa aperto.
  6) **Nessun indizio visivo che una Carta Equipaggiamento fosse
     agganciata a un mostro**: nuovo `renderEquipLinks()` (game-flow.js),
     chiamato alla fine di `updateUI()` e nel resize debounced — disegna
     una linea tratteggiata dorata animata (nuovo SVG dedicato
     `#equip-links-svg`, z-index più basso della freccia d'attacco) tra
     ogni Carta Equipaggiamento scoperta (`slot.card.equippedToUid`) e il
     mostro a cui è agganciata, per ENTRAMBI i lati (un equip può restare
     agganciato a un mostro dell'avversario, es. Flamberge del Male
     Infranto id 727). Selettore `[data-uid="..."]` su un attributo già
     scritto da ogni carta renderizzata — nessun nuovo hook di rendering
     necessario.
  8) **`DuelEngine.trySpecialSummonFromHand` forzava SEMPRE Posizione di
     Attacco** per qualunque carta si auto-Special-Summona dalla mano
     (33 carte, es. Guardian Eatos id 523, Il Demone Megacyber id 467) —
     per regolamento reale, se un effetto Special Summona senza
     specificare la Posizione, sceglie chi CONTROLLA quella Summon.
     Nuovo `gameState.pendingSpecialSummonPosition` (consumato
     sincronamente da `trySpecialSummonFromHand`, mai un picker al suo
     interno — stesso principio già in uso per
     `pendingSpecialSummonBanishUids`/`TributeUids`) + nuovo
     `finishSpecialSummonFromHand(card, handIndex)` (actions.js): chiede
     Attacco/Difesa (`DuelEngineUI.openPositionPicker`) PRIMA di
     chiamare `trySpecialSummonFromHand`, a meno che
     `def.specialSummonFixedPosition` non fissi la Posizione per le
     carte il cui testo reale la specifica (es. Gilasaurus id 266:
     sempre scoperto in Attacco, verificato — l'unica marcata finora, le
     altre 32 restano a chiedere per default, il comportamento corretto
     quando non si è certi del testo esatto). **Scope volutamente
     ristretto**: le carte che hanno GIÀ un costo a scelta multipla
     (bandisci/tributa/sacrifica N carte, es. Inferno 677/Fenrir 698/
     Teschio Evocato Toon 486) NON chiedono anche la Posizione — impilare
     una seconda scelta asincrona sopra un costo già a scelta avrebbe
     rotto l'assunzione "il costo appena scelto fa procedere SUBITO la
     Summon" su cui contano diversi test già verificati (scoperto
     rompendo 2 test in un primo tentativo, poi ristretto). Il loro testo
     reale fissa comunque quasi sempre Attacco per questo tipo di Summon
     "di rivincita" — comportamento invariato per loro.
  9) Stessa causa/stessa soluzione del bug #2 — il refresh leggero dopo
     ogni scelta asincrona (picker E popover) risolve anche il sintomo
     più generico "a volte non si refreshano le carte nel campo".
  10) Stessa causa/stessa soluzione del bug #5 — `schedulePhaseTransition`
      impedisce che un cambio fase o l'inizio del turno del bot si
      sovrappongano a un modale/scelta ancora aperti.
  Suite motore 59/59 verde (un test è stato rotto e richiuso 2 volte nel
  corso di questa stessa sessione, vedi il bug #2 sopra per la causa
  reale trovata grazie a quel fallimento).
- ✅ **Audit di sessione successiva su richiesta esplicita dell'utente
  ("controlla se ci sono altri bug negli structure deck")**: esteso
  l'harness Playwright del bug #4/7 qui sopra (nato per SD3/SD6) a TUTTE
  e 10 le Structure Deck (SD1-SD10, `js/data/starter-structure-decks.js`,
  265 carte uniche) — nessun nuovo bug "lancia un'eccezione" trovato
  oltre a id 690 (già chiuso). Raffinato l'harness per eliminare i falsi
  positivi del primo giro: `static()` ora riceve un vero `ctx.slot`
  (come lo passa davvero `recomputeStaticEffects`) e `activate()` viene
  chiamato SOLO se `canActivate()` dice di sì (la garanzia che il motore
  reale offre sempre) — senza questi due accorgimenti, OGNI Carta
  Equipaggiamento del dataset (`def.isEquip`) risulta un falso "bug" nei
  suoi hook `static`/`activate` quando testata isolata senza un vero
  bersaglio agganciato, dato che `recomputeStaticEffects` normalmente
  intercetta e ripulisce un equip non valido PRIMA di chiamare
  `static()` — mai raggiungibile con un bersaglio mancante nel gioco
  reale. **Metodo utile per un futuro audit simile**: se un nuovo giro
  di stress-test su `canActivate` isolato segnala un errore per una
  carta con `def.isEquip: true`/`def.continuous: true`, verificare PRIMA
  se serve solo un `ctx.slot`/una guardia `canActivate` mancante
  nell'harness stesso, non nel motore.
- ✅ **Pila della Catena (Chain) — nuova UI, richiesta esplicita
  dell'utente ("gestisci meglio lato UI le catene di botta e risposta
  di magie/trappola tra i giocatori")**: prima l'unico segnale di una
  Chain in corso era il pulse "carta a centro schermo" (una carta alla
  volta, sparisce subito) più una riga nel log (pannello chiuso per
  default) — niente che facesse capire a colpo d'occhio quanti Link
  fossero già impilati, di chi, o in che ordine si sarebbero risolti.
  Nuovo pannello fisso in alto al centro (`#chainStack`, HTML/CSS in
  duelMonstersCore.html + `renderChainStack()` in game-flow.js): una
  miniatura per ogni Link accumulato (il primo a sinistra, ogni risposta
  successiva a destra), etichetta "Link N" stabile per tutta la vita del
  link (`link.linkNumber`, assegnato una sola volta quando il link viene
  aggiunto — mai ricalcolato dall'indice nell'array, che cambia ad ogni
  pop durante `resolveChain`), quello evidenziato/pulsante è sempre
  l'ULTIMO aggiunto (vera Chain LIFO: si risolve per primo). Popolato da
  3 punti in duel-engine.js (`openActivationWindow` al link iniziale,
  `askNextRound` ad ogni risposta accumulata, `resolveChain` ad ogni
  link rimosso/risolto) — game-flow.js resta senza dipendenze dal motore
  (la funzione è chiamata da duel-engine.js, mai il contrario). Anche il
  modale "🛡️ Rispondere?" (actions.js) ora indica il numero di Link a
  cui si starebbe per rispondere.
  **Bug reale introdotto e corretto nella stessa sessione**: il primo
  tentativo ritardava la rimozione REALE del link da `chain.links` fino
  a DOPO il suo pulse (~2s), per tenerlo visibile/evidenziato nella pila
  più a lungo — questo però allargava la finestra in cui l'array
  condiviso conteneva un link "già in lavorazione", e un
  `resolveChain()` RIENTRANTE scatenato dal ciclo naturale della pagina
  (bot/cambio fase, mai del tutto fermabile da `freezeNaturalGameLoop`
  nei test — vedi tests/README.md) poteva vederlo ancora in cima e
  interferire con la sua risoluzione: un test esistente
  (`chain-resolution.spec.js`, Caso 3) lo ha catturato immediatamente,
  fallendo in modo deterministico. Corretto ripristinando la rimozione
  IMMEDIATA e sincrona di sempre (`chain.links.pop()` in testa a
  `resolveNext`, invariata rispetto a prima di questa sessione) e
  passando il link già rimosso a `renderChainStack(link)` come "voce
  fantasma" SOLO per la visualizzazione (aggiunta in coda all'array
  reale via spread, mai reinserita in `gameState.chain.links`) — stessa
  UI finale, zero rischio sull'architettura di risoluzione. **Lezione
  per una futura modifica alla Chain**: non ritardare MAI la rimozione
  di un link da `gameState.chain.links` per motivi puramente di
  presentazione — se serve mostrarlo ancora un istante, passarlo
  esplicitamente al layer di rendering come dato a parte, mai lasciarlo
  più a lungo del necessario nella struttura dati condivisa e
  potenzialmente rientrante.
- ✅ **Risoluzione della Chain resa non rientrante
  (`chainResolutionInFlight` + `pendingChainResolutionCallbacks`,
  duel-engine.js) — bug REALE preesistente, non introdotto dal
  rallentamento della Chain che l'ha fatto emergere**: `gameState.chain.links`
  è UNO SOLO, condiviso da ogni finestra (`openActivationWindow`,
  `openTriggerWindow`, `openDrawResponseWindow`), ma `resolveChain()` è
  asincrona (un link alla volta, ognuno aspetta il proprio pulse ~2s) e
  nulla impediva a un SECONDO `resolveChain()` di partire mentre il primo
  era a metà: i due si contendevano lo stesso array, il primo poteva
  trovarlo già svuotato dall'altro e chiamare il proprio `onDone` IN
  ANTICIPO, lasciando un link superstite a risolversi molto più tardi —
  dentro una Chain successiva che non c'entrava nulla, arrivando a
  consumarne le carte. Non è teorico: il colpevole concreto è il normale
  ciclo di gioco della pagina (`enterDrawPhase` ->
  `openDrawResponseWindow`, game-flow.js:1104), che apre una finestra di
  risposta mentre una Chain precedente sta ancora risolvendo — quindi
  NON fermabile da `freezeNaturalGameLoop()` nei test (è esattamente la
  cascata già documentata in tests/README.md). Corretto con una guardia:
  un `resolveChain()` che arriva mentre uno è già in corso non apre una
  seconda risoluzione parallela — accoda solo il proprio `onDone`, e i
  link che ha appena aggiunto vengono risolti comunque dalla risoluzione
  in corso (che ricontrolla `chain.links` ad ogni passo). **Metodo che
  l'ha trovato, utile per un futuro bug "di tempi" nella Chain**: non la
  lettura del codice (la modifica sospettata era corretta), ma uno stack
  trace stampato all'ingresso di `resolveChain()` in una copia
  temporanea del motore, che ha mostrato in un colpo solo CHI stava
  aprendo la seconda risoluzione.
- ✅ **Collegamento visivo Equip (bug della sessione precedente)
  segnalato dall'utente come "non sembra funzionare"** — verificato: la
  linea SVG veniva creata correttamente (coordinate giuste, DOM
  presente), ma era di fatto INVISIBILE nel caso più comune (equip e
  mostro nella stessa colonna, slot verticalmente adiacenti): 1) la
  linea centro-a-centro passava esattamente sotto il badge ATK/DEF
  (`.field-stats-badge`, anch'esso centrato) che la copriva quasi del
  tutto, 2) un tratto sottile (2.5px, dash-array fitto) restava
  impercettibile su un segmento di poche decine di px contro uno sfondo
  già affollato — confermato SOLO con uno screenshot Playwright
  ravvicinato (una verifica "esiste nel DOM" da sola non basta per un
  bug di percezione visiva, va guardato per davvero). Corretto in
  `renderEquipLinks()` (game-flow.js): i due punti di aggancio si sono
  spostati dal centro al 28% della larghezza di ciascuna carta (bordo
  sinistro, fuori dal badge), tratto portato a 4px con bagliore doppio,
  e due pallini pieni alle estremità (restano un indizio chiaro anche a
  segmento cortissimo). **Lezione per un futuro effetto visivo simile**:
  non fermarsi a "l'elemento esiste con le coordinate giuste" come prova
  di funzionamento — se l'effetto deve essere notato dall'utente durante
  il gioco normale, verificarlo con uno screenshot ravvicinato della
  scena reale (qui: due carte impilate verticalmente, il caso più
  comune), non solo con un controllo programmatico sul DOM.
- ✅ **Gestione salvataggi Cloud/Locale dal Profilo, ripulita — richiesta
  esplicita dell'utente ("non si capisce bene cosa si può/deve fare...
  è anti UI")**: la sezione "Account Cloud" (profilo.html + la vista
  fusa in index.html) portava ancora un intero form di accesso/
  registrazione/recupero password (`#cloudLoggedOut`, email+password+
  "Password dimenticata?") residuo di QUANDO il cloud era facoltativo —
  da quando un account approvato è diventato OBBLIGATORIO per giocare
  (auth-gate.js blocca ogni pagina prima ancora di arrivarci), quel form
  non poteva più comparire per davvero, ma restava lì a generare
  l'esatta domanda "devo accedere di nuovo?" lamentata dall'utente.
  Rimosso del tutto (HTML + handler + il modale "recupera password"
  dedicato, ormai irraggiungibile — il vero recupero password vive solo
  nel Gate di index.html, PRIMA del menu). La sezione ora mostra solo
  "Connesso come X" + una frase che spiega QUANDO scatta la
  sincronizzazione automatica (all'uscita/cambio account) + "Esci
  dall'account", con "Sincronizzazione manuale (avanzato)" ed "Elimina
  account cloud" chiusi dentro due `<details>` separati (aperti solo se
  servono davvero, invece di un muro di pulsanti sempre visibile). La
  sezione "Salvataggio locale" è stata rinominata "Backup manuale su
  file" con una frase che ne chiarisce lo scopo (copia extra facoltativa,
  non un secondo salvataggio da mantenere aggiornato a mano). **Bug reale
  trovato e corretto nello stesso giro**: "Cambia account" nella pagina
  STANDALONE `profilo.html` non aveva mai ricevuto il fix già applicato
  alla vista Profilo fusa in index.html in una sessione precedente (vero
  `CloudSync.signOut()` prima di ricaricare, non solo pulire
  `sessionStorage`) — le due copie erano andate alla deriva, esattamente
  il rischio "stessa lista di script/markup duplicata a mano in più
  pagine" già documentato altrove in questo file. Applicato lo stesso fix
  a entrambe. Verificato con Playwright (nessun errore JS, elementi morti
  spariti, `<details>` presenti) su entrambe le pagine — nessun test
  Playwright dedicato esiste per il flusso cloud reale (serve un vero
  account Supabase, coerente con la nota già esistente su questo limite).
- ✅ **Audit UI/UX mobile/APK esplicito ("controllo qualità... in ottica
  mobile apk") + 4 correzioni scelte dall'utente ("1 3 e 5" + il pulsante
  Indietro della topbar)**:
  - **Trovato e corretto durante l'audit stesso, prima di qualunque
    richiesta**: `renderEquipLinks()` (game-flow.js, nato la sessione
    precedente) poteva andare in crash se il listener `resize` scattava
    PRIMA che `gameState` fosse popolato dal boot del duello (es. una
    rotazione schermo/tastiera virtuale molto precoce) — aggiunta una
    guardia difensiva (`if (!gameState.playerSTField...) return;`).
  - **1) Tasto Indietro Android durante un duello**: verificato con un
    test dedicato (Capacitor/App plugin mockati) che il meccanismo
    `pushState`/`popstate` già esistente in `setupSurrenderButton()`
    (game-flow.js) COPRE GIÀ il caso comune (Capacitor chiama
    `window.history.back()`, che scatena comunque `popstate`) — l'audit
    iniziale aveva sovrastimato il rischio non avendo ancora letto questo
    meccanismo. Resta un caso limite reale: se `Capacitor.canGoBack`
    risultasse `false` (stato interno della WebView, non sempre garantito
    allineato subito dopo un `pushState`), il default di
    `app-back-button.js` ricadrebbe su `AppPlugin.exitApp()`, uscendo
    dall'app a metà duello senza alcuna conferma. Chiuso registrando ANCHE
    un `NativeBackButton.setHandler()` dedicato: se il modale di conferma
    è già aperto lo chiude (= Annulla), altrimenti lo apre sempre lui,
    mai lasciando scattare il default durante un duello in corso.
    **Multiplayer NON coperto** (il pulsante Abbandona stesso è già
    nascosto lì: abbandonare richiederebbe avvisare l'altro giocatore,
    un vero protocollo di rete mai costruito — segnalato come gap
    separato, più profondo di un semplice fix UI, non affrontato qui).
  - **3) Pulsante "Abbandona" troppo piccolo per il tocco** (fino a
    ~19px di altezza reale sui breakpoint più stretti): area
    CLICCABILE allargata di 10px per lato con uno pseudo-elemento
    invisibile (`::before` assoluto, scoped dentro `@media
    (max-width:900px)`) — non sposta né ridimensiona badge vicini
    (Tempo/Difficoltà, impilati nello stesso angolo con poco spazio
    verticale), solo la zona di tocco vera. Aggiunto anche un vero stato
    `:active` (schiacciato al tocco, prima assente) e un filo di padding
    visivo in più sul breakpoint principale.
  - **5) Pannello "Descrizione carta" troppo ingombrante su schermi
    piccoli** (apriva su ogni tap di una carta, fino a metà larghezza
    schermo e all'82% dell'altezza): `--info-card-w` ridefinita SOLO
    dentro `.card-info-panel` (scoped, mai la variabile globale in
    `:root` usata altrove per la stessa dimensione base) a un valore più
    piccolo, `max-height` portata da 82dvh a 62dvh — lascia visibile
    molto più campo di gioco dietro/intorno mentre il pannello resta
    aperto. Il tap-fuori-per-chiudere esisteva già (non era il problema
    reale, l'audit iniziale l'aveva segnalato per errore).
  - **Pulsante Indietro della topbar condivisa (`js/ui/topbar.js`/
    `.css`, 11+ pagine) — richiesta esplicita dell'utente ("è scomodo...
    fai tutto molto più app telefono, MA SENZA cambiare la versione
    desktop")**: diventava PIÙ PICCOLO su mobile (28px, poi 26px in
    landscape basso) invece che più grande — l'opposto di quanto serve
    per un tocco preciso col dito. Portato a 44px (lo standard
    Material/HIG per un'area di tocco comoda) sul breakpoint principale,
    38px nel solo caso limite di landscape molto basso (spazio verticale
    insufficiente per 44px pieni). Aggiunto anche un vero stato `:active`
    (mai esistito: solo `:hover`, inutile su touchscreen) e un tocco
    "app vera" — `NativeHaptics.light()` (già esistente in
    `js/native/haptics.js`, no-op su web) ad ogni tap sul pulsante.
    **Entrambe le modifiche scoped dentro i due `@media` già dedicati al
    mobile**: la regola desktop (40px, solo `:hover`) resta bit-per-bit
    identica, verificato esplicitamente con Playwright a 1280px.
  Suite motore 59/59 verde (nessun file del motore vero e proprio
  toccato per i punti 3/5/topbar, solo CSS/HTML + il fix del back-button
  in game-flow.js per il punto 1).
- ✅ **Torneo "Regno dei Duellanti": il Castello ora usa la mappa a nodi
  invece di schermate-card separate, più un contatore persistente di
  tentativi/completamenti**, entrambe richieste esplicite dell'utente
  dopo un messaggio inizialmente ambiguo (chiarito con due domande
  mirate via AskUserQuestion — vedi sotto per la lezione di metodo).
  - **"Replica i nodi come fuori dal castello"**: semifinale/finale/
    Pegasus non aprono più la vecchia schermata `renderCastleStage`/
    `renderCastleChallenge` a pieno schermo — sono diventati un nodo
    unico sulla mappa (`renderMap`, come un bivio sull'isola aperta),
    con un'unica differenza voluta: a differenza di un incontro casuale
    (icona "❔ Sentiero N", a sorpresa), l'avversario del Castello è già
    noto in anticipo, quindi il nodo mostra subito la sua vera icona
    (🥊/🏆/🏰, `CASTLE_STAGE_META`, esteso con una voce `pegasus` prima
    assente) e il suo vero nome (`getRosterCharacter`). Nuova
    `ensureCastleChallengeRoute(state)` genera un `pendingRoutes` con un
    solo elemento `{kind:'castleChallenge', characterId, castleStage}`
    riusando `assignChoicePositions` (stessa animazione di comparsa di
    un bivio vero); `resolveChosenRoute` guadagna il ramo
    `'castleChallenge'` che lancia il duello esattamente come faceva
    prima il pulsante "⚔️ Sfida!" di `renderCastleChallenge`. Zero
    infrastruttura nuova per lo stato: `pushHistoryNode(state,'win',...)`
    veniva già chiamata per ogni vittoria al Castello da una sessione
    precedente, semplicemente non c'era ancora nulla che la
    visualizzasse come nodo. `renderCastleStage` ridotta al solo ramo
    "campione" (`renderCastleChallenge` resta invece condivisa con il
    Cancello di Kaiba, unico chiamante rimasto) — dead code rimosso, non
    solo lasciato lì, dopo aver verificato con Playwright che nessun
    altro punto vi facesse più riferimento.
  - **Contatore "quante volte ho già fatto il torneo"**: l'utente ha
    scelto esplicitamente "solo un contatore, nessun limite" — il
    torneo resta liberamente ripetibile (`saveState(null)` su Abbandona/
    Ricomincia, invariato) esattamente come Duello Libero/Sfide non sono
    mai limitati in questo gioco. Il punto architetturale delicato:
    `save.tournaments[id]` (lo stato DELLA PARTITA in corso) viene
    azzerato ad ogni reset, quindi un contatore che deve sopravvivere a
    quell'azzeramento non può vivere lì — nuovo
    `save.tournamentStats[id] = {attempts, completions}` in
    `js/save-manager.js` (stesso schema di backfill retrocompatibile di
    `challenges`/`tournaments`, anche in `applyExternalSave`), con
    `getTournamentStats`/`incrementTournamentStat` generici per id
    torneo (riusabili SENZA modifiche per un futuro Battle City).
    `attempts` incrementato su "🚀 Inizia il Torneo", `completions`
    quando `castleStage` diventa `'champion'` (Pegasus sconfitto) —
    mostrato come riga "🔁 Tentativi: N · 👑 Completamenti: N" nella
    schermata iniziale del torneo, solo se `attempts > 0`.
  - **Lezione di metodo, la parte più importante di questa voce**: il
    messaggio originale dell'utente ("ho i nodi... anche quando entro
    nel castello") sembrava un bug report, e due tentativi di
    riproduzione dal vivo con Playwright (uno per state-injection, uno
    per flusso reale con click) confermavano ENTRAMBI che il codice
    ATTUALE non mostrava alcun nodo dentro il Castello — nessun bug
    riproducibile. La domanda mirata via AskUserQuestion, con
    un'opzione "Altro" a testo libero, ha rivelato che non era affatto
    un bug: l'utente voleva che i nodi apparissero, il messaggio
    originale descriveva un'aspettativa non ancora implementata, non un
    comportamento osservato per errore. **Quando un'indagine di codice E
    una riproduzione dal vivo escludono entrambe un bug, ma il
    messaggio dell'utente resta ambiguo tra "bug" e "richiesta di
    funzionalità", chiedere esplicitamente invece di continuare a
    cercare un bug che potrebbe non esistere** — qui ha capovolto
    completamente l'ipotesi di lavoro (da "qualcosa mostra nodi per
    errore, va tolto" a "nulla mostra nodi ancora, va costruito").
  Suite motore 59/59 verde. `sw.js` aggiornato (bump a v10).
- ✅ **Audit generale del motore ("controlla se ci sono altri bug"),
  richiesto esplicitamente dall'utente dopo aver scelto "audit generale"
  tra 3 opzioni di scope proposte — 2 carte duplicate reali trovate e
  chiuse, più un nuovo test di regressione permanente**:
  - **Generalizzato a TUTTO il dataset (1081 carte) l'harness di stress-
    test nato per l'audit sugli Structure Deck** (vedi il bullet
    dedicato più sopra in questo file): richiama `canActivate`/
    `activate`/`static` di OGNI carta REGISTRATA in CardEffects con un
    board minimo (un mostro filler per lato, un finto link in cima alla
    Chain per le Trappole Contatore), chiamando gli hook DIRETTAMENTE
    (bypassa `activateCard`/`resolveChain`, che li avvolgono già in
    `safeCallCardHandler` e si limitano a loggare — qui serve l'eccezione
    vera). Primo giro: 44 falsi positivi, TUTTI della stessa causa nota
    (una Carta Equipaggiamento senza un bersaglio agganciato non
    raggiunge mai `static()` nel motore reale — vedi il bullet Structure
    Deck) più UN caso nuovo non ancora visto: id 157 (Bozzolo
    dell'Evoluzione) è di `type: 'monster'` ma ha `isEquip: true` (si
    aggancia a un altro mostro come una Magia Equipaggiamento vera,
    instradata sulla zona 'st' da `activateCard` esattamente come un
    Equip) — l'harness doveva instradarla sul ramo Equip in base a
    `def.isEquip`, non al `type` letto da cards.json. Corretto
    l'harness (non il motore: nessun bug reale qui), **0 errori restanti
    su tutte le 1081 carte**. **Graduato a test di regressione
    permanente** (`tests/specs/all-cards-hooks-stress-test.spec.js`,
    <1s di overhead sulla suite) invece di restare un altro script
    scratch usa-e-getta: da ora in poi ogni futura carta nuova viene
    controllata automaticamente da `npm test`, non solo se qualcuno si
    ricorda di rilanciare l'audit a mano.
  - **id 392/820 ("Nega l'Attacco"/"Nega Attacco") erano la STESSA carta
    reale duplicata due volte** (già segnalato ma non affrontato in una
    sessione precedente): stesso identico testo effetto, la stessa carta
    "Negate Attack" con due grafie italiane diverse. id 392 era la copia
    INCOMPLETA (con un `missingEffectNote` che ammetteva "manca termina
    la Battle Phase"), id 820 la copia COMPLETA e corretta (usata
    davvero in un mazzo, SD09) ma con `subtype` sbagliato ("counter"
    invece di "normal" — nel gioco reale non esiste una versione
    Trappola Contatore di questa carta). **Rimossa id 392** per intero
    (cards.json + la sua registrazione in card-effects.js, non usata in
    alcun mazzo), **corretto il subtype di id 820** a "normal". La
    stessa implementazione COMPLETA di id 820 aveva già dimostrato,
    senza saperlo, che il rischio "interferenza con resolveAttack"
    temuto dal `missingEffectNote` di id 392 non si materializzava mai.
  - **id 635 ("Vaso dell'Ingordigia") era stato "corretto" nella
    direzione SBAGLIATA in una sessione precedente**: un audit di
    consistenza aveva concluso che il nome italiano "traduce
    letteralmente Pot of Greed" e aveva riscritto la carta da Trappola/
    pesca-1 a Magia/pesca-2, rendendola un duplicato esatto di id 36
    (Vaso dell'Avidità, la VERA Pot of Greed) — ma "Vaso"/"Ingordigia"
    non distinguono affatto Pot da Jar in italiano, e i commenti nei
    mazzi Structure Deck di QUESTO STESSO dataset
    (js/data/starter-structure-decks.js, es. "SKE-047 Vaso
    dell'Ingordigia / Jar of Greed") confermavano da tempo che questa è
    davvero Jar of Greed, una Trappola reale distinta ("Pesca 1 carta",
    non 2). Trovato con la stessa tecnica usata per id 392/820: uno
    script usa-e-getta che raggruppa `data/cards.json` per testo effetto
    identico, non solo per id duplicato (già coperto da
    `card-database-sanity.spec.js`) — ha isolato 5 gruppi, di cui 3
    erano legittimi (i 4 pezzi di Exodia condividono lo stesso testo per
    davvero; alcuni mostri Spirito/vanilla con "può attaccare
    direttamente" sono carte reali distinte che condividono
    letteralmente lo stesso identico effetto semplice) e 2 erano bug
    veri. **Ripristinato id 635** a Trappola/pesca-1, con un commento
    che spiega esplicitamente perché la "correzione" precedente era
    essa stessa l'errore — per non ricaderci in una sessione futura.
    **Lezione per un futuro audit di consistenza carte↔traduzione
    simile**: una traduzione italiana ambigua (qui: "Vaso"/"Ingordigia"
    non distinguono Pot da Jar) non è mai una prova sufficiente per
    "correggere" una carta — cercare SEMPRE conferma indipendente nei
    commenti di altri file dati dello stesso progetto (qui: i print
    code degli Structure Deck) prima di cambiare type/subtype/effetto.
  Suite motore 60/60 verde (59 esistenti + il nuovo test di stress
  permanente).
- ✅ **3 dei 4 punti IA di `docs/planning/TODOLIST_BUGS.md` chiusi** (richiesta esplicita
  dell'utente: "concentrati sui punti legati all'ia" — il 4° punto,
  "2 mazzi per difficoltà per personaggio", è di CONTENUTO dati
  [js/data/character-decks.js], non di logica IA, lasciato apposta fuori
  scope e segnalato nel file stesso per una sessione futura). Tutti e 3
  in `js/ai/ai-shared.js` (nuovi helper condivisi tra `ai-medium.js`/
  `ai-hard.js`, nessuna duplicazione tra i due livelli) + i due punti
  d'innesto già esistenti (`chooseAttackTarget`/`chooseSummon`/
  `chooseNextSpellTrapAction`/`chooseSetCardActivation`):
  - **"Non insistere ad attaccare un mostro che non si può distruggere"**:
    nuovo `AI_SHARED.canBeDestroyedByBattle(defenderCard, defenderOwner,
    attackerAtk)` — replica in sola lettura la stessa logica di
    `cardIsIndestructibleByBattle`/`survivesBattleDestruction`, entrambe
    chiuse dentro `resolveBattleDamage` (js/engine/actions.js, mai
    esposte prima d'ora fuori da lì): `def.cannotBeDestroyedByBattle`
    (fisso o funzione condizionata all'ATK dell'attaccante, es. Guardiano
    Celtico Sgradito id 712), `gameState.noBattleDestructionFor`
    (Waboku), `gameState.orgothIndestructibleUids`. Consultato da
    `chooseAttackTarget` in ENTRAMBI i livelli: un mostro che soddisfa
    solo il confronto ATK/DEF nominale ma non morirebbe comunque non è
    più trattato come bersaglio "conveniente" — se resta l'UNICO
    bersaglio così, il bot trattiene l'attaccante invece di sprecare
    l'attacco (comportamento verificato con Playwright: 0 falsi
    positivi su un mostro normale, correttamente escluso uno con flag
    fisso e uno condizionato in entrambi i sensi). **Deliberatamente NON
    replica** i redirect Union (`DuelEngine.tryRedirectUnionDestroy`) né
    `def.onWouldBeDestroyedInBattle` — casi di nicchia che MUTANO stato
    reale se innescati, sproporzionati per una stima IA che deve restare
    di sola lettura: un mostro Union che "assorbirebbe" la distruzione
    resta trattato come normalmente distruttibile, invariato.
  - **Intelligenza nei Tributi**: nuovo `AI_SHARED.isTributeSummonWorthwhile(card,
    sacrificedValue, gameState, owner)` sostituisce il vecchio veto
    "mai in perdita netta" (`Math.max(card.attack, card.defense) <=
    sacrificedValue`, ancora il primo controllo al suo interno) in
    ENTRAMBI i livelli (`chooseSummon`): un downgrade di ATK (es.
    sacrificare 2500 ATK per un 2400 ATK/2600 DEF) viene accettato SOLO
    se il campo avversario ha DAVVERO un mostro che lo giustifica — il
    suo ATK batterebbe il nuovo mostro restando in Attacco ma NON la sua
    DEF più alta (stessa identica euristica "il mostro più forte
    scoperto in Attacco dell'avversario" già usata da
    `decideMonsterPosture`, riusata qui invece di duplicarne la logica).
    Campo avversario vuoto o senza quella minaccia esatta -> il downgrade
    resta rifiutato, il bot preferisce restare offensivo. Un upgrade
    diretto di ATK (già >= al sacrificato) resta sempre accettato senza
    bisogno di guardare il campo, come prima.
  - **Varietà/pacing nell'uso di Magie/Trappole + stile per personaggio**:
    l'intero motore usava OVUNQUE lo stesso pattern deterministico
    "sempre la carta col punteggio di impatto stimato più alto"
    (`AI_SHARED.scoreCardImpact`, keyword nel testo) — stesso mazzo,
    stessa mano di partenza, SEMPRE la stessa identica sequenza di
    attivazioni, il pattern riconoscibile segnalato dall'utente. Nuovo
    `AI_SHARED.pickWeightedByImpact(candidates, restraint)`: una lotteria
    pesata sul quadrato del punteggio (la carta forte resta la scelta più
    probabile, non l'unica possibile) — sostituisce il vecchio
    `.sort(...).pop()`/`[0]` in `chooseNextSpellTrapAction` (entrambi i
    livelli) e `chooseSetCardActivation` (solo Difficile, l'unico livello
    che lo fa). `chooseChainResponse` (risposta REATTIVA in una finestra
    di priorità) è rimasta DELIBERATAMENTE deterministica in entrambi i
    livelli — la richiesta dell'utente riguardava le mosse PROATTIVE di
    Main Phase, variare anche la difesa in un momento critico
    sembrerebbe "IA che sbaglia", non "IA varia". Nuovo
    `AI_SHARED.getSpellTrapRestraint(gameState)` decide QUANTO la lotteria
    si appiattisce verso l'uniforme, combinando due cose SOMMATE (non
    sostituite): un bonus fisso nei primi 2 turni (così anche un bot
    aggressivo non svuota le carte più forti fin dal turno 1 — "non tutte
    subito") più un piccolo elenco CURATO A MANO di "aggressività" per
    personaggio (`CHARACTER_AGGRESSION`, chiave = stesso id di
    `characters-db.js`: kaiba/bandit_keith/marik molto aggressivi
    ~0.8-0.9, pegasus/rex/weevil calcolati ~0.7-0.75, mai/yugiMuto/
    yamiYugi/joey equilibrati ~0.45-0.6), letto da
    `window.DuelSession.opponent.id` (già esposto da js/duel-session.js,
    nessuna nuova plumbing) — **deliberatamente un elenco CORTO, non un
    tentativo di coprire tutti i 34+ personaggi**: uno assente riceve un
    valore neutro di default, così restare scalabile senza dover
    mantenere una tabella enorme (coerente con la preferenza esplicita
    dell'utente per implementazioni riusabili invece di hack per singolo
    caso). IA Normale aggiunge un margine di trattenimento fisso extra
    (+0.15) sopra il restraint condiviso — resta "più timida" di
    Difficile anche a personaggio pari, coerente con l'essere il livello
    di default meno aggressivo.
  **Bug di scrittura reale trovato e corretto durante l'implementazione,
  non del motore**: un commento scritto come "i limiti MAX_*/
  usedThisTurn" in un blocco `/** ... */` conteneva la sequenza letterale
  `*/` a metà frase, chiudendo il commento PRIMA del previsto — il resto
  del blocco (altre righe che iniziano per convenzione con `* `)
  diventava JavaScript vero, con ogni riga interpretata come
  un'espressione che inizia con l'operatore di moltiplicazione `*`,
  mandando in errore di sintassi l'INTERO file (e quindi ogni pagina che
  lo carica) con un fuorviante "Unexpected token '*'". **Lezione per una
  futura sessione**: quando si scrive un commento JSDoc che menziona un
  nome-variabile terminante con un asterisco letterale o un pattern
  "prefisso_qualcosa" seguito a ruota da testo che inizia con `/`
  (slash), verificare sempre che la coppia non formi accidentalmente
  `*/` — `node --check <file>.js` individua l'esatto file e riga in un
  istante, molto più veloce che rileggere il codice a occhio quando
  TUTTI i test della suite falliscono con lo stesso errore criptico
  (segno che il problema è un parse-error a monte, comune a ogni
  pagina, non un bug isolato in una singola carta/funzione).
  Verificato dal vivo con Playwright (chiamate dirette alle nuove
  funzioni `AI_SHARED`, non solo lettura del codice): indistruttibilità
  fissa/condizionata riconosciuta correttamente in entrambe le direzioni,
  tributo accettato/rifiutato esattamente nei 5 casi attesi (upgrade
  diretto, downgrade senza minaccia, downgrade con minaccia esatta,
  downgrade con minaccia troppo forte anche per la DEF, perdita netta
  pura), lotteria pesata che converge verso la carta forte a restraint
  basso e si appiattisce a restraint alto, `getSpellTrapRestraint` che
  cambia correttamente con turno e personaggio. Suite motore 60/60
  verde (incluso "Il bot gioca 3 turni realistici senza errori", che
  esercita dal vivo esattamente i percorsi di codice toccati qui).
- ✅ **4° punto di `docs/planning/TODOLIST_BUGS.md` chiuso (mazzi a due velocità per
  difficoltà) + 4 delle idee IA proposte a fine sessione precedente,
  tutte richieste esplicitamente dall'utente**: "fai il 4° punto, e
  delle tue proposte fai il punto 1,2,3,5" (l'idea 4, un livello
  "Facile" dedicato, resta non implementata — non richiesta).
  - **Mazzi a due velocità (`js/data/character-decks.js`) — corretto
    DUE volte dopo due segnalazioni distinte dell'utente**: 1° errore
    ("in che senso torna a due copie??? nel mazzo normale ci deve
    essere qualche carta con magari 1400 attacco") — il primo tentativo
    riportava a 2 copie proprio le 4 rimozioni generiche (Buco Nero/
    Cilindro Magico/Buco Trappola/Forza dello Specchio) ridotte a 1
    copia in una sessione precedente apposta per varietà,
    reintroducendo silenziosamente lo stesso problema già corretto
    allora. 2° errore, dopo aver già corretto il primo ("NO non
    scalare il mostro più forte! Devi solo abbassare un paio di mostri
    'medi' con qualcosa di più debole") — la versione corretta del 1°
    errore riduceva il mostro con l'ATK PIÙ ALTO del mazzo (la carta
    simbolo del personaggio, es. il Mago Nero di Yugi) per IA Normale,
    quando l'utente voleva SOLO che un paio di mostri "medi" (né il più
    forte né già deboli) venissero abbassati, lasciando la carta
    simbolo sempre intatta in ENTRAMBE le difficoltà. **Lezione per una
    futura sessione, su entrambi gli errori**: quando una richiesta
    dice "rendi X più forte/più debole", non presumere che la statistica
    più ESTREMA del mazzo (il più forte in assoluto, o carte già toccate
    da un riequilibrio precedente) sia il bersaglio giusto — un
    personaggio ha quasi sempre una o più carte "simbolo" che il
    giocatore si aspetta di vedere INTATTE a qualunque difficoltà,
    distinte dal resto del mazzo che invece può variare liberamente;
    verificare quale sia prima di scegliere la leva, non dedurlo dalla
    sola statistica più alta/più bassa.
    Versione corretta definitiva: `getCharacterDeck(characterId,
    difficulty)` lascia IA Difficile (e qualunque chiamante che non
    passa `difficulty`, es. creazione-deck.html) esattamente al mazzo
    BASE — è già il mazzo "forte" di riferimento, nessuna modifica.
    Solo IA NORMALE riceve una vera versione INDEBOLITA: fino a 2 mostri
    "MEDI" (`NORMAL_TIER_MAX_DOWNGRADES`, esplicitamente esclude il
    mostro con l'ATK più alto del mazzo — mai toccato, in nessuna
    difficoltà) perdono 1 copia ciascuno a favore di 1 copia in più di
    un mostro GIÀ PRESENTE nello stesso mazzo con ATK <= 1400
    (`NORMAL_TIER_WEAK_ATK_CEILING`) — mai un id nuovo/fuori tema
    aggiunto da fuori, mazzo sempre a 40 carte esatte (scambi interni
    tra carte che il personaggio ha già). Non tocca in alcun modo le 4
    rimozioni generiche. Verificato programmaticamente su TUTTI e 46 i
    personaggi (incluso un controllo esplicito e automatico che il
    mostro più forte non cali MAI in nessun mazzo Normale): 44 ricevono
    un downgrade concreto sui mostri medi (es. Yugi Muto: -1 Maga
    Oscura 2000 ATK/-1 Cavaliere Oscuro 2000 ATK, +1 Guerriero Celtico
    1400/+1 Ryu Kishin 1000 — Mago Nero 2500 ATK MAI toccato; Kaiba: -1
    Drago Toon Occhi Blu 3000/-1 Drago Barile 2600, +1 Drago Armato
    LV3 1200 — il vero Drago Bianco Occhi Blu, id 1, mai toccato), 2
    (Neku, Dark Nite — mazzi "beatdown" puro senza alcun mostro sotto i
    1750 ATK) restano onestamente invariati per mancanza di un
    candidato debole a tema, invece di forzare un mostro fuori posto
    pur di rispettare la regola. `game-flow.js` passa
    `gameState.botDifficulty` (già impostato poche righe sopra nella
    stessa funzione) a `getCharacterDeck`.
  - **Idea 1 — Effetti Ignition dei propri mostri in campo**:
    `AI_HARD.chooseSetCardActivation` (rinominata solo nel comportamento,
    non nel nome — resta l'API già usata da `BotAI`/bot.js) ora scandaglia
    ANCHE `gameState.botMonsterField` (non solo il retrocampo Magia/
    Trappola) per mostri con un `activate()` registrato e
    `DuelEngine.canActivate('bot','monster',index)` vero — infrastruttura
    già esistente da sempre (`canActivate` supporta la zona 'monster' fin
    dall'inizio), semplicemente nessuna funzione IA la interrogava mai
    PROATTIVAMENTE (solo IA_DIFFICILE, come per il retrocampo). La
    decisione ora include `zone` ('st' o 'monster'), letta da
    `bot.js#attemptBotActivateSetCards` (`DuelEngine.activateCard('bot',
    decision.zone || 'st', ...)`, `|| 'st'` per compatibilità) invece di
    un hardcoded `'st'`. Entrambe le zone entrano nella STESSA lotteria
    pesata (`pickWeightedByImpact`) già introdotta per la varietà.
  - **Idea 2 — Postura più cauta con un avversario a mano piena**:
    `AI_SHARED.decideMonsterPosture(card, gameState, owner, riskAversion)`
    guadagna un 4° parametro opzionale (IA_MEDIA non lo passa mai,
    comportamento invariato): quando un mostro "da Attacco" non ha
    comunque un bersaglio favorevole da colpire SUBITO (già escluso al
    punto 1 dell'euristica esistente) e l'avversario ha una mano
    abbondante (>= 4 carte, rischio concreto di rimozione/Trappola a
    sorpresa), lo tiene in Difesa coperta invece di esporlo per nessun
    vantaggio immediato. `riskAversion` è lo STESSO `faceDownRisk` di
    `currentAttitude` (ai-hard.js) già usato per gli attacchi contro
    bersagli coperti, riusato identico qui: sotto soglia 1500 (la fascia
    "in svantaggio netto" di currentAttitude) resta comunque aggressiva
    ed espone il mostro, coerente col principio già esistente "in
    svantaggio rischia di più pur di rientrare in partita".
  - **Idea 3 — Gestione del rischio in Battle Phase**:
    `AI_HARD.chooseAttackTarget` calcola un `backrowPenalty` quando si è
    COMODAMENTE in vantaggio (`evaluateBoard(gameState) >= 8`, la stessa
    soglia "in vantaggio netto" già usata da `currentAttitude`) E il
    retrocampo dell'avversario ha almeno 2 carte coperte (rischio
    concreto di una carta punitiva tipo Cilindro Magico/Buco Trappola) —
    scala verso il basso ogni punteggio (incluso l'attacco diretto a
    campo vuoto, prima sempre incondizionato) invece di forzare sempre
    ogni attacco disponibile: un attacco chiaramente vantaggioso resta
    comunque sopra soglia e parte normalmente, scoraggia solo le mosse
    marginali quando la vittoria non ha più bisogno di rischiare nulla.
  - **Idea 5 — Risposta in Chain più selettiva**: sia
    `AI_HARD.chooseChainResponse` sia `AI_MEDIUM.chooseChainResponse`
    (quest'ultima normalmente prende sempre la prima candidata per
    filosofia esplicita di semplicità) ora passano quando OGNI candidata
    è una rimozione a bersaglio singolo (`AI_SHARED.isSingleTargetRemoval`)
    E nessuna varrebbe la pena secondo la STESSA soglia adattiva già
    usata proattivamente in Main Phase (`AI_SHARED.isRemovalWorthwhile`,
    `currentAttitude`/`REMOVAL_WORTH_THRESHOLD` a seconda del livello) —
    stesso principio "non sprecare la rimozione su un bersaglio che non
    lo merita" applicato in difesa. Se anche una sola candidata NON è
    pura rimozione (una negazione, un effetto di massa, ecc.), risponde
    comunque normalmente: non blocca mai una vera mossa difensiva
    necessaria, riducendo il rischio di far sembrare l'IA "rotta" invece
    che "selettiva".
  Verificato dal vivo con Playwright (chiamate dirette, non solo lettura
  del codice): entrambi i mazzi restano a 40 carte esatte, IA Normale e
  la chiamata senza `difficulty` tornano il mazzo base bit-per-bit
  identico, IA Difficile lo differenzia correttamente; un mostro finto
  con `activate()` in campo viene trovato come candidato
  `zone:'monster'`; postura che si nasconde con mano avversaria piena
  solo se non in svantaggio, resta esposta altrimenti; attacco diretto
  trattenuto solo con vantaggio netto + retrocampo fitto, altrimenti
  parte normalmente; risposta in Chain rifiutata solo contro un
  bersaglio debole con TUTTE candidate di pura rimozione, altrimenti
  sempre normale. Suite motore 60/60 verde.
- ✅ **2 correzioni al mazzo di Kaiba/nuova regola sui Dei Egizi, tutte
  richieste esplicite dell'utente nello stesso giro dei mazzi a due
  velocità qui sopra**:
  - **"Kaiba non ha i toon!"** — bug di TEMA preesistente, non
    introdotto in questa sessione ma emerso citando un esempio del
    downgrade IA Normale: il mazzo base di Kaiba conteneva Drago Toon
    Occhi Blu (id 123) — "Toon" è l'archetipo di Maximillion Pegasus
    (richiede Toon World), mai apparso nel mazzo di Kaiba nel canone.
    Sostituito con Drago Armato LV7 (id 864): il commento del mazzo
    prometteva già "tutta la linea evolutiva Drago Armato", ma si
    fermava a LV3/LV5 — LV7 la completa davvero, oltre a sistemare
    l'errore tematico.
  - **Esattamente 1 copia del proprio Dio Egizio per IA Difficile**
    (Kaiba/Obelisk il Tormentatore id 30, Yami Yugi/Slifer il Drago del
    Cielo id 31, Marik/Il Drago Alato di Ra id 472 — stessa
    distribuzione del vero anime): nuovo `CHARACTER_GOD_CARD_ID` +
    `applyExactlyOneGodCard(base, godId)` in `js/data/character-decks.js`,
    applicato SOLO quando `difficulty === 'hard'`. Kaiba e Yami Yugi non
    avevano affatto il proprio Dio nel mazzo base — aggiunto, cedendo 1
    copia di un filler generico "morbido" (SOFT_FILLER_IDS, reintrodotto
    per questa carta dopo che il downgrade IA Normale l'aveva rimosso
    dal file) per restare a 40 carte esatte. Marik aveva già 2 copie di
    Ra nel mazzo base (usate da IA Normale e da chi clona il mazzo senza
    specificare difficoltà, es. creazione-deck.html — invariate lì): per
    IA Difficile scendono a 1, "esattamente 1", non "almeno 1". **Bug
    reale trovato e corretto durante la verifica dal vivo**: la prima
    versione compensava la sottrazione di spazio SOLO quando il Dio
    veniva aggiunto ex novo, non quando veniva ridotto da 2 a 1 — il
    mazzo Difficile di Marik risultava a 39 carte invece di 40 finché
    non verificato con Playwright su tutti e 46 i personaggi (mai
    fidarsi che un cambiamento sia corretto solo perché "sembra
    simmetrico": la compensazione va verificata in ENTRAMBE le
    direzioni, aggiunta E riduzione, separatamente). Suite motore 60/60
    verde.
- ✅ **Popup rosso di errore ("Si è verificato un errore imprevisto") su
  OGNI pagina (Admin, Creazione Deck, Tornei, schermata Campione del
  torneo) — segnalato dall'utente con screenshot reali, causa trovata
  collegando il suo telefono via adb**: impossibile da riprodurre in
  automatico (file://, server locale, con/senza bypass del gate,
  aspettando il timeout della verifica online) — il banner mostrava solo
  un messaggio generico, il vero dettaglio finiva SOLO in
  `console.error`, invisibile su un telefono/APK reale senza un
  collegamento devtools.
  - **Passo 1 — `js/ui/error-recovery.js` mostra ora anche il testo
    tecnico reale** (nome + messaggio + prime righe di stack di ogni
    errore/rifiuto distinto intercettato) in un riquadro scorrevole
    dentro lo stesso banner, sempre visibile — non serve più aprire la
    console per capire la causa da uno screenshot.
  - **Passo 2 — bug reale trovato grazie al passo 1**: il telefono
    mostrava ancora la versione VECCHIA del banner (senza dettaglio)
    nonostante il codice fosse già online su GitHub Pages (verificato
    con una richiesta diretta al file pubblicato) — il Service Worker
    del dispositivo non aveva ancora rilevato l'aggiornamento.
    `js/pwa-register.js` chiamava `navigator.serviceWorker.register()`
    ma MAI `registration.update()`: quella chiamata forza un controllo
    immediato ad ogni avvio invece di aspettare la cadenza interna
    (non garantita) del browser — corretto aggiungendola.
  - **Passo 3 — la causa VERA, trovata solo dopo il fix del Passo 2**:
    `InvalidStateError: Transition was aborted because of invalid
    state. ViewTransition opt-in disabled`, non gestito, ad OGNI
    cambio pagina. L'opt-in alla View Transitions API
    (`@view-transition { navigation: auto; }`, introdotto in una
    sessione precedente per una navigazione più fluida) veniva iniettato
    via JS dentro `initAudioManager()` (`js/audio/audio-manager.js`) —
    ma quella funzione gira solo DOPO che `js/cloud/auth-gate.js` ha già
    aspettato la verifica dell'account approvato (fino a 6s). Il
    browser decide se la pagina di ARRIVO partecipa a una transizione
    cross-document leggendo l'HTML fin dal PRIMISSIMO parsing di
    `<head>` — un opt-in iniettato dopo un ritardo del genere arriva
    sempre troppo tardi, quindi la transizione veniva sempre rifiutata
    con questo errore, su OGNI pagina, ogni volta. Corretto spostando
    l'opt-in a un `<style>` STATICO nel `<head>` di tutte e 16 le pagine
    (subito dopo `<meta charset>`), rimuovendo la vecchia iniezione via
    JS (`ensureViewTransitionStyle`, diventata dead code, cancellata non
    solo segnalata).
  - **Lezione di metodo per una futura sessione, la più importante di
    questa voce**: un bug che dipende dallo stato REALE di un
    dispositivo (qui: un Service Worker già installato in una versione
    precedente) può essere GENUINAMENTE impossibile da riprodurre con
    Playwright (che parte sempre da zero, senza alcun Service Worker
    preesistente) — quando un utente segnala un errore che non si
    riesce a riprodurre in automatico nonostante vari tentativi
    ragionevoli, collegare il dispositivo reale via `adb` (già fatto
    altre volte in questo progetto per gli screenshot) e usarlo per il
    debug LIVE è stato risolutivo, non solo un modo per "vedere" il
    problema. Anche l'ordine dei 3 passi conta: senza il Passo 1 (rendere
    l'errore leggibile da uno screenshot) non si sarebbe mai capito COSA
    cercare; senza il Passo 2 (forzare l'aggiornamento del Service
    Worker) anche un fix corretto del Passo 3 sarebbe rimasto invisibile
    sul dispositivo per un tempo imprevedibile.
  - **Schermo del telefono nero durante il debug adb**: non un bug
    dell'app — lo screen-off timeout del dispositivo scadeva più in
    fretta di quanto servisse per catturare uno screenshot via
    `adb shell screencap`; risolto allungandolo temporaneamente
    (`adb shell settings put system screen_off_timeout <ms>`) e
    ripristinandolo al valore originale a fine sessione di debug — non
    un problema di Samsung Game Manager/anti-screenshot come ipotizzato
    inizialmente (quell'ipotesi si è rivelata sbagliata: il vero
    problema era semplicemente il timeout, risolto con una causa molto
    più semplice).
  Verificato dal vivo sul dispositivo reale dell'utente (non solo in
  teoria): prima del fix del Passo 3, navigare in Creazione Deck
  mostrava sempre il banner rosso; dopo — con lo stesso identico
  percorso di navigazione, stesso dispositivo — nessun errore. Suite
  motore 60/60 verde.

- ✅ **Multiplayer: primo test end-to-end, e tre buchi del protocollo
  chiusi grazie a lui**. Era l'unica parte del progetto senza alcuna rete
  di sicurezza automatica (si verificava solo aprendo due browser a
  mano). `tests/specs/multiplayer-end-to-end.spec.js` non simula nulla
  del relay: avvia `server/server.js` come vero sottoprocesso e apre due
  pagine su `multiplayer.html`, che fanno lobby, stanza e duello come due
  giocatori reali. Serve un server HTTP vero (`mp-lobby.js` carica
  l'arena con `fetch('duelMonstersCore.html')`, bloccata su `file://`):
  da qui `tests/helpers/local-servers.js` e il nuovo `standalone: true`
  in `tests/run-all.js`, per uno spec che vuole due pagine invece della
  solita già aperta sul duello (vedi `tests/README.md`).
  **Metodo da ripetere per ogni futura correzione di protocollo**: ogni
  fix è stato rimesso allo stato precedente per verificare che il test
  fallisse davvero — un test che passa in entrambi i casi non prova
  nulla. I tre buchi trovati/chiusi:
  - **`kind: 'fieldspell'` trasmesso ma mai gestito** (finiva nel
    `default: break` di multiplayer.js): la mano dell'avversario non
    calava, e il conteggio della mano entra nel checksum anti-desync —
    ogni Magia Terreno faceva divergere i due lati e scattare un resync
    completo. Si riparava da sé, ma rumorosamente, ogni volta.
  - **Fine partita mai comunicata**: ogni lato deduceva l'esito dallo
    stato che credeva di avere, quindi su una divergenza i due giocatori
    potevano vedere risultati diversi. Ora `endDuel` trasmette
    `kind: 'game-over'` (già rovesciato dal punto di vista di chi
    riceve) e il pulsante Abbandona è tornato visibile anche in
    Multiplayer, che era nascosto proprio perché arrendersi lasciava
    l'altro appeso.
  - **La Chain la decidevano entrambi i client per conto proprio**: un
    lato vedeva l'avversario come 'bot' e rispondeva con l'euristica
    dell'IA, l'altro mostrava il prompt alla persona vera — ed era il
    motivo del limite a un solo round (`maxChainRounds`, ora sempre
    `Infinity`). Ora la decisione VIAGGIA (`kind: 'chain-response'`), con
    un unico punto di smistamento nel motore, `askResponder`: se a
    rispondere è il lato remoto si ASPETTA la sua decisione (tetto 30s,
    poi si prosegue come se avesse passato), se sono io decido e la
    comunico. **Due punti controintuitivi, commentati sul posto**: con un
    rispondente remoto non si prende mai la scorciatoia "la sua lista di
    candidati è vuota, quindi passa" (quella lista è la nostra copia
    approssimata del suo lato: la sua mano, di qua, è fatta di
    segnaposto); e `broadcastChainDecision` NON si protegge con
    `MP_applyingRemote` come ogni altro punto che trasmette — è sempre
    una decisione mia sulle mie carte, anche quando la finestra si è
    aperta per una sua mossa, che è il caso più comune. Nello stesso giro
    è emerso che **la finestra di risposta a un'Evocazione si apriva SOLO
    sul client di chi evocava** (`applyRemoteSummon` non faceva scattare
    alcun trigger): il difensore non veniva mai interpellato, e un Buco
    Trappola contro un'Evocazione avversaria era di fatto ingiocabile in
    Multiplayer.
  **Limite dichiarato allora, CHIUSO in una sessione successiva** (un
  effetto che, risolvendosi, fa una scelta locale poteva divergere tra i
  due client): vedi il bullet "Il limite dichiarato «le scelte locali
  divergono» è CHIUSO" più sotto — la scelta del bersaglio ora viaggia, e
  per le scelte che toccano il proprio lato parte una fotografia di stato
  dopo ogni attivazione. **Restava fuori il caso "`Math.random()` che
  cade sulle zone dell'AVVERSARIO", dato qui per coperto da checksum e
  resync: falso, misurato in una sessione successiva — quella rete non
  scatta affatto. CHIUSO a parte con `ctx.random()`, vedi il bullet
  dedicato più sotto.**

- ✅ **Controllo qualità del Multiplayer (richiesta esplicita
  dell'utente) — il duello regge, il buco era nella SALA D'ATTESA.**
  Verificato con due client veri attraverso il server di stanze vero:
  evocazione, carta coperta, Magia Terreno, cambio turno e resa arrivano
  all'altro lato coi due checksum sempre uguali; la carta arriva completa
  (nome e ATK, non solo la casella); un terzo che prova a entrare viene
  respinto; l'arena sta nella finestra a 1400x900, 390x844 e 844x390
  senza scorrimenti né elementi mancanti. Due difetti reali trovati,
  entrambi PRIMA che il duello cominci — cioè in `js/multiplayer/mp-lobby.js`,
  non in `js/multiplayer/multiplayer.js`:
  - **In sala nessuno ascoltava `opponent-left`/`opponent-disconnected`**:
    quegli eventi li gestiva SOLO `multiplayer.js`, che però viene
    caricato solo a duello già avviato. Chiudendo la scheda
    dell'avversario, l'altro continuava a vedere "Pronto", "2/2
    duellanti" e l'invito "tocca a te" — e premendo "Sono pronto" partiva
    un duello intero contro nessuno, da cui si usciva solo ricaricando.
    Ora la sala svuota il posto (`svuotaPostoAvversario`, gemello esatto
    di `riempiPostoAvversario`), spegne la sua prontezza, nasconde la
    barra e lo dice; e una caduta di linea momentanea resta distinta da
    un'uscita vera (`avversarioCollegato`), perché il server tiene il
    posto per una finestra di grazia e in quella finestra il duello non
    deve partire. Se ad andarsene è l'host, chi resta EREDITA la stanza
    (`sonoHost = true` + `aggiornaSetupPerRuolo()`): arena e musica le
    sceglie l'host e le trasmette, quindi una stanza senza padrone di
    casa manderebbe i due prossimi duellanti in due arene diverse, ognuno
    ad aspettare invano le impostazioni dell'altro.
  - **`net.leaveRoom()` esisteva ma non la chiamava nessuno**: uscire
    dalla pagina lasciava solo cadere il socket, e il server lo tratta
    come disconnessione momentanea, tenendo il posto occupato 45 secondi
    (`RECONNECT_GRACE_MS`) per un rientro che in quel caso non arriverà
    mai — il `playerId` del `rejoin-room` vive solo in memoria e muore con
    la pagina. Ora la chiama un ascoltatore `pagehide` (non
    `beforeunload`: è l'unico affidabile su mobile): il posto si libera
    subito, e anche a duello avviato chi resta legge "si è disconnesso"
    invece di sperare per tre quarti di minuto.
  Nuovo test di regressione permanente
  (`tests/specs/multiplayer-lobby-abbandono.spec.js`, `standalone: true`
  come lo spec end-to-end), verificato al contrario: con la versione
  precedente di `mp-lobby.js` fallisce.
  (Il limite sui Tributi segnalato qui in un primo momento è stato poi
  chiuso su richiesta dell'utente — vedi il bullet subito sotto.)
  **Due trappole di METODO costate tempo in questa sessione, per non
  ricascarci**: `summonMonster(card, slotIndex, position, handIndex)`
  vuole la CARTA come primo argomento, non l'indice in mano — passandogli
  un indice si ottiene una casella occupata da un `card` vuoto, che
  `JSON.stringify` dentro un array rende come `null` e fa sembrare il
  campo vuoto (falso "la mossa non è arrivata"). E `changeTurn()` è
  LOCALE, non trasmette nulla: in Multiplayer il turno passa perché
  viaggiano le FASI, quindi un test deve usare `endTurn()`.

- ✅ **Ologrammi in finto 3D sopra i mostri scoperti, stile Master Duel
  (`js/ui/monster-hologram.js`/`.css`)** — richiesta dell'utente, con un
  vincolo esplicito: "non vorrei che venisse ridisegnata la UI a
  raffica".
  - **GENERICO, una volta per tutte le carte.** All'ologramma servono
    solo l'illustrazione — che `getCardImagePath(card)` (card-renderer.js,
    già globale) risolve centralmente per id, comprese le custom e i set
    non-Yu-Gi-Oh — e la posizione dello slot. Niente da dichiarare sulla
    singola carta, né oggi né per una aggiunta domani.
  - **Perché vive FUORI dal Terreno**: `renderFields()` ricostruisce
    tutto da zero ad ogni `updateUI()`. **Misurato su un duello vero: 23
    ricostruzioni in 27,5 secondi, 277 elementi carta ricreati** — circa
    una al secondo. Un ologramma appeso allo slot ripartirebbe da capo
    ogni volta. Sta quindi su un livello proprio (`#monsterHologramLayer`,
    `position: fixed`) e si aggiorna in modo INCREMENTALE per uid: crea
    solo i nuovi, toglie solo gli spariti, riposiziona gli altri.
    Verificato: dopo 10 `updateUI()` consecutivi gli elementi sono
    ancora gli stessi (marchiati e ritrovati), nessuno ricreato.
  - **Solo mostri SCOPERTI**: proiettare una carta coperta ne rivelerebbe
    il contenuto.
  - **Acceso solo con "Dettagli video: Alti"** (`video-quality.js`, chiave
    `ygoVideoDetail` — attenzione, non `ygoVideoQuality`: sbagliarla fa
    sembrare l'effetto rotto quando è solo spento). Costo misurato a
    campo pieno con 10 ologrammi: **0 fps** (60 → 60).
  - **Primo tentativo visivo sbagliato, corretto guardandolo**: larghezza
    della carta e altezza 1.9× con `object-fit: cover` ritagliava
    l'illustrazione (quasi quadrata) in una striscia verticale, e leggeva
    come una seconda copia della carta. Ora è più LARGA della carta,
    poco più alta, con `contain` e una tinta ciano (`saturate`+
    `hue-rotate`+`drop-shadow`) che la fa leggere come proiezione.
    **Lezione già nota e riconfermata**: un effetto visivo va GUARDATO in
    uno screenshot, "l'elemento esiste con le coordinate giuste" non
    dice nulla su come appare.

- ✅ **`makeContext` reso a prova di collisione, e primo lotto di carte
  che "scelgono da sole" corretto (due richieste esplicite dell'utente).**
  - **Il contesto non è più sovrascrivibile da `extra`**: l'ordine
    dell'`Object.assign` è stato ROVESCIATO (`extra` per primo, ciò che
    il motore mette a disposizione dopo), così i dati del momento non
    possono più sostituire né il proprietario dell'effetto né gli helper
    che ogni carta si aspetta di trovare come funzioni. Un audit
    meccanico su **tutte e 93** le chiamate (script in scratchpad: legge
    i nomi riservati a runtime da `DuelEngine.actions`, poi bilancia le
    parentesi nei sorgenti per estrarre il 2° argomento) ha trovato UNA
    sola collisione scritta a mano — un `opponent: victimOwner` in
    `fireOwnBattleDamageDealt` (actions.js), rinominato in
    `damagedOwner`. **Non era innocua**: con la ridirezione del danno di
    Abbandonato (id 416) quel valore è l'ATTACCANTE stesso, quindi ogni
    carta che legge `ctx.opponent` in `onDealsBattleDamage` lavorava al
    contrario (Don Zaloog faceva scartare il proprio controllore, Fenrir
    saltava la PROPRIA pescata). **Lezione**: quando un audit trova una
    sola collisione, guardare comunque se quel nome può assumere un
    valore diverso da quello che il contesto gli darebbe — se sì, non è
    ridondanza, è un bug latente.
  - **Carte che promettono una scelta e scelgono da sole**: segnalato
    dall'utente su Richiamo della Mummia (id 670, "non fa selezionare la
    carta che voglio evocare"). Audit incrociato (testo in `cards.json`
    con una parola di scelta + implementazione con un `findIndex`/`[0]`
    su una zona + nessuno degli helper di scelta) → **76 carte da
    guardare**, di cui 46 con un bersaglio sul Terreno preso "il primo
    che trovo". Corrette le prime 10, scegliendo quelle dove i candidati
    sono realisticamente più d'uno e la scelta cambia la partita: 670
    (Richiamo della Mummia), 147 (Cambio di Cuore), 130 (Controllo
    Mentale), 439 (Incantesimo Ombra), 620 (Cerchio Ammaliante), 163
    (Pagliaccio Insolente), 1028, 1029, 1031, 1034 (i quattro FLIP che
    rubano il controllo). **Secondo lotto**, stessa sessione: 384
    (Recupero dei Mostri), 485 (Riavvolgimento Toon), 226 (Controllore
    del Nemico), 645 (Furto Improvviso), più due con DUE scelte in
    sequenza — 388 (Scatola Mistica) e 89 (Amazzone Incantatrice).
    **Le scelte in sequenza sono il caso delicato**: i picker sono
    asincroni, quindi la seconda deve vivere DENTRO la callback della
    prima; sbagliando, o si aprono due liste insieme o la seconda non si
    apre affatto. Il test le sorveglia esplicitamente.
  - **Nuovo helper condiviso `chooseCardFromHand(ctx, options, onChosen)`**
    (card-effects.js): la sorella mancante di `offerHandDiscardChoice` —
    sceglie 1 carta della propria mano da GIOCARE, senza scartarla.
    Serviva perché l'helper dello scarto manda la carta al Cimitero,
    inutile per "Special Summona 1 mostro dalla tua mano". **Usarlo per
    ogni futura carta con quella forma.** Per il Terreno esisteva già
    `chooseFieldMonsterTarget`: le 9 carte sopra sono migrazioni a
    quello, tutte con la stessa trasformazione meccanica (il corpo va
    dentro la callback, perché la scelta è ASINCRONA).
  - **Backlog ancora aperto, con il metodo per riprenderlo** (ricontato e
    chiuso in 1.0.40, vedi «Carte che promettono una scelta» in fondo): restano 34
    carte con un bersaglio sul Terreno auto-scelto (da 46) più quelle su mano/
    Cimitero/Deck non ancora migrate. I due script di audit stanno nello
    scratchpad di sessione ma sono riscrivibili in pochi minuti: la
    ricetta è "incrocia il testo della carta con la forma del codice",
    non fidarsi di una sola delle due (molte segnalazioni sono legittime:
    bersaglio obbligato, floodgate "l'avversario non può scegliere", o
    una scelta che spetta all'avversario).
  Nuovo spec `tests/specs/scelte-utente-mancanti.spec.js`, verificato al
  contrario. Sceglie sempre il SECONDO candidato: con un solo candidato
  una scelta vera e un auto-pick darebbero lo stesso risultato, e il test
  non proverebbe nulla.

- ✅ **Il limite dichiarato "le scelte locali divergono" è CHIUSO, e sotto
  c'era un guasto molto più grosso (richiesta esplicita dell'utente di
  risolvere questo punto e la riconnessione a duello in corso).**
  - 🔴 **`extra` sovrascriveva il PROPRIETARIO dell'effetto in
    `makeContext`.** Il contesto si costruiva come
    `Object.assign({owner, opponent, ...}, ACTIONS, extra)`, con `extra`
    per ultimo — e `applyRemoteActivate` passa come `extra` il messaggio
    ricevuto, che contiene un campo `owner: 'player'` (il mittente, dal
    SUO punto di vista). Di là la carta dell'avversario si risolveva
    quindi con `ctx.owner === 'player'` e `ctx.opponent === 'player'`
    (l'opponent restava calcolato sull'owner vero): un contesto senza
    senso, e OGNI effetto che legge uno dei due lavorava sul lato
    sbagliato. **Non si vedeva con carte come Buco Nero**, che colpiscono
    i due Terreni allo stesso modo — per questo era rimasto lì. Chiuso
    forzando `ctx.owner`/`ctx.opponent` DOPO l'assign (il proprietario lo
    decide sempre il chiamante), più una ripulitura della "busta" del
    messaggio in `applyRemoteActivate` (`senzaBusta`): `owner`, ma anche
    `zone`/`index`, che sono la posizione della carta DA LUI — una Magia
    Continua giocata dalla sua mano finisce in una casella diversa di
    qua, e l'effetto sarebbe andato a cercarsi nel posto sbagliato.
  - **La scelta del bersaglio ora VIAGGIA**: nuovo
    `awaitRemoteCardChoice`/`broadcastCardChoice`/`applyRemoteCardChoice`
    (duel-engine.js), gemello per forma e per code del meccanismo già
    rodato delle risposte in Catena, usato da `chooseFieldMonsterTarget`
    (card-effects.js). Prima la copia dell'effetto che gira dall'altra
    parte auto-sceglieva il primo candidato: se il giocatore vero ne
    aveva scelto un altro, i due schermi mostravano due partite diverse —
    e proprio sul Terreno di CHI SUBISCE, dove nessuna fotografia di
    stato dell'avversario può correggere. **La scelta si comunica SEMPRE,
    anche quando è obbligata e nessun picker si apre**: le due code si
    accoppiano in ordine, e un messaggio mancante lascerebbe l'altro lato
    ad aspettare.
  - **Per le scelte che toccano il PROPRIO lato** (quale mostro rianimare
    dal proprio Cimitero, quale carta pescare, uno scarto a caso) basta
    invece la fotografia: `finishActivateCard` chiama ora
    `broadcastLocalStatePush(null)`, che chiude la questione qualunque
    cosa abbia fatto la carta.
  - **La riconnessione a duello in corso funzionava già** (verificata, non
    corretta): caduta la linea a metà partita, `network.js` rientra da
    solo, il resync riporta le mosse perse e il duello prosegue allineato.
  Nuovo spec `tests/specs/multiplayer-scelte-effetti.spec.js`, verificato
  al contrario. **Lezione di metodo**: il sintomo era "i due lati
  scelgono un bersaglio diverso", ma inseguendolo si è visto che chi
  riceveva non applicava NULLA — e la causa non era la scelta, era il
  contesto ribaltato. Quando un sintomo di divergenza non torna, guardare
  lo stato interno del lato che riceve (qui: quale modale aveva aperto)
  invece di dedurlo dal risultato finale.

- ✅ **Secondo giro di controllo ("c'è altro da controllare?") — nessuna
  falla nuova, e due allarmi RIENTRATI.** Verificato con due client veri:
  ciclo di turno su 3 giri (pescata di chi comincia, contatore del Deck
  che segue, checksum allineati, zero resync), battaglia vera fra due
  mostri (Life Point identici rovesciati sui due lati, difensore davvero
  interpellato prima del danno grazie a una Trappola coperta), cambio
  Posizione. **I due allarmi rientrati, per non riaprirli a vuoto in
  futuro**:
  - **"Il Deck dell'avversario si esaurisce prima del vero, e il duello
    finisce per sbaglio"**: NON succede. In Multiplayer
    `gameState.botDeck` è `undefined` (il mazzo dell'avversario non viene
    mai costruito, vedi il ramo `!window.MULTIPLAYER_MODE` in
    `startGame`), e `drawCardsToHand` in quel caso ricade sul solo
    CONTATORE `botDeckCount` generando una carta a caso — quindi i due
    lati calano in perfetto passo e nessuno può dichiarare un Deck out
    inesistente. **Attenzione al modo in cui si misura**: leggere
    `(gameState.botDeck || []).length` dà 0 sia per un mazzo VUOTO sia
    per uno ASSENTE, e la differenza è tutta lì — la prima lettura mi ha
    fatto credere a una falla che non c'era.
  - **"Una battaglia non toglie Life Point e il turno non passa più"**:
    era il mio test che non rispondeva al prompt del difensore. Con una
    Trappola coperta il difensore VIENE interpellato (correttamente) e
    finché non risponde la battaglia resta in sospeso, quindi
    `schedulePhaseTransition` non fa passare il turno. **Un test sul
    Multiplayer che prepara un campo con carte coperte deve rispondere a
    quel prompt**, o sembrerà di aver trovato uno stallo del motore.
  Il pezzo scoperto è diventato permanente:
  `tests/specs/multiplayer-partita-turni.spec.js` (turni, pescate, cambio
  Posizione, battaglia, LP, prompt del difensore) — verificato al
  contrario disattivando il broadcast dell'attacco, e fallisce proprio
  sul "difensore mai interpellato".

- ✅ **Giro di controllo su "cos'altro non viaggia?" (richiesta esplicita
  dell'utente) — CINQUE falle, due gravissime.** Metodo: invece di
  rileggere il protocollo, elencare le mosse che cambiano lo stato
  PUBBLICO in un duello vero e provarle una per una con due client,
  guardando tre cose — l'effetto dall'altra parte, i due checksum, e se
  chi riceve chiede un resync. **Quest'ultima misura è quella che fa
  emergere questa intera famiglia di bug**: il motore si riallinea da sé
  quando i checksum divergono, quindi una mossa che non viaggia sembra
  funzionare se si guarda solo lo stato finale.
  - 🔴 **Ogni attivazione di carta restava ferma 30 secondi, poi
    rimbalzava fra i due client per sempre.** L'avviso all'avversario
    partiva da `finishActivateCard`, cioè a Chain GIÀ RISOLTA: chi
    attivava apriva la finestra di risposta e chiedeva all'avversario se
    voleva rispondere a una carta che non gli era ancora stata detta.
    Nessuno poteva rispondere e si consumava tutto
    `REMOTE_CHAIN_DECISION_TIMEOUT_MS` (30s, misurato: il campo si
    svuotava a ~33s). Peggio: chi riceveva l'attivazione la
    RI-TRASMETTEVA — il controllo `!window.MP_applyingRemote` protegge
    solo la parte SINCRONA, ed era già tornato falso quando la Chain si
    risolveva — quindi il mittente la riapplicava e la rimandava
    indietro, un giro ogni 30 secondi, all'infinito. Chiuso spostando il
    broadcast PRIMA di `openActivationWindow` (così i due lati aprono la
    stessa finestra insieme e si scambiano le decisioni come già fanno
    per le risposte a un'Evocazione) e sostituendo la guardia con
    `owner === 'player'`, che regge anche in asincrono — stessa regola
    già usata da `resolveAttack`. **Lezione generale**: in questo
    protocollo `MP_applyingRemote` NON è affidabile per decidere se
    trasmettere, se il punto in cui si decide gira dopo un `await`/
    callback; il proprietario dell'azione sì.
  - 🔴 **Il resync ribaltava di chi fosse il turno**:
    `serializePublicState` mandava `currentPlayer` così com'era e chi
    riceveva se lo copiava pari pari — ma 'player'/'bot' sono relativi a
    chi guarda, quindi dopo OGNI risincronizzazione i due client
    credevano entrambi che fosse il proprio turno. Chiuso con
    `currentPlayerIsSender` (il fatto oggettivo) tradotto da chi riceve;
    `currentPlayer` resta nel messaggio solo per un client più vecchio.
  - **Una Magia giocata dalla MANO non arrivava affatto**: di là quella
    mano è fatta di segnaposto (`'???'`, id -1), quindi `activateCard`
    non trovava nessuna carta e usciva subito. Chiuso mandando la carta
    intera nel messaggio (`activatedCard`) e mettendola al posto del
    segnaposto prima di attivare.
  - **Special Summon dalla propria mano** (`trySpecialSummonFromHand`, le
    ~33 carte che si Evocano da sé) e **Evocazione dall'Extra Deck
    bandendo materiali** (`banishFusionSummon`, click sulla zona Fusion)
    non viaggiavano affatto.
  - **Lo scarto per il limite di 6 carte a fine turno** non viaggiava, e
    chi riceveva tirava a indovinare scartando al posto dell'avversario
    (`autoDiscardBotHandExcess`) — ora in Multiplayer non lo fa più:
    quale carta scartare lo sceglie la persona vera.
  Le ultime tre chiuse con UN solo meccanismo generico invece di tre
  messaggi su misura: **`DuelEngine.broadcastLocalStatePush(summoned)`**
  manda la propria situazione pubblica come fatto compiuto
  (`kind: 'state-push'`), invece di descrivere la mossa che l'ha
  prodotta. Il motivo è che queste mosse portano con sé COSTI (bandire
  dal Cimitero, sacrificare dal Terreno) che un messaggio su misura
  dovrebbe descrivere uno per uno, ognuno col suo rischio di ordine
  sbagliato: una fotografia non ha ordini da sbagliare. Chi riceve la
  applica in silenzio (non è un guasto da segnalare come un resync) e
  SENZA toccare turno/fase (quelli viaggiano già coi messaggi 'phase', e
  sovrascriverli rimanderebbe indietro un turno già avanzato). Il campo
  `summoned` non tocca lo stato: serve solo a far vedere l'Evocazione e a
  dare all'avversario la finestra di risposta. **Una futura mossa della
  stessa forma ("cambio il mio stato pubblico in un modo che il
  protocollo non sa raccontare") deve chiamare questa, non inventare un
  messaggio nuovo.**
  Nuovo spec `tests/specs/multiplayer-mosse-non-trasmesse.spec.js`, con
  ogni pezzo verificato al contrario. **Insidia di test trovata
  scrivendolo**: la firma è `waitForFunction(fn, arg, options)` — passando
  le opzioni come SECONDO argomento (stile già presente negli spec più
  vecchi di questo progetto) finiscono in `arg` e il timeout torna al
  default di 30s. Qui contava: il tetto stretto serviva proprio a cogliere
  lo stallo da 30 secondi.

- ✅ **I Tributi in Multiplayer, chiusi (richiesta esplicita dell'utente
  dopo che il giro precedente li aveva lasciati come limite noto).** Il
  messaggio `kind: 'tribute'` portava solo gli indici da svuotare; ora
  porta tutto quello che serve a fare di là esattamente quello che si è
  fatto di qua — `zone` ('monster' o 'st'), `delayMs` (quanto aspettare
  prima di applicare) e `summonedCard` (solo per una vera Evocazione
  Tributo). Tre difetti distinti chiusi insieme:
  - **Gli avvisi del motore non scattavano su chi riceve**:
    `applyRemoteTribute` spostava le carte nel Cimitero e basta, senza
    `notifyOwnMonsterSentToGraveyard`/`notifySacrificedForTribute` che il
    lato di chi sacrifica fa invece partire. Una carta che reagisce al
    proprio sacrificio (Abbandonato id 416) o a quello di un compagno
    scattava quindi su un client solo — e `notifySacrificedForTribute`
    porta anche il redirect al bando di `mustBanishOnLeavingField`, per
    cui la stessa carta finiva bandita di là e nel Cimitero di qua.
    **Rifare la reazione di qua NON la esegue due volte**: un handler
    reattivo non passa da `DuelEngine.activateCard`, quindi non trasmette
    nulla — è lo stesso modello per cui `applyRemoteSummon` fa scattare i
    trigger di Evocazione e `applyRemoteAttack` risolve tutta la
    battaglia in locale. Il timore espresso nel giro precedente ("farci
    partire degli effetti rischia che ritrasmettano indietro le proprie
    azioni") era quindi sovrastimato: basta tenere alzato
    `MP_applyingRemote` per l'intera durata, e per questo la rimozione
    vive ora in una funzione a parte (`rimuoviCarteSacrificate`) — girando
    dentro un `setTimeout` è già FUORI dal try/finally di
    `applyRemoteAction`.
  - **Il sacrificio pagato per attaccare disallineava i due lati ad ogni
    attacco** (Guerriero Pantera id 399): chi riceveva aspettava sempre i
    700ms dell'animazione, chi mandava toglieva il mostro subito — e il
    messaggio `'attack'` che parte una riga dopo arrivava con un checksum
    calcolato a mostro già sparito, contro un campo dove era ancora lì.
    Chiuso con `delayMs: 0`. **Nello stesso punto è emerso un secondo
    ordine sbagliato**: quel `tribute` veniva trasmesso PRIMA di applicare
    la rimozione, quindi spediva una fotografia in cui il mostro era
    ancora in campo. Ogni azione porta con sé il checksum di chi la manda
    e chi la riceve confronta il proprio DOPO averla applicata: **la
    trasmissione va sempre DOPO aver applicato tutto**, com'è già in
    `summonMonster`/`setSpellTrap`. Stesso spostamento fatto anche in
    `performGearCastleTributeSacrifice` e in `bot.js`.
  - **Castello dell'Ingranaggio Antico (id 843) non viaggiava affatto**:
    `performGearCastleTributeSacrifice` non trasmetteva nulla, e il
    Castello restava per sempre nella zona Magia/Trappola dal lato
    dell'avversario. Chiuso con `zone: 'st'` sullo stesso messaggio invece
    di inventarne uno nuovo: per tutto il resto un Sacrificio dalla zona
    Magia/Trappola si comporta come uno dalla zona Mostro.
  Nuovo spec `tests/specs/multiplayer-tributi.spec.js` (`standalone`), con
  ciascuno dei tre casi verificato AL CONTRARIO, uno alla volta, rimettendo
  solo quel pezzo allo stato precedente. **Lezione di metodo generale per
  il Multiplayer**: oltre all'effetto visibile, misurare SEMPRE che chi
  riceve non chieda un `request-resync` — il motore si riallinea da sé
  quando i checksum divergono, quindi due di questi tre bug sarebbero
  risultati "verdi" a un test che guarda solo lo stato finale. Suite 64/64.

- ✅ **Multiplayer: monete, dadi e Token escono uguali sui due client
  (`ctx.random`/`ctx.randomPick`/`ctx.newTokenUid`, duel-engine.js —
  vedi il commento su `sorteggioCondiviso`)**. Questo file portava il
  caso come limite noto con la postilla "il checksum e il resync restano
  la rete di sicurezza": misurato con due client veri, **quella rete non
  scatta affatto**. Con Mago del Tempo (id 28, Testa distrugge i mostri
  dell'AVVERSARIO, Croce i PROPRI) un lato ha visto Croce e si è
  distrutto il campo, l'altro Testa e ha distrutto quello di fronte —
  lo stesso mostro vivo su uno schermo e morto sull'altro, con **zero**
  richieste di resync: la fotografia di stato che segue ogni attivazione
  (`broadcastLocalStatePush`) rimette a posto solo il lato di CHI MANDA.
  Divergenza silenziosa, non rumorosa. **Perché il risultato non
  viaggia**: far viaggiare ogni lancio come viaggiano le scelte di
  bersaglio (`awaitRemoteCardChoice`) non si può — quelle sono già
  asincrone (si apre un modale e si aspetta), un dado si tira in mezzo a
  una riga di codice, e renderlo asincrono vorrebbe dire riscrivere a
  callback una trentina di effetti. Non serve: il seme si ricava da cose
  su cui i due client sono GIÀ d'accordo (l'uid della carta, che viaggia
  con ogni messaggio, più il turno) e da due contatori che avanzano
  uguali perché i due lati eseguono lo stesso codice — nessun messaggio
  nuovo, nessuna attesa, il punto di chiamata resta sincrono. **Una
  carta nuova che tira una moneta o un dado deve usare questi, mai
  `Math.random()`.** I contatori sono due apposta (uno per le
  invocazioni successive della stessa carta, uno per i lanci dentro la
  stessa invocazione — Drago Barile id 104 ne fa tre di fila): separati,
  un lato che tirasse un numero diverso di volte dentro un'invocazione
  non sposta anche tutte le invocazioni successive; e la mappa si azzera
  ad ogni cambio turno, così una deriva non sopravvive al turno in cui è
  nata. Fuori dal Multiplayer resta `Math.random()` puro (nessun secondo
  client con cui accordarsi, e un seme prevedibile renderebbe i dadi
  indovinabili in partita singola); equità verificata su 200.000 lanci.
  I **Token** erano la stessa falla con un'altra faccia: nascono durante
  il duello con un uid fatto di `Date.now()`+`Math.random()`, quindi i
  due lati davano due uid DIVERSI allo stesso Token e da lì in poi ogni
  scelta di bersaglio che viaggia per uid non lo ritrovava più
  dall'altra parte. **Deliberatamente NON migrati** i 7 rimescoli di
  Deck: un rimescolo non ha nulla da accordare — ciò che cambia per
  entrambi avviene uguale comunque, l'ORDINE tocca solo il proprio Deck,
  che è privato e che l'avversario non simula nemmeno (c'è un commento
  sul posto perché non sembri una dimenticanza).
  `tests/specs/multiplayer-sorteggi.spec.js`, verificato al contrario su
  due dei tre controlli.
- ✅ **Se l'avversario lascia un duello Multiplayer avviato, chi resta
  vince** (`opponent-left` in `js/multiplayer/multiplayer.js`). La sala
  d'attesa sapeva già reggere l'uscita dell'altro; il duello no:
  compariva un cartello permanente e basta, sopra una partita che non
  poteva più proseguire (l'avversario non avrebbe mai più mosso, quindi
  il turno non sarebbe mai tornato indietro) — nessuna schermata finale,
  nessun premio, nessun risultato. `opponent-left` il server lo manda
  solo quando non c'è più nulla da aspettare (uscita volontaria, o
  finestra di grazia di 45s scaduta): la caduta di linea momentanea è
  `opponent-disconnected`, e quella si continua ad aspettare. La stessa
  guardia (`gameState.gameOver`) sistema un secondo fastidio
  preesistente: a fine duello normale chi perde preme "Continua" e la
  sua pagina se ne va, quindi al vincitore arrivava quel cartello
  piazzato sopra la schermata di vittoria.
  `tests/specs/multiplayer-abbandono-a-duello-avviato.spec.js`,
  verificato al contrario. **Insidia di test trovata scrivendolo**: a
  duello concluso il pannello `#gameLog` non è un posto affidabile da
  cui leggere l'esito (la schermata finale ci passa sopra) — meglio
  intercettare `endDuel`.

- ✅ **`card-effects.js` diviso: helper condivisi + 8 parti di sole
  registrazioni** (sviluppato sul branch `refactor/spezza-card-effects`,
  poi MERGIATO in `main` su richiesta esplicita dell'utente e il branch
  eliminato — il progetto resta a un solo branch attivo). Era 23.800
  righe e 1,3 MB, di gran
  lunga il file più grande del progetto. Ora `js/engine/card-effects.js`
  conserva l'intestazione storica (tutte le convenzioni per scrivere una
  carta) più i 26 helper usati da gruppi di carte LONTANI fra loro,
  esposti come `window.CardEffectsShared`; `card-effects-1..8.js`
  contengono solo blocchi `register`, ~2.950 righe e ~95 carte ciascuno,
  e si importano in cima ciò che usano
  (`const { ... } = window.CardEffectsShared`).
  - **Il taglio è puramente MECCANICO**, per righe e non per tema: le
    carte restano nell'ordine di sempre. Per trovarne una si cerca
    `register(<id>` in tutta `js/engine/`, non si aprono i file a caso.
  - **Come sono stati scelti i confini, invece che a occhio**: uno
    script ha misurato, per ogni nome di primo livello, la distanza fra
    la dichiarazione e il suo ultimo uso. 26 nomi attraversano quasi
    tutto il file (fino a 23.700 righe) → sono quelli condivisi; 41 sono
    grappoli locali (al massimo 243 righe) → restano accanto alle loro
    carte, e nessun taglio può cadere dentro un grappolo. Dei 26, solo 6
    erano dichiarati in mezzo alle carte e sono saliti in cima, con una
    briciola di commento al loro vecchio posto. Una chiusura transitiva
    ha verificato che nessuno dei 26 tirasse dentro altri nomi.
  - **La prova che nessun effetto è cambiato**, molto più forte di "i
    test passano": un'impronta del registro presa PRIMA e DOPO — per
    ognuna delle 822 carte registrate, i nomi degli hook e il TESTO
    SORGENTE di ogni funzione (`fn.toString()`). Risultato: 822 carte,
    1938 voci, zero differenze. **Da rifare uguale per qualunque futuro
    refactor che sposti codice senza volerlo cambiare** — dimostra
    l'identità del contenuto invece di dedurla.
  - **Nuovo guardrail permanente**
    (`tests/specs/guardrail-parti-card-effects.spec.js`, analisi statica)
    per i due modi nuovi di rompere tutto in silenzio che la divisione
    introduce: una parte che CHIAMA un helper condiviso senza averlo
    nella propria riga di import (ReferenceError che salta fuori solo
    quando quella carta viene giocata), e una pagina che carica il file
    condiviso dimenticandone una parte (~100 carte mute). Verificato al
    contrario su entrambi i casi.
  - **Il guardrail del checkpoint di targeting ha bocciato il primo giro
    completo, e aveva ragione**: leggeva solo `card-effects.js` e
    contava zero chiamate. Non era una protezione perduta ma un
    cambiamento di struttura — ora legge il condiviso più ogni parte,
    così una parte nuova entra nel conteggio da sola. **Aggiornare un
    guardrail che legge i sorgenti è parte del costo di qualunque
    divisione di file: cercarli PRIMA, non aspettare che la suite
    fallisca.**
- ✅ **Il Terreno non viene più ricostruito da zero ad ogni render**
  (`riconciliaBoard`/`trasferisciGestori` in `js/engine/game-flow.js`,
  sviluppato sul branch `refactor/rendering-incrementale`, poi MERGIATO
  in `main` su richiesta esplicita dell'utente e il branch eliminato).
  `renderFields()` faceva `innerHTML = ''` sui due contenitori e
  riattaccava tutto ad ogni `updateUI()`, circa una volta al secondo.
  - **Misurato prima di toccare qualcosa, su un duello vero lasciato
    giocare**: su 560 caselle ridisegnate solo 39 erano davvero cambiate
    (7%), 5 render su 20 non cambiavano nulla, e **nessuno** dei 2115
    nodi del Terreno sopravviveva a un render — 0%, immagini comprese.
    Dopo: sopravvive il 76% dei nodi e il **96,6% delle immagini**.
  - **NON è una modifica per la velocità, e non va raccontata così**: il
    JS per render passa da ~0,74 a ~1,19 ms, perché le righe nuove si
    costruiscono comunque e in più si confrontano. Il costo in JS era ed
    è trascurabile; quello che si guadagna è che una carta ferma smette
    di essere distrutta e ricreata a ogni battito.
  - **Come si decide se riusare un nodo**: confrontando l'HTML appena
    costruito con quello a schermo, MAI una lista di campi scritta a
    mano. È ciò che rende il meccanismo incapace di mostrare uno stato
    vecchio — qualunque cosa cambi nel disegno di una casella, oggi o
    fra dieci carte nuove, cambia anche il suo HTML. L'unica cosa che
    l'HTML non racconta sono i gestori di evento (catturano lo `slot`
    del momento): quelli si ricopiano sempre dal nodo nuovo al vecchio,
    e sono solo tre — `onclick`, `onmouseenter`, `onpointerdown`. **Se
    un giorno se ne aggiunge un quarto va elencato in
    `GESTORI_DA_TRASFERIRE`**, o smetterebbe di funzionare proprio sulle
    caselle rimaste ferme, il caso più comune.
  - **ATTENZIONE A NON CONCLUDERE TROPPO**: questo NON rende ancora
    sicuro appendere un'animazione lunga a una casella. Un tween che
    scrive stili inline (GSAP) o aggiunge una classe cambia l'HTML del
    nodo, quindi al render successivo quel nodo viene sostituito e
    l'animazione muore, esattamente come prima. Il bagliore del mazzo in
    `js/ui/fx-gsap.js` e il livello separato degli ologrammi restano
    necessari: il vincolo è ridotto, non rimosso.
  - **Bug reale preso scrivendolo, da ricordare**: `nuova.children` è
    una collezione VIVA. Spostando una casella nuova dentro la riga
    vecchia la si toglie da quella nuova e tutti gli indici slittano, per
    cui il ciclo scritto sulla collezione viva ne saltava una su due — il
    Terreno usciva con le zone 0, 2, 4 e le altre sparite. Si risolve
    fotografando i figli con `Array.from` prima di toccare il DOM.
  - **Insidia di TEST, non del motore**: un confronto "incrementale
    contro ricostruzione totale" richiede un render di assestamento
    prima, perché `createSlotElement` aggiunge la classe `pile-receive`
    quando il conteggio di una pila è CRESCIUTO dall'ultimo render —
    quindi la prima e la seconda chiamata differiscono di diritto. Senza
    quel giro a vuoto il test bocciava 24 stati su 60 per una differenza
    legittima (e mi ha fatto cercare un bug che non c'era).
  Nuovo spec permanente `tests/specs/render-terreno-incrementale.spec.js`
  (40 stati di campo con seme fisso, identità dei nodi, gestori vivi,
  click vero che consegna la carta giusta, e una casella che cambia
  dev'essere davvero sostituita).

- ✅ **AGGIORNAMENTO (1.0.35): ora SI PUÒ, chiedendo di essere
  aspettati.** `callCardHandlerWaiting` (duel-engine.js) esegue un
  handler e chiama il seguito solo quando l'handler ha finito: un handler
  che fa scegliere chiama `attendiScelta(ctx)` (card-effects.js) e riceve
  la funzione da chiamare a scelta fatta. La usano `resolveChain` (ogni
  link), l'auto-effetto di chi attacca (`onOwnAttackDeclare`) e il nuovo
  hook `def.beforeDamageCalculation(ctx)` ("durante il calcolo dei danni,
  puoi...", `runBeforeDamageCalculation`, subito prima di
  `resolveBattleDamage`; un bonus deciso lì va in
  `gameState.damageStepOnlyBonusFor`). È un'ADESIONE ESPLICITA, non
  automatica per ogni picker: chi chiede l'attesa deve chiamare la
  funzione su OGNI strada, Annulla compreso, o la battaglia resta ferma.
  Per il caso comune "scegli 1 carta sul Terreno, effetto obbligatorio"
  esiste `chooseFieldCardTargetWaiting` (riapre la lista se la si chiude,
  chiude l'attesa anche su un errore); per una scelta fra OPZIONI con
  etichetta (una categoria, due effetti) `chooseOption` +
  `DuelEngineUI.openOptionPicker`, che in Multiplayer viaggia sulla stessa
  coda delle scelte di bersaglio. Con questo sono tornate a una scelta
  vera 214, 622 (metà attacco), 819, 852 e si sono chiuse 100, 883, 885,
  889, 895, 1120 (`scelte-che-la-battaglia-aspetta.spec.js`, verificato
  al contrario togliendo l'attesa). **Resta vero quanto sotto per un
  handler che NON chiede l'attesa**, e resta vero per il checkpoint di
  targeting (`declareCardEffectTarget`), che è sincrono per costruzione:
  chi ha attivato l'effetto legge il bersaglio finale subito dopo, quindi
  235 e la metà Magia/Trappola di 622 scelgono ancora da sole.
  Testo storico della regola, valido prima di questo meccanismo:
- ⚠️ **UN PICKER ASINCRONO NON SI PUÒ APRIRE DENTRO `onAttackDeclare`
  (né dentro qualunque handler che faccia da link di una Chain e che
  qualcuno stia aspettando) — misurato, non dedotto.** `resolveChain`
  chiama l'handler del link e prosegue dopo una pausa fissa SENZA
  aspettarlo (vedi `runHandler` in `duel-engine.js`), e per
  `onAttackDeclare` chi aspetta è `resolveAttack`, che subito dopo
  calcola i danni. Prova concreta fatta con Fuoco di Copertura (id 852),
  il cui effetto è misurabile in punti: scegliendo SUBITO il bonus si
  applicava (0 LP persi, difensore vivo), ma scegliendo dopo **4
  secondi** — il tempo che ci mette una persona a leggere due carte — la
  battaglia si era già risolta, il bonus arrivava a danno calcolato e la
  carta non faceva NULLA (1400 LP persi, difensore morto). Quattro carte
  erano già state migrate a una scelta vera e sono state **rimesse
  all'auto-scelta sincrona** appena la misura l'ha mostrato: 214
  (Spiritello dei Sogni), 622 (Spostamento), 819 (Scudo con Braccio
  Magico), 852 (Fuoco di Copertura). Dove l'auto-scelta è rimasta, è
  stata resa la MIGLIORE possibile (852 presta ora l'ATK più alto, non
  il primo mostro trovato) invece di lasciare "il primo che trovo".
  È lo stesso identico vincolo già documentato per le Trappole Contatore
  (189, 361, 396, 689, 752). **Regola pratica per una futura
  migrazione**: un picker asincrono è sicuro dove NESSUNO aspetta il
  risultato dell'handler (`activate` di una Magia, `onFlip`,
  `onSpecialSummon`, `onDestroy`, `onSTDestroyed`) e NON lo è dentro una
  finestra di risposta che fa da cancello a una battaglia.

- ✅ **Artefatti all'apertura del duello SU MOBILE, segnalati
  dall'utente** ("tra la fine del loading e la comparsa del campo, su
  mobile grafica che si sposta; su desktop è ok"). Erano **due** cose
  distinte, stessa causa di fondo: valori in PIXEL FISSI tarati su una
  finestra desktop larga.
  1. **Cinematica VS** (`js/ui/duel-cinematics.css`): nella fase "clash"
     i due duellanti si scostano di ±26px per lasciare il centro a
     DUEL!, poi escono a ±90px. Su 1400px non si nota; su 393px il palco
     è già largo 377px e non c'è spazio da cui scostarsi, quindi
     finivano FUORI dallo schermo **mentre erano a piena opacità** —
     misurato: giocatore a x=-15, avversario fino a 408 su schermo 393.
     Risolto rendendo i tre spostamenti variabili CSS con `clamp` su
     `vw` (`--di-enter`/`--di-clash`/`--di-exit`): su desktop i valori
     restano identici, su mobile si riducono a quel poco che ci sta.
  2. **Zoomata della telecamera** (`duelMonstersCore.html`,
     `cameraIntroZoomOut`): partiva da `scale(1.7)` + `rotateX(58deg)`.
     Su mobile il campo partiva da **-241 a 634**, cioè 875px su uno
     schermo di 393 — più del doppio — e tagliava pila del Deck,
     Abbandona e contatore turni, che sembravano "scivolare" mentre la
     zoomata rientrava. Ora scala e inclinazione sono variabili CSS,
     ridotte SOLO dentro il `@media (max-width: 900px)` già esistente.
  - **I valori sono stati scelti misurando, non a occhio**: sbordo per
    lato su 393px — 241px coi valori desktop, 50px con 1.12/40deg, 26px
    con 1.04/34deg, **13px con 1/28deg** (adottato). Sotto i 28° si
    guadagnano 3px e l'atterraggio in 3D smette di leggersi.
  - **Il desktop è rimasto bit-per-bit quello di prima**, verificato
    misurando le stesse posizioni prima e dopo (duellanti a x=191 e
    destra=1209 in entrambi i casi) — era il vincolo esplicito
    dell'utente.
  - **Lezione di metodo**: il punteggio CLS (`layout-shift`) qui NON
    serviva a niente — mobile 0,0524 contro desktop 0,0539, praticamente
    uguali, e dominati dalle carte che volano in mano, cioè movimento
    VOLUTO. Il difetto si è visto solo guardando i fotogrammi e poi
    misurando i `getBoundingClientRect()` degli elementi giusti nel
    tempo. Per un artefatto di questo tipo, campionare la geometria
    fotogramma per fotogramma è lo strumento, non le metriche web
    standard.
  Nuovo spec permanente
  `tests/specs/intro-duello-non-sborda-su-mobile.spec.js` (`standalone`:
  serve una finestra mobile e la sequenza d'apertura VERA, mentre il
  resto della suite gira a 1400x900 con `DUEL_FAST_OPENING`, che l'intro
  la salta). Verifica la PROPRIETÀ ("niente esce dai bordi"), non i
  numeri esatti, così un futuro ritocco all'effetto non lo rompe per
  forza. Verificato al contrario rimettendo i valori desktop.

- 🔴 **Fuga di informazione trovata e chiusa mentre si restituivano le
  scelte al giocatore: il picker rivelava le carte COPERTE
  dell'avversario.** `chooseFieldCardTarget` passa i candidati a
  `openCardListPicker`, che li disegnava sempre SCOPERTI — quindi un
  effetto tipo "scegli 1 carta sul Terreno" elencava nome, ATK/DEF ed
  effetto di ogni carta Set avversaria, gratis, senza nemmeno doverla
  scegliere. Verificato che succedesse davvero: il picker di Drago
  Barile (id 104) mostrava "Gearfried il Cavaliere di Ferro
  ⚔️1800🛡️1600" per un mostro coperto. Non è un difetto introdotto da
  una singola carta: riguardava OGNI chiamante con `includiCoperte`,
  quelli nuovi e quelli già esistenti da sessioni precedenti.
  Chiuso nel punto CONDIVISO, non carta per carta: `chooseFieldCardTarget`
  marca una COPIA della carta (stesso uid, che è come il chiamante la
  ritrova dopo il click) con `__mostraCoperta`, e `openCardListPicker`
  la disegna col retro e non ne mostra nulla nemmeno al passaggio del
  mouse. Restano scoperte le PROPRIE carte coperte — sono già tue, non
  c'è niente da nascondere — e resta scoperto tutto ciò che sul Terreno
  è davvero scoperto. **Una futura carta che includa le coperte
  avversarie fra i candidati eredita la protezione senza fare nulla.**
  **Lezione**: quando si trasforma un'auto-scelta in una scelta del
  giocatore, chiedersi sempre se l'elenco che si sta per mostrare
  contenga informazione che quel giocatore non dovrebbe avere — dare la
  scelta e dare informazione nascosta sono due cose diverse, e la
  seconda arriva di contrabbando insieme alla prima.

- ✅ **I 63 `missingEffectNote` riletti uno per uno contro il codice, e
  cinque carte chiuse perché la loro nota era diventata falsa.** Il
  numero scritto in questo file (35) era sbagliato e l'elenco non
  corrispondeva più a niente: da qui la revisione. Il metodo è stato
  leggere l'implementazione di ogni carta invece della nota, perché **la
  nota è il documento, il codice è il fatto** — e le due cose divergono
  in modi che non si vedono dall'esterno.
  - **Il caso che vale la pena ricordare, id 244 (Crepuscolo a Cinque
    Stelle)**: la nota diceva "servirebbe un marcatore per-ISTANZA, che
    questo motore non ha", e il commento sopra la carta ripeteva la
    stessa cosa — mentre **cinque righe più sotto il codice usava già
    quel marcatore** (`gameState.cannotBeTributedUids`, nato per
    Controllo Mentale id 130). Tre affermazioni su tre erano vecchie, e
    tutte si smentivano guardando la funzione che descrivevano.
    Da questo è venuto il resto: se un meccanismo esiste già per una
    carta, cercarlo prima di dichiararlo mancante per un'altra.
  - **Chiuse perché la nota non era più vera**: 244 (vedi sopra); **125**
    (Cinghiale Soldato, "Evocabile solo tramite Flip Summon" — la nota
    diceva "non ancora verificato se il motore distingua un'Evocazione a
    faccia in su da un Set": lo distingue, `summonedPosition` è
    'attack' o 'defense', e lo legge già id 1316); **898** e **1038** e
    **1036**, dove la scelta promessa dal testo ora è del giocatore.
  - **Nuovo `options.cannotBeTributed` su `ACTIONS.createTokens`**
    (duel-engine.js): il commento lì diceva "nessun meccanismo di
    restrizione-Tributo per-carta esiste ancora in questo motore", falso
    da quando esiste `cannotBeTributedUids`. Ora Capro Espiatorio (id
    434) genera Token non sacrificabili come da testo, e **qualunque
    futura carta che generi Token con quella clausola la ottiene
    chiedendo l'opzione** — che resta un'opzione e non il default,
    perché non tutti i Token del gioco la portano.
  - **Le note riscritte non contengono più censimenti.** Otto di loro
    dichiaravano "coperto ora da 64 carte" seguito dall'elenco degli id:
    ricontato, erano **79**, e id 761 diceva 19 dove erano 28. Un numero
    del genere invecchia da solo ad ogni carta nuova — ora le note
    dicono dove contarlo invece di riportarlo.
  - **Restano 58 note**, divise in tre famiglie nella sezione qui sotto.
    La più utile per una sessione futura è il sotto-gruppo "non può
    essere Special Summonata dal Cimitero" (1105/1118/1123): tre carte
    con lo stesso identico bisogno, e il punto unico dove chiuderle
    esiste già — manca solo che sappia da dove arriva la carta.
  `tests/specs/note-carte-chiuse.spec.js` sorveglia le cinque chiusure,
  verificato al contrario su entrambi i meccanismi nuovi. Suite 85/85.

- ✅ **`fromZone` non è più facoltativo, e con questo si chiudono
  1105/1118/1123 più due carte che erano rotte in silenzio.** Il 5°
  argomento di `ACTIONS.specialSummon` dice da dove arriva la carta.
  Era nato opzionale, e su 114 chiamate reali lo passavano in 20 — così
  **Carta del Ritorno Sicuro (id 141) e la sua gemella pescavano solo
  in una minoranza delle rianimazioni**, senza che nulla segnalasse
  niente. Non era quindi lavoro speculativo per tre carte future: due
  carte esistenti erano già a metà servizio.
  - **Il divieto vive nel punto unico**: nuovo
    `def.cannotBeSpecialSummonedFromGraveyard`, controllato in
    `ACTIONS.specialSummon` accanto al gemello `def.cannotSpecialSummon`
    già lì. Con `def.specialSummonFromGraveyardException(owner, card)`
    per le carte che hanno una clausola di riscatto — id 1105 si lascia
    rianimare tributando 1 Drago, e il Tributo lo paga l'eccezione
    stessa: se non c'è nessun Drago torna false e la carta resta dov'è.
  - **La classificazione delle 86 chiamate è stata fatta da uno script
    che PROPONE e da un secondo controllo che VERIFICA, mai da un solo
    passaggio.** L'euristica guarda come il chiamante ha tolto la carta
    dalla sua zona nelle righe precedenti; il controllo indipendente
    ricontrolla che ogni sito marcato `'graveyard'` abbia davvero una
    rimozione dal Cimitero lì vicino. **Il secondo passaggio ha trovato
    9 errori del primo**, tutti dello stesso tipo: l'euristica leggeva
    un `graveyard.push(...)` che mandava al Cimitero il COSTO della
    carta (il mostro tributato, la carta scartata, la carta stessa) e
    lo scambiava per la provenienza di quella evocata. Fra questi id 152
    (Prescelto, dalla mano), id 642 (Cucciolo del Drago Nero, dalla
    mano) e id 790 (Festa Isterica, che scarta dalla MANO ma evoca dal
    CIMITERO — cioè l'errore nella direzione opposta). **Lezione per un
    futuro giro meccanico**: un'euristica che legge il contesto va
    sempre incrociata con un controllo scritto a partire da un'altra
    idea, perché un'euristica sola sbaglia in modo sistematico e i suoi
    errori si somigliano tutti.
  - **Nuovo guardrail permanente**
    (`tests/specs/guardrail-fromzone.spec.js`, analisi statica): ogni
    chiamata a `specialSummon` deve passare `fromZone`, e le zone
    ammesse sono un elenco chiuso. È il pezzo che rende il meccanismo
    affidabile invece che *quasi* affidabile — senza, la prossima carta
    scritta copiando una vecchia riaprirebbe il buco in silenzio.
    Controlla anche che le tre carte restino marcate.
  `tests/specs/special-summon-dal-cimitero.spec.js` prova il divieto, il
  riscatto in entrambi i sensi, che dalla MANO le stesse carte restino
  Evocabili, e che id 141 peschi su una rianimazione qualunque.
  Verificato al contrario su divieto e guardrail. Suite 87/87.

- ✅ **Sfide a quattro sezioni + missioni a rotazione** (`sfide.html`,
  `js/data/missions-db.js`, `js/challenges/challenge-tracker.js`): Oggi
  (3 missioni, nuove ogni giorno), Settimana (10), le Sfide di sempre,
  una sezione per Storia. Le missioni sono un'altra cosa dalle Sfide e
  vivono in un contenitore a parte (`save.missions`) che tiene la CHIAVE
  del periodo insieme al progresso: cambiata la chiave, si butta. Usare
  `save.challenges` con un id composito tipo `mission:x:2026-09-22`
  avrebbe fatto crescere il salvataggio di un blocco per ogni giorno
  passato, per sempre. Il sorteggio è deterministico sulla chiave del
  periodo, come le carte del giorno del Negozio, e il roster estratto si
  salva — non per ricalcolarlo, ma perché il giorno in cui il pool
  cambiasse chi ha una missione a metà non se la veda sparire.
  **Insidia del test**: il roster salvato faceva passare il controllo
  "riaprendo sono le stesse" anche con un `Math.random()` al posto del
  seme. Il test butta via il roster e ricostringe a ripescare tre volte.

- ✅ **Il pulsante "Continua" a fine duello era coperto dalla sua stessa
  fascia sfumata** (`js/ui/duel-cinematics.css`). Un `z-index: -1` manda
  uno pseudo-elemento dietro al genitore SOLO finché il genitore non apre
  un contesto di impilamento — e `.do-continue` è `position: sticky` CON
  `z-index: 1`, quindi ne apre uno, e lì dentro il -1 si dipinge sopra lo
  sfondo del genitore. **Nessuna misura lo vedeva**: geometria giusta, e
  perfino `elementFromPoint` al centro del pulsante tornava il pulsante,
  perché la fascia ha `pointer-events: none` — copre il colore, non il
  tocco. Si vede solo GUARDANDO uno screenshot. Ora la fascia è un
  elemento a sé (`.do-content::after`), sopra le righe e sotto il
  pulsante. **Attenzione**: essendo un flex item, il `gap` del
  contenitore la spingeva giù di altri 14px che diventavano scorrimento
  vero dove non c'era niente da scorrere; il margine negativo annulla
  anche il gap, che vive in una variabile usata da entrambi.
  Aggiunto anche l'avviso "↓ scorri" quando i premi non ci stanno tutti:
  con dieci premi su un telefono in orizzontale se ne leggono due e la
  schermata sembra finita lì.

- ✅ **Un guardrail che legge i sorgenti deve seguire il codice quando il
  codice si sposta.** `catalogo-sfide.spec.js` controlla che ogni `type`
  di Sfida sia davvero registrato, leggendo però un ELENCO DI QUATTRO
  FILE scritto a mano — dove `js/story/story-progress.js` non c'era.
  Risultato: bocciava il catalogo per un aggancio che invece esisteva.
  Ora scandaglia tutto `js/`. **La prossima bocciatura di un guardrail
  statico va sempre verificata prima contro il codice**: può essere il
  guardrail a essere rimasto indietro.

- ✅ **Autowin delle Storie sotto interruttore dell'amministratore**
  (`js/dev/test-shortcuts.js` + Pannello Admin). Era una costante accesa
  per tutti e sempre. Ora servono DUE cose insieme: l'interruttore acceso
  su quel dispositivo (localStorage) E `CloudSync.isAdmin()` — una chiave
  di localStorage se la scrive chiunque, quindi da sola non prova niente.
  **La decisione si prende al momento di entrare in un duello, non al
  caricamento della pagina**: `isAdmin()` può ancora rispondere "no" nei
  primissimi istanti (il profilo arriva dal database in asincrono), e
  decidere presto spegnerebbe l'autowin proprio a chi ha appena fatto
  accesso. Resta da rimuovere prima del rilascio insieme al resto.

- ✅ **In Duello Libero i Duellanti si guadagnano**
  (`js/data/character-unlocks.js`): si parte con Yugi Muto e Solomon
  Muto, gli altri si sbloccano battendoli in un Torneo o nella Storia.
  Lo sblocco si segna in `DuelSession.finish()`, l'unico punto da cui
  passa la fine di ogni duello — e le modalità che sbloccano sono un
  ELENCO, non "tutto tranne il Duello Libero", perché una modalità nuova
  non deve diventare una via di sblocco per distrazione. I due iniziali
  stanno nel codice e non nel salvataggio: sono una regola, non un
  progresso, e scriverli nel salvataggio lascerebbe un salvataggio più
  vecchio col Duello Libero vuoto. **Non blocca** chi si incontra nei
  Tornei e nella Storia — sarebbe una porta chiusa a chiave dall'interno.
  **Lezione di lingua**: le prime etichette erano "Vincilo" e "si sblocca
  sconfiggendolo", maschili singolari, ma nel roster ci sono Téa, Mai,
  Ishizu e una voce al PLURALE (i Fratelli Paradosso). Una frase senza
  concordanza ("si sblocca con una vittoria") è giusta per tutti e non
  chiede al dato dei personaggi un campo "genere" che non ha motivo di
  esistere.

- ✅ **Ologrammi più leggibili** (`js/ui/monster-hologram.css`): il
  soggetto resta nitido al centro e si dissolve verso i bordi, invece di
  essere slavato allo stesso modo dappertutto. **Il raggio di un
  `radial-gradient` è una frazione del RIQUADRO, non della sua metà**: col
  70% il gradiente finiva ben oltre il bordo, dove la maschera valeva
  ancora ~0.7 e si vedeva il rettangolo dell'illustrazione coi lati
  dritti. Perché il bordo arrivi a zero il raggio deve restare poco sopra
  il 50%.

- ✅ **Riscontri del duello (`js/ui/duel-feedback.js`/`.css`)**, richiesta
  dell'utente: ATK/DEF che cambiano (+500 / −1000 fluttuanti e lampo sul
  valore), carta bandita (varco viola), attivazione annullata (sigillo ⛔,
  sulla carta se è in campo, al centro altrimenti), cambio di Posizione
  (rotazione vera, `rotate` via Web Animations API), Token che nasce
  (fumo), Life Point critici ≤1000 (riquadro rosso, vignetta solo per i
  propri). **Il principio**: `DuelFeedback.sync()` gira in
  `ridisegnaDuello` dopo gli ologrammi e CONFRONTA la fotografia del
  Terreno con quella del ridisegno precedente, quindi copre qualunque
  carta causi il cambiamento senza agganci carta per carta. Solo
  l'annullamento non si vede dallo stato: evento `attivazione-negata`,
  emesso in `resolveChain` prima della pulizia della Continua. Livello
  `#duelFeedbackLayer` a z-index 10040 (sopra gli FX, sotto i modali).
  Nello stesso giro, **ologrammi**: non nascono più a metà giro di una
  carta che si scopre (`playFlipReveal` chiede un `sync`, che vede il giro
  in corso e aspetta che finisca) e in Difesa hanno le proporzioni giuste
  (misure dalla carta "in piedi"); moneta e dado senza `bounce.out`/
  `back.out`. Spec `riscontri-duello-e-ologrammi`.

- ✅ **Carte "vive" e parallasse del menu** (richiesta dell'utente,
  "grafiche simil 3D"). `CartaViva.rendi(el, card, { modo, bersaglio,
  area })` in `js/ui/card-renderer.js` (CSS "Carta viva" in fondo a
  `card.css`): la carta si inclina e la luce ci scorre sopra, con un
  riflesso che dice la RARITÀ (comune solo luce, rara bordo lucido,
  super/ultra arcobaleno sull'illustrazione, leggendaria/mitica oro,
  segreta/mitica grana di scintille). Modi: 'griglia' (Cartoteca, si
  solleva sotto il mouse), 'fila' (Negozio, buste), 'grande' (scheda carta,
  premio: segue anche il giroscopio, a riposo ondeggia). **Mai nel duello**,
  e nei modi griglia/fila l'inclinazione vale solo sotto il mouse: fuori,
  il transform resta della pagina (le animazioni delle buste muovono la
  carta). La fonte dell'inclinazione è UNA, `js/ui/inclinazione.js` (mouse
  + giroscopio con ricentratura lenta, spenta con "riduci movimento"); la
  usa anche la parallasse del menu in `index.html` (`--par-x/--par-y`,
  proprietà `translate` per sommarsi ai transform animati di raggi e
  scintille). Ogni pagina che carica il renderer deve caricare prima
  `inclinazione.js`: lo sorveglia `guardrail-pagine-con-carte`. **Insidie
  prese guardandolo**: nella Cartoteca le carte non possedute sono
  ingrigite da un filtro che copre anche i riflessi (per fotografarle
  togliere `card--not-owned`), e su una cornice dorata una fusione
  "screen" non si vede affatto — il bordo lucido è dipinto senza fusione.
  Spec `carte-vive-e-parallasse`.
  **Poi, su richiesta dell'utente**: la parallasse è un'impostazione
  ("Profondità del menu", `Inclinazione.parallasseMenuAttiva`/
  `impostaParallasseMenu`, setting `menuParallax`, accesa di default) in
  entrambe le copie delle Impostazioni (pagina e vista di `index.html`); e
  i **Dettagli video partono da "Alti"**. Siccome "Normali" era scritto in
  cache e nel salvataggio anche per chi non l'aveva mai scelto, vale solo
  se c'è il segno `videoDetailScelto` (`ygoVideoDetailScelto`), che solo
  `VideoQuality.set` accende: chi aveva scelto "Normali" prima del segno
  torna ad "Alti" una volta. L'harness dei test fissa "Normali" come
  scelta, perché la suite è nata con gli effetti ambientali spenti. Spec
  `impostazioni-default-alti-e-profondita-menu`.

- 🔴 **POSSO APPLICARE MIGRAZIONI SUPABASE DA SOLO, e più sopra in questo
  file c'è scritto il contrario.** La voce sull'accesso con approvazione
  admin dice «L'utente deve eseguire questo script nell'SQL Editor
  Supabase di persona (non posso farlo io: la sola chiave che ho, `anon`,
  non ha i permessi DDL)». Era vero allora, non lo è più: questa sessione
  ha un connettore Supabase fra gli strumenti, che vede il progetto
  **DuelArena** (`yuadnvnkdppgjkagpcwt`) e applica DDL. `server_now()` è
  stata creata così, e verificata subito interrogandola. **Prima di dire
  a chi legge "devi farlo tu a mano", controllare se il connettore c'è**
  — e comunque scrivere sempre anche in `supabase/schema.sql`, che resta
  la fonte di verità per ricostruire il progetto da zero. Il database
  però è quello VERO in produzione: una modifica additiva e reversibile
  (una funzione, una colonna con default) si può applicare dopo averlo
  detto; qualunque cosa distrugga dati si chiede prima.

- ✅ **L'ora del server per la rotazione: l'header `Date` NON È
  PRATICABILE da un browser, e ci sono voluti due giri per scoprirlo.**
  `js/cloud/server-date.js` nasceva leggendo l'header `Date` della
  risposta HTTP, e il commento se ne vantava: «NON serve alcuna funzione
  SQL né modifica allo schema». Non funzionava MAI: `Date` non è fra gli
  header che il CORS espone al JavaScript, e Supabase non manda un
  `Access-Control-Expose-Headers` che lo aggiunga. Misurato con una
  richiesta vera dal browser: degli header della risposta arrivano solo
  `content-length` e `content-type`, **anche su un 200**. L'utente l'ha
  segnalato vedendo l'avviso "non riesco a leggere la data dal server"
  fisso nel Negozio.
  Nella stessa misura è emerso un SECONDO difetto indipendente: la
  richiesta mandava solo l'header `apikey` e PostgREST rispondeva 401 —
  ne vuole due, `apikey` più `Authorization: Bearer`. Correggere solo
  quello non sarebbe bastato, ed è il motivo per cui conviene misurare
  *tutto* quello che torna (stato, header visibili, corpo) invece del
  solo sintomo: due difetti sovrapposti si scambiano facilmente per uno.
  Ora tre livelli, dal più preciso al più onesto: RPC
  `public.server_now()` (l'ora nel CORPO, dove il CORS non c'entra) →
  `iat` del JWT di sessione (non costa una richiesta, non si falsifica
  spostando l'orologio del telefono, ma può essere vecchia fino a un'ora)
  → orologio locale DICHIARATO (`isTrusted` falso, e il Negozio lo dice).
  `tests/specs/orologio-del-server.spec.js` prova i tre livelli con
  `fetch` sostituito, quindi senza rete e senza Supabase.

- ✅ **Il salvataggio arriva sul cloud MENTRE si gioca
  (`js/cloud/auto-sync.js`) — perdita reale segnalata dall'utente.** Il
  caricamento partiva SOLO da "Esci"/"Cambia account": chiunque chiuda il
  gioco in un altro modo (APK ucciso dal sistema, batteria, scheda
  chiusa) o non faccia mai logout lasciava ore di gioco nel solo
  localStorage. Ora si ascolta **`SaveManager.onSaved`**, un gancio
  generico nuovo in `js/save-manager.js`: `touch()` avvisa chi si è
  registrato, e il caricamento parte 15 secondi dopo (una partita scrive
  più volte di fila). Si forza subito su `visibilitychange → hidden` —
  su un telefono è l'istante in cui si passa a un'altra app, e la pagina
  è ancora viva — e su `pagehide` come seconda rete. Se la richiesta non
  riesce resta un segno in localStorage e si riprova al prossimo avvio.
  **Il gancio è deliberatamente generico**: `save-manager.js` non deve
  sapere che esiste una sincronizzazione, e chi sincronizza non deve
  rincorrere gli oltre cento punti che scrivono.
  **È l'UNICO caricamento automatico**: le carte personalizzate e la loro
  terminologia passano dalla stessa coda (`AutoSync.cartePersonalizzateCambiate`,
  segno a parte `ygoSyncCarteInSospeso`). Il vecchio `cloud-autosync.js`,
  che caricava salvataggio e carte con un timer suo, è stato eliminato:
  non reintrodurre un secondo meccanismo. Spec `sync-carte-personalizzate`.
  `auto-sync.js` si aggancia in modo INDIPENDENTE DALL'ORDINE dei tag
  `<script>` (riprova su `DOMContentLoaded`/`load`): sta in cima con gli
  altri di `js/cloud/`, mentre `save-manager.js` è molto più in basso, e
  la lista degli script è duplicata a mano in 19 pagine — un ordine
  "giusto" sarebbe una deriva che aspetta di succedere.

- ✅ **Fra due salvataggi vince il PIÙ RECENTE
  (`CloudSync.confrontaSalvataggi`), non più una domanda a scatola
  chiusa.** Il modale chiedeva quale tenere mostrando UNA data sola,
  quella del cloud: chi la leggeva non poteva sapere se il locale fosse
  più nuovo, e un click dato per chiudere la finestra cancellava la
  giornata appena giocata, senza ritorno. Era la metà più cattiva del
  problema. Ora decide la data; si chiede solo quando i due sono a meno
  di 5 minuti (gli orologi di due dispositivi non sono allineati fra
  loro, quindi sotto quella soglia non c'è un "più recente" affidabile) o
  quando una delle due date non si legge — un'informazione mancante non è
  un pareggio. E il modale, quando compare, mostra ENTRAMBE le date.
  La regola vive in UN punto solo perché la usano sia il gate di
  `index.html` sia `profilo.html`, cioè due copie che sono già andate
  alla deriva in passato.

- ✅ **Azzeramento delle storie per TUTTI i giocatori** (2026-10-09,
  richiesta dell'utente, premi finali compresi): `AZZERAMENTO_STORIE` in
  `js/save-manager.js`. Ogni salvataggio senza il segno `storieAzzerate`
  uguale a quel valore svuota `save.story` (avanzamento, livelli,
  premio finale) leggendolo — in `load()` e in `applyExternalSave`, quindi
  anche la copia del cloud e un backup importato. Resta tutto il resto,
  compreso il registro di `card-acquisition.js`. La data NON si sposta
  (writeRaw), e la copia azzerata va sul cloud tramite `onSaved` senza
  toccare la data. **Fatto nel codice e non sul database apposta**: un
  azzeramento solo sul cloud verrebbe ricoperto dal primo dispositivo con
  la copia vecchia. Per un altro azzeramento basta cambiare la costante.
  Insieme: `auto-sync.js` tiene da parte un salvataggio arrivato prima di
  sapere chi è l'utente (`richiestaPrimaDellUtente`). Spec
  `azzeramento-storie-per-tutti`.

- ✅ **Reset del profilo (`CloudSync.resetAccount`)**: azzera il
  progresso QUI e SUL CLOUD ma **non** cancella l'account, che resta
  approvato — differenza netta da `deleteAccount()`, che invece fa
  sparire anche l'approvazione dell'amministratore e costringerebbe a
  richiederla. Ordine deliberato: prima il cloud, poi il locale, poi la
  sessione — l'ordine opposto lascerebbe un dispositivo vuoto davanti a
  un cloud pieno, che al primo rientro si riscaricherebbe da sé (un reset
  che non resetta). Cancella anche carte custom e terminologia
  personalizzata, che NON stanno dentro il salvataggio. A fine reset si
  ricarica `index.html`: la sessione è già chiusa, quindi il gate riparte
  da zero e la richiesta del nome arriva dal percorso normale, senza una
  seconda copia di quella logica. La conferma è "scrivi **azzera**" —
  parola DIVERSA da "elimina" dell'eliminazione account, che sta a due
  centimetri di distanza e fa una cosa molto diversa.
  **Vale anche sugli altri dispositivi** (`leggiCloud`/"Generazione del
  profilo" in cloud-sync.js): la riga del cloud non si cancella ma diventa
  un segno `{ azzeratoIl }`. Ogni lettura del cloud passa da `leggiCloud`,
  che toglie i dati di un dispositivo nati in una generazione precedente
  PRIMA di qualunque confronto per data (un telefono offline che gioca col
  profilo vecchio ha una data più recente, ma va tolto lo stesso). Il
  salvataggio nuovo eredita la generazione dal registro del dispositivo
  (`ygoGenerazioneProfilo`, per utente) e la porta sul cloud. `deleteSave`
  toglie anche il backup nativo dell'APK, che altrimenti index.html
  ripristinerebbe. Spec `azzeramento-profilo-tra-dispositivi`.

- ✅ **L'amministratore ha 999999 di ogni valuta**, calcolate al momento
  della LETTURA in `SaveManager.getCurrency()` e mai scritte nel
  salvataggio — stesso principio degli sblocchi dei Duellanti. Se quel
  conto smette di essere amministratore si ritrova quello che ha davvero
  guadagnato, invece di un milione di crediti rimasti lì.

- 🔴 **`Get-Content -Raw` IN POWERSHELL 5.1 DECODIFICA IN ANSI, E
  RISCRIVERE IN UTF-8 DISTRUGGE OGNI ACCENTO.** Già documentato in questo
  file per `Set-Content -Encoding utf8` (che aggiunge un BOM), ma la
  LETTURA è una trappola distinta e l'ho presa lo stesso: uno script che
  faceva `Get-Content -Raw` + `File::WriteAllText(..., UTF8)` ha corrotto
  6 file (`index.html` compreso, con dentro lavoro non committato). I
  byte UTF-8 vengono letti come Windows-1252 e riscritti in UTF-8: "è"
  diventa "Ã¨". **Per modificare un file di questo progetto da script
  usare gli strumenti di modifica, non PowerShell.** Se serve per forza
  uno script, leggere con `[System.IO.File]::ReadAllText($p,
  [System.Text.Encoding]::UTF8)`, mai `Get-Content`.
  **La corruzione è però REVERSIBILE e non serve buttare via il lavoro**:
  decodificare il file in UTF-8, ricodificare la stringa in Windows-1252,
  e quei byte sono l'UTF-8 originale. Vale la pena farlo con una verifica
  inversa (ri-applicare la corruzione e controllare di riottenere il file
  attuale) e saltare i file dove non torna. Per accorgersene in fretta:
  cercare `Ã.` o `â€` nei sorgenti.

- ✅ **I mazzi dei Duellanti sono TRE LISTE SCRITTE PER ESTESO per
  personaggio (easy/medium/hard in `js/data/character-decks.js`), non più
  un mazzo base trasformato al volo.** Tutto ciò che più sopra descrive
  `applyNormalTierDowngrade`/`applyEasyTierDowngrade`/`applyExactlyOneGodCard`,
  i "mazzi a due velocità" e il pool di filler morbidi è SUPERATO: quelle
  funzioni non esistono più. Le trasformazioni automatiche rispettavano le
  regole scritte ma producevano mazzi che l'utente ha respinto (Facile di
  Kaiba con tre Armature Sakuretsu, pieno di mostri da Tributo, senza carte
  difensive; Joey con il Guerriero Celtico di Yugi; i cannoni X/Y/Z
  attribuiti a Bandit Keith invece che a Kaiba). Ora:
  - ogni mazzo segue il mazzo vero del personaggio nell'anime/gioco
    (ricerca online, commento sopra ciascuno), e i Maghi di Forbidden
    Memories seguono il TERRENO del loro santuario (Anubisius = Foresta
    con la Grande Falena, Kepura = Prateria con il Guardiano del Cancello…);
  - le regole dei livelli sono dichiarate nel file stesso
    (`REGOLE_PER_LIVELLO`, `CARTE_CHE_DISTRUGGONO_MOSTRI`, `CARTE_DIFENSIVE`,
    `validaMazzoPersonaggio`) e `tests/specs/mazzi-livello-facile.spec.js`
    le fa girare su ogni mazzo: Facile = max 1 carta che distrugge mostri,
    niente Forza dello Specchio/Cilindro, niente ATK 1800/1900, max 4 mostri
    di Livello 5+, deboli (≤1300 ATK) in prevalenza, Spada Rivelatrice e
    almeno 4 carte difensive; Normale = max 3 distruttive, niente Forza
    dello Specchio, Spada Rivelatrice o Nega Attacco; Difficile = canone a
    piena potenza, Dei Egizi (una copia) solo lì per Kaiba/Yami/Marik;
  - i sei mazzi della **Grande Guerra sono congelati** (`congelato: true`)
    per richiesta esplicita dell'utente ("quelli della ww1 NON TOCCARLI"):
    identici, livello per livello, a quelli di prima, e fuori dalle regole.
  Un Duellante nuovo va scritto con le sue tre liste e deve passare il test.

- ✅ **Storia anime a sei aree: prologo a Domino City + mappa a sei
  isole, e il progresso dei vecchi salvataggi si porta dietro da solo.**
  L'avanzamento della Storia si salva per POSIZIONE, quindi staccare le
  prime 5 tappe del Regno in un'area nuova in testa avrebbe spostato
  tutti. Meccanismo generico: la campagna dichiara `separazioni: [{ id,
  nuova, da, quante }]`, `StoryProgress.getProgress` riporta in pari
  (funzione pura, `applicaSeparazioni`) ogni salvataggio che non porta
  quell'`id`, e `setProgress` timbra SEMPRE tutti gli id conosciuti.
  **Uno stato scritto a mano in un test senza il timbro viene letto come
  vecchio e migrato**: i test che scrivono `setStoryState('anime', …)`
  devono includere il timbro, letto dal catalogo
  (`storyCampaignsDatabase.find(...).separazioni.map((s) => s.id)`), mai
  scritto a mano. Tre forme (`dalla`): 'testa' (default; tappe staccate
  dalla testa di un'area in una nuova area PRIMA di lei), 'unione'
  (un'area ricucita in coda a quella che la precede) e 'inserite' (tappe
  nuove nate dentro un'area, prima di una che c'era già). Una voce può
  valere solo per i salvataggi con (`soloSeTimbrato`) o senza
  (`saltaSeTimbrato`) un certo timbro — è così che si riconosce la forma
  passata del catalogo. `saltaPercorsiGiaFiniti` fa superare un'area
  corrente già piena (rete di sicurezza per migrazioni sovrapposte); per
  questo chi chiude un'area passa il tabellone pieno ad
  `avanza(…, { sotto })` nella STESSA scrittura — scriverlo prima
  farebbe avanzare la campagna di due passi.
- ✅ **Più mappe dentro un'area (`mappeSuccessive`, js/story/story-progress.js)**:
  il Regno dei Duellanti è l'isola e poi, battuto Kaiba al cancello, gli
  interni del castello — richiesta esplicita dell'utente, dopo un primo
  giro in cui il castello era un'area a sé sulla mappa grande (scartato:
  "vorrei che fosse come seconda mappa dentro la macroarea"). Resta UN
  percorso (un elenco di tappe, un contatore): una mappa successiva si
  dichiara con la tappa da cui comincia (`daTappa`) più i due capi del
  passaggio (`uscita` sulla mappa prima, `ingresso` su questa), così
  avanzamento, Sfide e migrazioni non sanno nemmeno che esistono.
  `storia.html` mostra la mappa della prova da giocare (o quella scelta,
  `&pagina=` nell'URL), disegna i passaggi come nodi in testa/coda al
  sentiero (classe `nm-node--passaggio`, anello tratteggiato), e al
  primo arrivo su una mappa nuova fa il cartello a tutto schermo col suo
  disegno. L'Editor Mappa ha un pulsante per mappa e mostra solo le
  tappe di quella scelta. L'id di migrazione 'castello-pegasus' è
  RISERVATO: è il timbro della forma di un giorno col castello come area.
- ✅ **Quattro difetti segnalati dall'utente, chiusi insieme (beta.62)**:
  - **Mappe della Storia "troppo corte" su un monitor 2K**: `NodeMap.render`
    allargava il mondo fino alla finestra (`Math.max`, nato prima dello
    zoom), il disegno lo seguiva ma i nodi no — sentiero schiacciato in
    alto a sinistra. Ora il mondo è grande quanto il disegno e lo zoom di
    copertura riempie la finestra. **Su telefono non si vedeva mai,
    perché lì la finestra è più piccola del disegno**: una mappa va
    guardata anche su uno schermo PIÙ GRANDE del suo mondo.
  - **Rileggere una scena dentro un'area la superava di nuovo**
    (`apriProva` passava sempre `rilettura: false`): rileggendo
    "Il cancello si apre" due volte si saltavano Mai e Pegasus e il Regno
    risultava vinto, rimandando alla mappa grande. Misurato, non dedotto.
  - Scene di un'area sul disegno della LORO mappa, non su quella grande.
  - Ologrammi su desktop 1.6×1.35 con la base nella metà bassa della
    carta; fascia sfumata dietro "Continua" accesa solo con `do-has-more`.
  Nello stesso giro: le Sfide `storyProgress` contano le tappe DENTRO le
  aree (un torneo resta una tappa sola) — prima l'anime ne contava solo i
  5 nodi e "Completa il Regno delle Ombre" (26) era irraggiungibile, come
  "Completa Memorie Proibite" (41 su 40). `catalogo-sfide.spec.js` ora
  confronta ogni `target` con le tappe vere della campagna.

- ✅ **La Storia a tre livelli (Facile / Normale / Difficile), beta.63** —
  richiesta esplicita dell'utente: all'inizio solo Facile, finita la
  storia si aprono Normale e Difficile; la Grande Guerra no
  (`senzaLivelli: true` sulla campagna). Tutto in `LIVELLI` di
  `js/story/story-progress.js`: ogni livello ha il SUO avanzamento
  (Facile = chiave storica `story[<id>]`, che è anche quella letta dal
  Negozio; gli altri `story[<id>@normale|@difficile]`), la scelta e lo
  sblocco vivono in `story[<id>@livello]` (`{ livello, sbloccati }`).
  `getProgress`/`setProgress` leggono/scrivono SEMPRE il livello attivo,
  quindi il resto del file non sa che i livelli esistono. La difficoltà
  di ogni duello è quella del livello (Facile/Medio/Difficile, cioè i
  mazzi easy/medium/hard di ogni Duellante); il `difficulty` delle tappe
  vale solo per le campagne senza livelli. **Lo sblocco è permanente**
  (`sbloccati`, scritto da `avanza` quando Facile finisce): leggere solo
  "Facile è finita" faceva richiudere Normale/Difficile a un "Ricomincia"
  a Facile — trovato dallo script di verifica, verificato al contrario.
  Le Sfide `storyProgress` si contano solo a Facile; il premio finale si
  paga una volta per livello, ×1 / ×1,5 / ×2, con la regola scritta nella
  spiegazione. `StoryProgress.forzaAvanzamento` è l'unico modo corretto
  per spostare a mano l'avanzamento (strumenti di prova): scrivere con
  `SaveManager.setStoryState` salta timbro e livello.
  Nello stesso giro, **l'arco del Mondo dei Ricordi è stato completato**
  (segnalato dall'utente: "manca la battaglia Yugi-Bakura"): Re dei
  Ladri, sacrificio di Mahad, Gioco delle Ombre contro Bakura/Zorc prima
  dell'ultima porta; il Duello Cerimoniale lo gioca Yugi Muto grazie al
  nuovo `protagonista` sulla singola prova (letto da `resolvePlayer` in
  duel-session.js, che ora scende anche dentro le AREE, non solo nei
  tornei). Spec: `storia-livelli.spec.js`.

- ✅ **Logo nuovo e splash d'apertura rifatto (beta.64)** — richiesta
  dell'utente ("animazione di loading più figa e dinamica, revamp del
  logo, che poi sarà anche nel menu"). Il logo è UN componente,
  `<game-logo variante="splash|menu">` (`js/ui/game-logo.js`/`.css`):
  emblema SVG (Puzzle del Millennio con l'Occhio di Wedjat, due anelli
  che ruotano) + scritta in un serif di SISTEMA (niente font scaricati:
  il gioco gira offline, su file:// e nell'APK). Prima erano tre copie
  scritte a mano in index.html (splash, accesso, menu). Tre insidie
  prese costruendolo, da non ripetere: **ogni istanza ha i suoi id di
  gradiente** (lo splash finisce a display:none, e un gradiente dentro
  un SVG non visualizzato non si dipinge — il logo del menu sarebbe
  rimasto senza oro); **un transform CSS su un elemento SVG sostituisce
  il suo attributo `transform`** (il riflesso che attraversa la
  piramide si anima sul gruppo, l'inclinazione resta sul rettangolo);
  **`animation-fill-mode: both` mostra il primo fotogramma PRIMA della
  partenza** (l'onda di luce si vedeva ferma al centro per un secondo —
  per un elemento che deve essere invisibile fino al suo momento si usa
  `forwards`). Lo splash dura ora almeno 2,4 s (il tempo della sequenza),
  e "DUEL ARENA" ha un tetto in `vw` oltre che in `vh`, perché su un
  telefono in verticale sbordava di 3px (misurato).

- ⚠️ **SUPERATO (1.4.47): le viste fuse non esistono più**, la lezione
  resta valida in forma diversa: la logica di una schermata sta in un
  componente (`js/ui/*-view.js`) montato dalla sua pagina dedicata.
- ✅ **Due viste fuse in `index.html` erano rimaste indietro rispetto
  alla loro pagina standalone, e l'utente vedeva quelle** (il menu apre
  la vista fusa, non la pagina `.html`). Sfide: `sfide.html` aveva le
  quattro sezioni e le missioni, `#view-sfide` era ancora la versione di
  prima. Profilo: `profilo.html` riconciliava già il salvataggio in
  silenzio (`confrontaSalvataggi`), `#view-profilo` apriva ancora il
  modale "Salvataggio cloud trovato" ad ogni ingresso — e l'accesso l'ha
  già fatto il gate di `index.html`, quindi il controllo lì era solo
  ripetuto (tolto). **Rimedio per le Sfide**: la schermata è un
  componente (`js/ui/sfide-view.js`/`.css`, `SfideView.mount(el)` →
  `{ refresh }`, elementi trovati per `data-sv` dentro la radice, nessun
  id), montato da entrambe; le due pagine tengono solo sfondo e topbar.
  Stesso schema del Negozio (`ShopUI.mount`). **Per le prossime viste
  fuse**: prima di aggiungere una funzione a una pagina standalone,
  controllare se ne esiste una copia in `index.html` — se sì, estrarre
  un componente invece di aggiornare due copie.
  `sfide-sezioni-e-missioni.spec.js` ora apre anche la vista del menu,
  verificato al contrario.

- ✅ **Topbar rinnovata (beta.66)** nello stile del logo: medaglione
  d'oro per l'Indietro (freccia SVG, non più il glifo "‹"), icona della
  pagina in un rombo, titolo in serif, sottotitolo SOTTO il titolo,
  filo d'oro con rombo centrale, ombra più profonda a pagina scorsa
  (`.is-scrolled`). **Bug vecchio chiuso insieme**: l'icona stava DENTRO
  `.topbar-title`, testo in gradiente con `color: transparent`, quindi
  l'SVG (che usa currentColor) era invisibile su ogni pagina. **Vincolo
  rispettato e da rispettare**: l'altezza della barra non cambia
  (72/66/52px misurati prima e dopo), perché Regole e Creazione Deck
  hanno una seconda barra sticky con `top:` in pixel. Il ritratto va
  sempre per ultimo (`order`), così un distintivo aggiunto dalla pagina
  non lo spinge più al centro.
- ✅ **Il `?field=` della Storia non arrivava MAI nel duello (beta.67)**:
  il catalogo scrive il percorso completo (`images/fields/mobile/x.jpg`,
  che le scene usano così come sfondo) e `duelMonstersCore.html` ci
  anteponeva di nuovo la cartella — immagine inesistente, campo di
  default, su ogni tappa con un campo suo. Ora il duello tiene solo il
  nome del file. `campo-della-storia.spec.js` controlla anche che ogni
  campo del catalogo esista in `images/fields/` e `images/fields/mobile/`.
- ✅ **Profilo: statistiche al posto del "Record Duello Libero"**, come
  componente condiviso (`js/ui/profile-stats.js`/`.css`) montato dalla
  vista del menu e da `profilo.html` — mai più due copie da tenere
  allineate. Nella vista del menu il componente arriva con
  `ensureViewScripts`, come le Sfide.
- ✅ **Menu della Storia rinnovato** (`renderCampagne` in `storia.html`):
  schede con la mappa della campagna come testata (i candidati di
  `sfondo` impilati come livelli CSS, quindi un file mancante lascia
  vedere il successivo), emblema, ritratto del protagonista, barra,
  livelli e invito Inizia/Continua/Rivivila.
- ✅ **`storia.html` non caricava il tracker delle Sfide (beta.68)**: la
  Storia avanza su quella pagina, quindi `ChallengeTracker.recordProgress`
  non trovava nessuno e nessuna Sfida delle storie poteva avanzare. Ora
  carica catalogo, missioni, ora del server, tracker e banner.
  **Lezione**: un aggancio `if (window.X) X.record(...)` fallisce in
  silenzio sulla pagina che non carica X — quando si aggiunge un aggancio
  del genere, controllare su QUALE pagina gira davvero il codice.
  Nuovi tipi di Sfida `storyCompleted` { campaignId, livello } e
  `storyAllLevels` { campaignId } (segnaStoriaCompletataPerLeSfide).
- ✅ **Audit di tutte le 51 Carte Equipaggiamento sul percorso vero**
  (mano -> `activateCard` -> Catena -> aggancio, un duello nuovo per carta,
  più i 4 Union dalla zona Mostri): aggancio, linea di collegamento,
  bonus ATK/DEF e destino dopo la rimozione del mostro. Un guasto vero:
  `canActivate` di una Magia con costo "scarta 1 carta" contava la Magia
  stessa, ancora in mano (727/492/729) — nuovo helper condiviso
  `otherHandCards(ctx)`, usarlo per ogni costo di scarto futuro.
  **Insidia dell'audit**: provare più carte sulla stessa partita,
  azzerando `gameState` a metà di una risoluzione di Catena, fa sembrare
  rotte carte sane (l'aggancio arriva dopo ~2,4 s): un duello nuovo per
  carta, o aspettare la Catena vuota.
- ✅ **Grande Guerra: il protagonista è il comandante del momento
  (beta.69)** — `WW1_COMANDANTI` in cima a `js/data/story-campaigns.js`:
  Cadorna (campagna e capitoli 1-4), Diaz (capitoli Piave e Vittorio
  Veneto, più la scena `ww1-4-ritirata` del passaggio di comando).
  NON sono nel roster dei Duellanti, apposta. Il protagonista si può ora
  dichiarare anche sulla singola TAPPA (`getTappe`, stessa precedenza di
  `duel-session.js`: tappa > capitolo > campagna), e la scheda della
  campagna nel menu mostra quello del punto a cui si è arrivati.
  Ritratti `ww1_cadorna.jpg`/`ww1_diaz.jpg` erano segnaposto, poi
  sostituiti con due fotografie storiche vere di pubblico dominio
  (Wikimedia Commons, vedi il bullet più sotto). `ww1_regio_esercito.jpg`
  non è più usato dalla campagna.
- ✅ **SUPERATO (2026-10-09): l'Editor Mappa salva TUTTO in un file suo,
  `js/data/story-ritocchi.js`**, e non tocca più il catalogo — la voce qui
  sotto (patch di field/music dentro story-campaigns.js) descrive la
  versione precedente, rimossa. Il file dei ritocchi è generato e riscritto
  per intero a ogni modifica ("📂 Collega file", che controlla che il file
  scelto sia davvero quello): `modifiche` per id (proprietà semplici,
  elenco `PROPRIETA`, `null` toglie), `aggiunte` (contenitore + `dopo`) e
  `rimosse`. Li applica `js/story/story-ritocchi.js`, caricato subito dopo
  catalogo e dati in OGNI pagina che carica il catalogo (guardrail
  `guardrail-ritocchi-storia`); tiene anche una copia del catalogo
  originale, da cui l'editor calcola le differenze (`StoryRitocchi.attuali`).
  Il pannello è stato rifatto su richiesta dell'utente: personaggio da una
  griglia di ritratti, musica da un elenco con anteprima, dialoghi a
  battute con una voce per battuta (anche il `dialogo` prima di un duello).
  Restano fuori, a mano nel catalogo: struttura (mappe, livelli,
  separazioni). I `tools/` di simulazione caricano il catalogo da soli e
  NON vedono i ritocchi. Spec `editor-mappa-scrive-sul-file`.
- ✅ **L'Editor Mappa scrive ANCHE sul file vero, solo per `field`/`music`
  (beta.70, richiesta esplicita dell'utente: "davvero non posso
  riflettere direttamente i valori sul file story-campaigns?")** — prima
  pensavo a un'interfaccia di scelta "in-game" per il giocatore, ma
  l'utente ha chiarito che intendeva la cosa più semplice: il pannello
  dell'Editor Mappa (uso admin, non un giocatore) che scrive DAVVERO
  dentro `js/data/story-campaigns.js` invece del solo giro "Esporta
  codice -> copia -> incolla nell'IDE".
  - **"📂 Collega file"** (`js/dev/story-map-editor.js`) chiede, una volta
    a sessione, l'accesso in scrittura tramite la File System Access API
    del browser (Chrome/Edge — **funziona anche su `file://`**,
    verificato: `isSecureContext` vale `true` lì). Da lì in poi, salvare
    il pannello di un nodo `duel`/`scene` patcha ANCHE il testo del file
    su disco, oltre alla copia in memoria di sempre.
  - **Scope deliberatamente ristretto a `field`/`music`**, non
    generalizzato a `label`/`x`/`y`/`testo`/`dialogo`/creazione/
    cancellazione di un nodo intero: sono le UNICHE due proprietà che, in
    tutto il dataset, stanno sempre da sole sulla propria riga
    (verificato con un grep mirato) — tutte le altre condividono spesso
    la riga con altre proprietà ("label: '...', x: 123, y: 456,") o sono
    array/oggetti multi-riga (`dialogo`, `testo` di una scena), dove una
    sostituzione a colpi di regex rischierebbe di corrompere il file o
    mangiare un commento. Per tutto il resto resta solo "Esporta codice".
  - **`patchCampoEMusicaNelTesto(testoFile, id, valori)`**: funzione PURA
    testo-a-testo (nessun file, nessun DOM) — trova l'oggetto della tappa
    bilanciando le graffe a partire dal suo `id: '...'`, poi tocca SOLO
    la riga di `field`/`music` se c'è. Esposta come
    `window.StoryMapEditor._patchCampoEMusicaNelTesto` apposta per essere
    testata da sola, dandole in pasto il VERO contenuto del file.
  - **Bug reale preso scrivendo il test, non a occhio**: quando la `{` di
    apertura sta da sola sulla propria riga (es. id 'anime-1-nonno': `{`
    poi `id:` sulla riga SUCCESSIVA — a differenza della forma più comune
    `{ id: '...', kind: '...', ...`), il primo tentativo di "trova la
    prima riga dell'oggetto" si fermava alla sola graffa e ci incollava
    la virgola subito dopo (`{,`), file non più valido. Corretto cercando
    la riga che contiene DAVVERO `id:` (non la prima riga in assoluto), e
    copiando l'indentazione dalla riga SUCCESSIVA (una proprietà sorella,
    sempre presente) invece che da quella di apertura, che a volte non ha
    un'indentazione propria da copiare. **Lezione**: un "trova la prima
    riga dell'oggetto" per un file scritto a mano non può assumere una
    forma sola — questo dataset ne ha (almeno) due, ed è il tipo di
    varietà che un audit "sembra funzionare sull'esempio che ho sotto
    mano" non prende.
  - **Verificato contro il VERO `story-campaigns.js`** (non un frammento
    di prova): aggiunta, sostituzione e cancellazione su id reali,
    confrontando OGNI ALTRA tappa del file con un confronto profondo
    prima/dopo (non solo "il file si carica ancora") — zero differenze
    fuori dalla tappa toccata. Il giro completo (picker -> Salva ->
    scrittura) non è pilotabile in un browser headless (il picker è un
    dialogo del sistema operativo): si finge un file collegato con
    `_collegaFileFinto(handle)`, un handle che legge/scrive un buffer in
    memoria invece del disco, esercitando il VERO pulsante "💾 Salva".
    Entrambi verificati al contrario (il bug della graffa isolata
    davvero preso; senza la feature il test fallisce onestamente).
  - **Bug di TEST scoperto scrivendo la prova end-to-end, non del
    motore**: `CloudSync.isAdmin` mockato con un semplice
    `page.evaluate()` dopo un `page.goto` arriva sempre troppo tardi
    rispetto al PRIMO render della mappa (sincrono, durante il
    caricamento) — un `Object.defineProperty` su `window.CloudSync` con
    un setter che patcha `.isAdmin` nel momento stesso in cui
    `cloud-sync.js` (lo script vero della pagina) gli assegna la sua
    implementazione risolve la corsa, riapplicandosi da sé ad ogni
    navigazione (`page.addInitScript`). **Confermato che NON è un bug del
    motore vero**: `CloudSync.isAdmin()` (`js/cloud/cloud-sync.js`) ha
    già un ripiego sincrono (`wasAdminOffline`) per un amministratore già
    riconosciuto su quel dispositivo, per la stessa ragione già
    documentata altrove in questo file (la Cartoteca a 0 copie prima che
    il profilo arrivasse) — un amministratore vero non incontra mai
    questa corsa, solo un test che lo mocka dopo il fatto.
- ✅ **Ritratti storici veri per Cadorna e Diaz (beta.71)**: due
  fotografie di pubblico dominio da Wikimedia Commons ("Luigi Cadorna
  02.jpg", 1917; "Armando Diaz 01.jpg" di Mario Nunes Vais, ante 1929),
  scaricate e ritagliate a quadrato 512×512 sullo stesso taglio
  busto/spalle degli altri ritratti del roster — sostituiscono i
  monogrammi segnaposto della sessione precedente, stesso nome di file.
- ✅ **Ritratti veri per Noah Kaiba, Gozaburo Kaiba e i Big Five
  (beta.72)**: 7 personaggi (`js/data/characters-db.js`) che finora
  ricadevano sul sigillo dorato di ripiego (nessuna immagine esisteva
  ancora a quei nomi di file, come il commento lì spiegava) ora hanno un
  vero ritratto — Noah Kaiba, Gozaburo Kaiba, Gansley, Johnson, Nesbitt,
  Crump, Lector. Immagini fornite dall'utente (`C:\Users\dange\Desktop
  \immagini gioco\avatar`), già quadrate 1254×1254 nello stesso taglio
  busto/spalle del resto del roster — solo ridimensionate a 512×512 JPG
  qualità 90, nessun ritaglio necessario. **Attenzione al nome file**:
  il file sorgente si chiamava `nezbitt.png`, ma l'id/filename reale
  usato dal gioco per questo personaggio è `nesbitt` (una sola "z" in
  meno) — salvato come `nesbitt.jpg`, non `nezbitt.jpg`, o l'immagine
  sarebbe rimasta silenziosamente inutilizzata. Rimosso il commento
  ormai obsoleto in `characters-db.js` che dichiarava l'assenza dei
  ritratti dei Big Five.
- **Nuovo campo "Industria KaibaCorp" (beta.73)**: immagine fornita
  dall'utente, già alla stessa risoluzione (1670×942) delle altre arene
  del catalogo — copiata tale e quale in `images/fields/` (JPG qualità
  90) e ricompressa in `images/fields/mobile/` (qualità 78), stessa
  convenzione desktop/mobile di ogni altro campo. Aggiunta una riga sola
  a `FIELDS` in `js/data/arena-options.js`: comparirà da sola in ogni
  menu di scelta arena (Duello Libero, Sala d'Attesa Multiplayer,
  Editor Mappa), nessun altro file da toccare.
- ✅ **Un nodo della Storia eredita campo/musica dal CAPITOLO, non solo
  dall'intera campagna (beta.74)**, richiesta esplicita dell'utente.
  Prima della catena c'erano solo due livelli: la singola tappa
  (`field`/`music`) e l'intera campagna (`campoDuello`/`musicaDuello`,
  quest'ultimo può essere un elenco scelto per id) — lo stesso schema già
  esistente per `protagonista` (tappa vince su capitolo vince su
  campagna) non copriva ancora `field`/`music`. **Il capitolo usava già
  la chiave `music` in almeno un punto del catalogo** (il capitolo
  "prologo" della campagna 'anime', `js/data/story-campaigns.js`) — dato
  scritto in previsione di questa funzione ma mai letto da nessuno,
  finché non l'ho collegato: prova che l'autore l'aveva già pensata,
  solo non ancora cablata. Risolto in un punto solo,
  `StoryProgress.getTappe`/`getProveConStato` (`js/story/story-progress.js`),
  esattamente dove `protagonista` viene già risolto — mai da ricalcolare
  nei chiamanti (`urlDuello` resta invariato: continua a leggere
  `tappa.field`/`tappa.music`, che arrivano qui già risolti). Le PROVE
  annidate dentro un'area/torneo (`getProveConStato`) ereditano dal loro
  CONTENITORE (l'area stessa, che a sua volta ha già ereditato dal
  capitolo) — così un'intera area/macromappa (un capitolo per area nella
  campagna 'anime', vedi il commento su `capitoli`) eredita la musica
  scrivendola UNA volta sul capitolo, senza ripeterla su ciascuno dei
  suoi nodi. Verificato sia con dati REALI del catalogo (l'area del
  prologo/il duello col nonno che tiene la propria musica/la scena senza
  musica propria che eredita) sia con una campagna sintetica minima
  aggiunta e rimossa dentro lo stesso test, per coprire l'intera catena
  tappa→capitolo→campagna nei due sensi (eredita quando manca, vince
  quando c'è) — `tests/specs/eredita-campo-musica-capitolo.spec.js`,
  verificato al contrario (fallisce senza la modifica). Nessuna
  regressione sugli spec esistenti che toccano lo stesso file (Sfide,
  livelli, aree/tornei, Grande Guerra, Editor Mappa, scene cinematiche).
- **Prezzi dei mazzi alzati** (`PREZZI_MAZZI`/`EXTRA_INIZIALI` in
  `js/economy/shop-catalog.js`): il primo Starter resta a 18 Stelle
  perché è legato al premio del Regno dei Duellanti in `rewards.js`.

- ✅ **Meccanismi generici per i missingEffectNote (due giri, 14 carte
  chiuse).** Ognuno nato per una carta ma pensato per la prossima con lo
  stesso bisogno — **usarli invece di riscriverli**:
  - `def.uniqueFaceUp` → `DuelEngine.isFaceUpDuplicateBlocked` ("puoi
    controllarne solo 1 scoperto", id 899): Evocazione di giocatore e bot,
    Special Summon.
  - `DuelEngine.normalSummonBlockReason(owner, card)`: punto UNICO dei
    divieti di Evocazione Normale, letto da `attemptMonsterSummon` e da
    `AI_SHARED.canNormalSummonNow`. Copre `def.cannotNormalSummon` (fisso)
    e il nuovo `def.canNormalSummon(ctx)` (condizionato, id 1040).
    **Bug reale chiuso insieme**: `cannotNormalSummon` era controllato SOLO
    nel popover della Special Summon dalla mano — con un click o un
    trascinamento su una casella libera (e per il bot) Metalzoa, Drago Nero
    Metallico & co. si Evocavano lo stesso.
  - `def.canDeclareAttack(ctx)`: condizione per dichiarare un attacco
    (id 1040), in `resolveAttack` e in `botPerformAttacks`.
  - `gameState.mustBeAttackedUidsFor` + `DuelEngine.forcedAttackTargetIndexes`:
    bersaglio OBBLIGATO per gli attacchi avversari (Anello Magnetico id
    420), il contrario di `mustAttackTargetUidsFor` (id 199).
  - `def.negatesEffectsOfBattleVictims` (true o funzione): "annulla gli
    effetti dei mostri distrutti in battaglia da questa carta" (id 1043,
    1114), dentro `fireOnDestroy` — quindi vale anche quando la carta
    DIFENDE, a differenza di `onDestroysMonsterInBattle` (solo attacco
    vinto).
  - `def.onOwnFieldGainsMonster`: un mostro arriva sul tuo Terreno per un
    CAMBIO DI CONTROLLO (id 1121), in `fireControlChangedTrigger`.
  - `chooseUpToNFromList` (card-effects.js): "fino a N carte" / "un numero
    qualsiasi, nell'ordine che preferisci", una alla volta col pulsante
    Chiudi per finire (id 523, 1113).
  - Già esistente e riusato, da ricordare: `gameState.battleDestroyedThisTurnFor`
    (id 1063, 901) per "distrutto in battaglia in questo turno".
  - **Terzo giro (le 17 della famiglia A)**:
    `card.destroyWhenDestroyedUid` (sorte legata, ramo ON_DESTROY: id 154);
    `card.battleDestroyedDamageToOpponent` (per-istanza, per i Token:
    id 1030); `gameState.graveyardBanishBlockedFor` + terzo argomento
    `actor` di `banishFromGraveyard` (divieto per ATTORE: id 1080);
    `fusionSummon(..., { banishMaterials })` e `def.activateAsTurnPlayer`
    (Magia Terreno usabile da chi è di turno, anche l'avversario: id 887);
    `def.attacksEachEnemyOnce` + `getExtraAttackCount` (id 1001) — e il
    bot ora USA gli attacchi extra (prima ogni suo mostro attaccava una
    volta sola); `gameState.extraBattlePhase` +
    `canConductSecondBattlePhase`/`startSecondBattlePhase` (seconda Battle
    Phase: id 1035); `openSummonResponseWindows` + `def.onOwnSummonResponse`
    (risposta alla PROPRIA Evocazione: id 146); `def.canReactToTargetDeclare`
    (quando reagisce al checkpoint di targeting, separato da canActivate:
    id 423) e `destroyTargetingSpellIfItStays` (id 423, 888);
    `def.immuneToUntargetedSpellTrapDestruction` + `ctx.__declaredTargetUids`
    (id 198); `findHandQuickEffectCandidates` + `def.canRespondFromHand`/
    `activateFromHand` (risposta dalla MANO a un'attivazione: id 900);
    `gameState.battleProtectionByName` (id 1059);
    `def.indestructibleByEffectOncePerTurn` in `destroyFieldSpell`,
    `def.blocksOwnExtraDeckSummons` → `DuelEngine.isExtraDeckSummonBlocked`
    (id 469); Necrovalley ora nega anche rianimazioni e recuperi
    (`specialSummon` da 'graveyard', `searchGraveyardWithChoice`).
    **Due bug reali trovati nel giro**: il checkpoint di targeting provava
    solo la PRIMA carta reattiva della zona Magia/Trappola (se quella diceva
    no, le altre non venivano interpellate); e la scelta dei bersagli del
    bot leggeva una voce-funzione di `cannotBeAttackTargetUids` come
    "vero", escludendo il mostro anche quando l'attacco era permesso.
    **Insidia presa scrivendolo**: un confronto per uid fra due carte SENZA
    uid (`undefined === undefined`) lega tutto a tutto — un Drago Bianco
    veniva distrutto "insieme" a un mostro qualunque in uno spec del bot.
    Ogni nuovo confronto per uid va scritto con un uid vero da entrambe le
    parti.
  **Lezione**: 3 delle 10 note del secondo giro erano in parte già false
  (il vincolo VENTO di Simorgh id 772 c'era già, per giocatore e IA) —
  leggere sempre il codice prima di implementare una nota.
  Spec: `note-carte-chiuse-2.spec.js`, `note-carte-chiuse-3.spec.js`
  (battaglie vere via `resolveAttack`; LP alzati a inizio caso, o una
  battaglia precedente chiude il duello e i casi dopo falliscono per finta).

- ✅ **Nucleo senza testa (Priorità 1 e 2 del piano, sviluppate sul branch
  `refactor/nucleo-senza-testa`, poi MERGIATO in `main` su richiesta
  esplicita dell'utente dopo la suite completa 199/199, e il branch
  eliminato)**: le regole del duello girano anche in
  Node (`tools/duello-senza-testa.js`, duelli interi con l'IA vera e un
  orologio virtuale; spec `duello-senza-testa`). Tre regole per il codice
  nuovo, tutte sorvegliate da un guardrail:
  - **Un file di regola non tocca la pagina**: niente `document.`, si usa
    `PortaUI` (`js/engine/porta-ui.js`).
  - **Un file di regola non chiama per nome il disegno**: avvisa
    l'interfaccia dal canale `EventiDuello` (`js/engine/eventi-duello.js`):
    `emetti` per un avviso, `attendi` per un'animazione con un "fatto"
    (senza ascoltatori parte subito), `chiedi` per una domanda. I nomi
    sono un elenco chiuso (`EVENTI`): un evento nuovo si aggiunge lì e si
    ascolta in cima a `game-flow.js` o `actions.js`. `addToLog`,
    `updateUI`, `clearSelection`, `isBlockingModalOpen` ed `endDuel`
    tengono il nome ma vivono in `js/engine/canale-partita.js` con la
    sola parte di regola (il disegno è passato agli ascoltatori).
  - **Ogni scelta passa da `Decisioni.chiedi`** (`js/engine/decisioni.js`),
    mai da `DuelEngineUI`: la carta descrive la scelta (chi, tipo,
    candidati, `automatica` per il bot, `annullabile`, `viaggia` per le
    scelte che in Multiplayer devono viaggiare) e il modulo decide chi
    risponde: l'avversario remoto, la persona davanti allo schermo, o la
    scelta automatica. Per una scelta in più passi dove il bot decide
    l'insieme intero, `Decisioni.rispondeUnaPersona(chi)`. Una decisione
    che aspetta una persona si legge con `Decisioni.inSospeso()` e le si
    risponde con `Decisioni.rispondi(...)`: utile per i test, che prima
    dovevano cliccare il modale. **Gli spec che vogliono "nessuna
    interfaccia" possono ancora mettere `window.DuelEngineUI = null`**:
    `actions.js` risponde alla domanda `decisioni-a-schermo` guardando
    proprio quell'oggetto.
  Due difetti veri chiusi nel passaggio: la Fusione (id 38) attivata dal
  BOT con più mostri possibili chiedeva al giocatore quale Evocare; e una
  scelta di bersaglio annullabile, annullata in Multiplayer, non arrivava
  all'altro client (che dopo 30 secondi prendeva il primo candidato): ora
  l'annullo viaggia come uid dedicato (`Decisioni.UID_ANNULLA`).
  Nota storica: in quel passaggio 235 e 622 restavano aperte perché il
  checkpoint restituiva subito il bersaglio. Sono state poi chiuse con la
  variante attendibile `ctx.declareTargetWaiting`.

- ✅ **Posti al tavolo (Priorità 3, branch `refactor/posti-al-tavolo`, poi
  MERGIATO in `main` su richiesta esplicita dell'utente dopo la suite
  completa 204/204)**:
  'player' e 'bot' sono solo i NOMI dei due posti; chi li controlla lo
  dice `Tavolo.controllore(posto)` (`js/engine/tavolo.js`): 'persona',
  'ia' o 'remoto'. Default di sempre: 'player' persona, 'bot' IA (remoto in
  Multiplayer); `Tavolo.imposta({ player: 'ia' })` cambia. **Per decidere
  "chi sceglie / chi guida il turno" si chiede a Tavolo, mai al nome del
  posto**: `changeTurn` e `initGame` avviano `turnoIA(posto)` per un posto
  IA, lo scarto di fine turno e la risposta in Catena dell'IA valgono per
  qualunque posto IA, `Decisioni` mostra una scelta solo a un posto
  'persona'. L'IA (`js/ai/*`) riceve sempre il posto da cui gioca (`io`,
  default 'bot') e legge lo stato con gli accessori di Tavolo
  (`Tavolo.mano(io)`, `Tavolo.mostri(Tavolo.avversario(io))`...); ogni
  posto può avere il suo livello (`gameState.livelloIA[posto]`, altrimenti
  `botDifficulty`). Guardrail `guardrail-ia-da-ogni-posto`, che vieta anche
  `Tavolo.mano(io) = ...`: un'assegnazione a una chiamata, in uno script
  non stretto, NON è un errore di sintassi (`node --check` la lascia
  passare) ed esplode solo quando la riga gira — preso davvero convertendo
  bot.js. Il duello senza testa è ora IA contro IA (`--giocatore <id>`,
  `--livello-giocatore`). I messaggi del registro di bot.js dicono ancora
  "Il bot" anche quando l'IA gioca dal posto 'player': succede solo in
  Node. Il Multiplayer non è stato toccato (`isRemoteResponder`/
  `isRemoteChooser` guardano ancora il nome del posto): è il passo
  successivo, "a passo comune".

- ✅ **Multiplayer a passo comune: protocollo e duello gemello (Priorità 3,
  passi C e D, stesso branch)** — `js/engine/passo-comune.js` +
  `tools/duello-gemello.js` (spec `duello-gemello`). I due client eseguono
  TUTTA la partita (stessi mazzi, stesso seme: `PassoComune.preparaDuello`)
  e si scambiano solo COMANDI (`Comandi.esegui`) e DECISIONI
  (`Decisioni.chiedi`, come posizione nell'elenco dei candidati). Spento
  finché nessuno chiama `PassoComune.avvia`: offline l'impronta delle 60
  partite è identica. **Dalla pagina (passo E)**: `js/multiplayer/mp-passo-comune.js`
  scambia mazzi e seme dentro initGame (se l'altro non risponde in 15s è un
  client vecchio e si gioca col protocollo di prima), manda a LOTTI (il
  relay scarta in silenzio oltre 20 messaggi al secondo, e qui un messaggio
  perso è una partita separata) e dopo una caduta di linea si fa rimandare i
  messaggi persi ('passo-riprendi': ogni messaggio ha un `seq`, doppioni
  scartati, buchi che fermano la coda finché non si riempiono). A passo
  comune i messaggi del protocollo vecchio tacciono tranne 'game-over'
  (filtro in `MP_broadcast`, mp-lobby.js). Gli spec Multiplayer di prima
  forzano il protocollo vecchio con `MP_SENZA_PASSO_COMUNE`; quello nuovo
  ha `multiplayer-passo-comune`, che gioca turni veri con le funzioni
  dell'interfaccia e carte VERE della mano (sostituirne una per comodità,
  come fanno gli spec vecchi, qui separerebbe davvero le due partite).
  **Il server su Render si ridistribuisce da solo col push su `main`**
  (render.yaml non fissa un branch): un relay che non conosce ancora
  'mazzo'/'passo'/'passo-riprendi' li rifiuta e i client ripiegano subito. Regole per il codice nuovo, tutte prese dal duello
  gemello:
  - **Una mossa locale parte solo a duello fermo** (`PassoComune.fermo`:
    niente Catena, finestra di priorità, scelta aperta, comando a metà),
    altrimenti viene rifiutata: l'IA aspetta con `aspettaDuelloFermo`/
    `quandoFermo` (bot.js). Un comando che ne lancia un altro DENTRO di sé
    è un errore di questo tipo (lo scarto di fine turno dell'IA partiva
    dentro il comando 'fase').
  - **Una scelta presa all'istante si applica a codice in corso finito**
    (`PassoComune.differisci`), e così quella ricevuta, anche se era già
    arrivata: altrimenti cade dentro un ciclo da una parte e dopo
    dall'altra (Kaiser Glider a metà di Buco Nero, Cerchio Ammaliante).
  - **Un timer che fa avanzare le REGOLE passa da `PassoComune.dopo`**
    (`dopoRegola` in duel-engine.js), non da setTimeout: a passo comune
    aspetta le scelte aperte su entrambi i client. Suoni, vibrazioni ed
    effetti visivi restano setTimeout.
  - **`Decisioni.rispondeUnaPersona(chi)` a passo comune dipende solo da chi
    controlla il posto** (`Tavolo.giocaUnaPersona`, che per un posto
    'remoto' guarda `Tavolo.impostaNaturaRemoto`): è il bivio "chiedo / decido
    da me" delle carte, e deve uscire uguale sui due client. Per lo stesso
    motivo una scelta si chiede a `chi: <il posto vero>`, mai `'player'`
    scritto a mano (63 corrette).
  - Uno stato che una mossa porta con sé va nel COMANDO, non su un campo
    della carta impostato dall'IA prima di eseguirla (Ra id 472:
    `pagaLpRa`).
  - Un `const` a livello di script NON è `window.X`: un modulo che altri
    leggono da `globalThis` va pubblicato anche lì (la prima versione di
    PassoComune non era vista da `Decisioni`, e nessuna decisione viaggiava).
  Il duello gemello confronta lo stato a FINE duello nel momento di
  `fine-duello`: quel che i timer fanno dopo non conta. Per ritrovare un
  guasto: `node tools/duello-gemello.js --seme N --traccia` mostra ogni
  scelta chiesta, decisione mandata/attesa e comando, e la prima
  divergenza dice quale pezzo dello stato si è separato.

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

## Test: insidie note

### Audit Yami Yugi (2026-10-09)

Il deck avversario di Yami Yugi usa ora **una sola copia di Mago Nero**
in Facile/Normale/Difficile, coerente con l'anime; le due copie rimosse
sono state sostituite con Soldato di Pietra Gigante e, da Normale in su,
Guardiano Celtico Sgradito. I Main Deck restano da 40 carte e Slifer resta
una singola esclusiva del Difficile.

Due difetti falsavano il deck e le vecchie simulazioni: Pietra del Saggio
(430) cercava la Maga Oscura con il vecchio id inesistente 19 invece di
188; inoltre l'IA valutava Slifer dai valori stampati 0/0 e rifiutava
sempre i tre Tributi. `AI_SHARED` stima ora l'ATK/DEF che Slifer avrà dopo
aver lasciato la mano e considera anche il valore del suo controllo sulle
Evocazioni avversarie; il playbook Hard di Yami Yugi gli assegna la stessa
priorità stimata. La valutazione Magie riconosce inoltre semanticamente le
linee che fanno Special Summon dalla mano: Dimensione Magica non viene più
scartata solo perché la sua distruzione successiva è facoltativa e non ha
ancora un bersaglio.

Guardrail: `yami-yugi-deck-ai.spec.js`. Campione mirato, 50 duelli per
livello contro Kaiba pilotato dalla Hard, semi identici: Yami Yugi
18/50 Facile, 21/50 Normale, 31/50 Difficile; Slifer è comparso nel log di
4/50 duelli Difficili e in nessun livello precedente.

### Audit Seto Kaiba e Marik Ishtar avversari (2026-10-09)

L'audit riguarda esclusivamente `characterDeckDatabase.kaiba` e `.marik`:
Starter e Structure non sono stati modificati. Le sei liste erano già
coerenti e restano invariate: 40 carte, tre Draghi Bianchi per Kaiba (le
tre copie canoniche), Obelisk/Ra in copia singola soltanto a Difficile.

Erano invece morte due linee IA. Il bot non tentava mai le combinazioni
dall'Extra Deck senza Polimerizzazione, quindi X/Y/Z erano solo decorative;
ora `chooseBanishFusion` valuta genericamente materiali, ATK risultante e
una rimozione scarto+distruzione già disponibile, poi esegue la mossa con
il comando `fusioneBandendo`. Media e Hard attivano anche l'Ignition del
Cannone tramite riconoscimento del testo, non tramite id. Flauto/Signore dei
D. e le normali Fusioni erano già operative e sono ora coperte dal test.

Ra soffriva lo stesso 0/0 stampato di Slifer: Hard lo rifiutava sempre.
`AI_SHARED.estimateSummonedStats` considera il pagamento LP, condividendo
con l'esecutore `shouldPayRaLp`: Marik paga fino a 100 soltanto se il campo
mostri avversario è libero. Nel campione identico da 50 duelli per livello
contro Yami Yugi Hard, Kaiba chiude 22/29/27 e Marik 12/32/33; Ra compare
in 8/50 Hard (prima 0), i Cannoni in 1/50 Medium e 1/50 Hard. La differenza
Normale/Difficile è quindi qualitativa ma reale; nessuna lista è stata
alterata per inseguire il rumore di un singolo matchup. Guardrail:
`kaiba-marik-deck-ai.spec.js`.

Secondo passaggio, su matrice più affidabile: cinque avversari Hard
(Yami Yugi, Joey, Pegasus, Mako, Bakura) × 50 semi × tre livelli per ogni
personaggio, 1.500 duelli totali. Prima dei playbook: Kaiba 24,4%/46%/50%,
Marik 27,2%/56%/65,2%; quindi la progressione esisteva già ed era il singolo
matchup a nasconderla. Hard ora preserva i corpi deboli quando ha una
Divinità in mano invece di consumarli per un altro Tributo; Kaiba dà priorità
a Signore dei D. con Flauto+Drago e al pezzo che completa X/Y/Z; Marik usa
Offerta Suprema solo se ha un secondo mostro senza Tributi e il flusso bot
sfrutta davvero l'Evocazione riaperta. Dopo: Kaiba 25,2%/46%/50,4%, con
Cannoni in 14/250 Hard e Obelisk in 10/250; Marik 27,2%/55,2%/62,8%, con Ra
in 28/250 Hard. Il piccolo calo di Marik è accettato: resta nettamente sopra
Normale e usa più spesso la linea anime rischiosa, senza barare né alterare
le liste.

Sotto carico (headless + CPU condivisa) un `page.waitForTimeout(N)`
fisso può far leggere lo stato PRIMA che l'animazione/timeout nel
motore sia davvero completato — trovato e corretto concretamente in
`battle-resolution.spec.js` (ora aspetta il vero callback `onComplete`
di `resolveAttack`, non un tempo indovinato). Se un nuovo test deve
aspettare un'azione asincrona del motore, preferire `waitForFunction`
su un segnale vero (`onComplete`, un cambio di `gameState`) invece di
un `waitForTimeout` fisso.

Un mismatch controllato dal test contro un effetto **genuinamente
casuale** del motore (es. Criosfinge id 761, `Math.random()` in
`discardRandomFromHand`) non è un bug del motore — l'asserzione va
scritta per tollerare l'esito casuale legittimo, non per assumere un
solo esito possibile (vedi il fix in
`return-to-hand-mechanism.spec.js`).

**Playwright e la policy di autoplay audio: l'intera sessione di test
parte già "attivata"**, non solo le chiamate dentro `page.evaluate()`
(limite più stretto già noto e documentato più sopra in questo file, sotto
i giri di sessione sull'audio). Verificato empiricamente in questa
sessione: `navigator.userActivation.isActive`/`.hasBeenActive` risultano
già `true` nel browser Chromium lanciato da Playwright PRIMA di
qualunque input simulato, e un `audio.play()` diretto (nessun gesto,
nessun click, nessun `page.evaluate()` di mezzo) va comunque a buon
fine. Conseguenza pratica: **non è possibile verificare con Playwright,
in questo progetto, se un tipo di evento specifico (es. un semplice
`mousemove`) sblocchi DAVVERO l'autoplay bloccato in un browser reale**
— qualunque test del genere risulterebbe un falso positivo per
costruzione, non una prova. Per una futura richiesta simile
("verifica che X sblocchi l'audio"), fidarsi della documentazione nota
delle policy dei browser (solo interazioni discrete — click/tap/tasto/
rotellina — sbloccano l'autoplay; un mero movimento del mouse non è mai
elencato da nessun browser/libreria nota come evento di sblocco), non di
un test Playwright che sembra "passare".

## Git

Autore singolo, storia pulita. Pattern osservato in sessione: commit
mirati per singolo cambiamento logico, push subito dopo ogni commit
(non accumulare commit locali non pushati) — a meno di istruzione
esplicita diversa dell'utente.

### Audit degli altri duellanti anime (2026-10-09)

Il riferimento completo è `docs/audits/MAIN_DUELISTS_AUDIT.md`: 31 personaggi, cinque
deck campione, 50 semi, 23.250 duelli. Non usare una singola coppia come
misura di bilanciamento. Dopo gli interventi, 30 curve su 31 sono monotone;
Umbra ha soltanto −0,8 punti Facile→Medio ed è stato lasciato invariato.

Correzioni identitarie: Strings valuta e prepara Slifer e possiede davvero
Fusione per Drago Verme Umanoide; Gozaburo usa Sepoltura Sciocca sui pezzi
ancora mancanti nel Cimitero per arrivare a Exodia Necross; Odion può Settare
1/2/3 Trappole per turno a Facile/Medio/Difficile. Starter e Structure non
sono stati modificati. Due semi dell'audit sono diventati regressioni per Il
Guardiano Affidabile (slot senza carta) e Ninja d'Assalto (fonte sparita
prima della risoluzione).

### Audit Pegasus avversario post-fix Toon (2026-10-09)

Non riusare le vecchie statistiche di Pegasus avversario: erano state
misurate quando Mondo dei Toon non poteva ancora essere attivato. Il nuovo
riferimento è `docs/audits/PEGASUS_OPPONENT_AUDIT.md` (dati grezzi nei due JSON): 1.500
duelli, curva 35,8% / 54,2% / 58,6%. Lo Starter Pegasus resta invariato.

La prima lista Hard post-fix aveva rimosso tutti i Conigli Oscuri e scendeva
sotto la Media. Ora conserva una base di mostri evocabili e rende visibile il
secondo piano anime con due Fusione, due Abbandonato e due Idolo dai Mille
Occhi. Nel controllo su 200 duelli Hard: Mondo 74,5%, assorbimento di
Abbandonato 18,5%, Restrizione dai Mille Occhi 4%. Il tool dedicato
`tools/audit-pegasus-identita.js` conta i segnali dal registro completo;
`duello-senza-testa.js` espone `cercaTutte` per evitare di rigiocare un
duello una volta per ogni segnale.

### Audit deck avversari Forbidden Memories (2026-10-10)

Il riferimento è `docs/audits/FORBIDDEN_MEMORIES_AUDIT.md`: 21 personaggi, cinque deck
campione, 50 semi, 15.750 duelli nella matrice principale. Starter e
Structure non sono stati toccati. Venti curve su ventuno sono monotone;
High Mage Atenza ha Hard 1,6 punti sotto Medio, ma realizza più spesso Drago
Nero Meteora (7% contro 2%) e resta invariato per non sacrificare Drago
Bianco e il piano narrativo a un margine statistico minimo.

Difetti emersi: Controllore Nemico usava `decl` fuori scope nel ramo cambio
Posizione; Hard ignorava le carte scoperte `repeatableWhileContinuous`;
Labyrinth Mage Settava Muro coperto rendendo impossibile Labirinto Magico;
Giltia era un Extra Deck morto e fuori piano. Ora Hard riconosce
genericamente gli effetti continui ripetibili, il playbook di Labyrinth
prepara Muro scoperto in Difesa e Giltia è stato rimosso soltanto dai tre
deck di Labyrinth Mage. Il futuro set di regole PS1 resta un'attività
separata: questo audit riguarda i deck dentro l'attuale Duel Monsters.

### Cinque cinematiche di carte iconiche (2026-10-10)

`js/ui/effects.js` e `effects.css` espongono ora scene dedicate per Forza
dello Specchio, Cilindro Magico, Rinascita del Mostro, Buco Trappola e
Tributo Torrenziale. Le Trappole applicano la regola subito e animano una
fotografia DOM: ritardarle romperebbe la continuazione di dichiarazione
d'attacco/Evocazione. Rinascita è l'eccezione deliberata: la callback
dell'Ankh precede la vera rimozione dal Cimitero e la Special Summon, con
fallback immediato quando FX/UI non esistono. Lo spec
`cinematiche-carte-iconiche` verifica regola, DOM e rilascio del lock.

Secondo gruppo sullo stesso contratto: Anello della Distruzione, Tempesta
Pesante, Tifone dello Spazio Mistico, Cambio di Cuore/Controllo Mentale e
Richiamo degli Infestati. Tempesta e Tifone ritardano la rimozione fino alla
callback; Anello e controllo applicano invece subito la regola perché i loro
flussi devono proseguire sincronicamente. Richiamo conserva il mostro fuori
dal campo durante l'emersione e `renderFields()` deriva la catena persistente
dal `targetUid` reale della Trappola: nessun timer grafico può lasciarla
appesa dopo la fine del legame.

Terzo gruppo di cinematiche iconiche: Buco Trappola senza Fondo (portale
dimensionale, non riuso del Buco Trappola), Armatura Sakuretsu, Giudizio
Solenne, Libro della Luna e Virus Distruggi-Carte. Questi effetti sono
deliberatamente solo visivi e lavorano su una fotografia del DOM: la regola
resta sincrona, requisito importante per attacchi, Trappole Contatore e
risoluzione LIFO delle Chain. Il Virus riceve dal motore gli indici realmente
colpiti, Giudizio il costo LP reale. Guardrail dedicato
`cinematiche-carte-iconiche-terzo-gruppo`; cache `v200`.

Quarto gruppo: Nega Attacco, Capro Espiatorio, Scatola Mistica, Rimozione
del Limitatore e Incantesimo Ombra. Capro mantiene anche il feedback Token
generico; Scatola conserva il primo bersaglio fra i due picker asincroni;
Limitatore riceve gli indici delle sole Macchine potenziate. Come Richiamo
degli Infestati, Incantesimo Ombra non usa una durata grafica arbitraria:
`renderFields()` ricrea le catene dal `targetUid` reale e le rimuove insieme
al legame. Guardrail `cinematiche-carte-iconiche-quarto-gruppo`, cache `v201`.

Quinto gruppo: Cerchio Ammaliante, Cappelli Magici, Moltiplicazione,
Controllore del Nemico e Buco Dimensionale. Il Cerchio persistente deriva
dal `targetUid`; Cappelli e Moltiplicazione ricevono gli slot realmente
creati; Controller riceve la modalità scelta. Buco Dimensionale sostituisce
nel gruppo Muro di Luce Rivelatrice, risultato assente dal database: non si
aggiunge una carta nuova di nascosto durante un lavoro grafico. Guardrail
`cinematiche-carte-iconiche-quinto-gruppo`, cache `v202`.

UI connessione Multiplayer: il terminale KaibaCorp dentro `#mpStatus` è
diventato una console semi-3D con emblema KC, stato uplink, circuiti,
cronometro, nodi di handshake e telemetria. Resta deliberatamente inline e
mai modale; i nodi seguono il numero di frasi di attesa già emesse, non stati
inventati del relay. Responsive verticale/orizzontale e movimento ridotto.
Guardrail `multiplayer-kaibacorp-connection-ui` più end-to-end relay verde;
cache `v203`.

Menu Tutorial (`tutorial.html`, voce Duelli › Tutorial): la lezione col nonno
più tre lezioni brevi (Catena, Fusione, Flip), tutte in
`js/tutorial/tutorial-duel.js` con `?lezione=nonno|catena|fusione|flip`. Ogni
lezione è una preparazione (stato iniziale scritto al posto di
`preparaManiIniziali`) più un elenco di passi; quelle brevi finiscono con un
passo `fine` che segna `save.tutorial.lezioni[id]` e torna al menu. Nessun
file di `js/engine/` le conosce (lo controlla lo spec della lezione col
nonno): una lezione nuova si aggiunge solo lì e in `tutorial.html`. Spec
`tutorial-lezioni-brevi`.

Storia anime, regola di fedeltà (2026-10-11): un duello LATERALE che nel canone
finisce con la sconfitta del personaggio noto si gioca dalla parte di chi ha
vinto (Panik contro Mai, Marik contro Joey...); un duello della strada
PRINCIPALE che Yugi perde nel canone si vince, e la scena dopo racconta la
svolta vera (tempo scaduto col videonastro, attacco fermato sul parapetto). Lo
sorveglia `storia-anime-coerenza-narrativa`. Per inserire tappe principali in
un'area si usa una voce `separazioni` con `ids: [...]` (la posizione si ricava
dalle tappe stesse, anche con più inserimenti nella stessa area): vedi
`applicaSeparazioni` e lo spec `storia-anime-migrazione-fedelta`.

Memorie Proibite (2026-10-11) segue la trama del gioco PS1: Seto tradisce solo
alla fine (discende dagli stregoni, vuole DarkNite), Heishin vuole gli Oggetti
per sé e finge la sconfitta, i finalisti del torneo portano sei Oggetti (Shadi ne
ha due), la Sacerdotessa Isis non è nel passato. Mage Soldier è un personaggio
nuovo con ritratto segnaposto (`images/characters/mageSoldier.jpg`). Spec
`storia-fm-fedelta` (trama + migrazione, anche dentro il torneo).

Pubblicazione minificata (2026-10-11): il progetto resta senza build; la copia
da mettere online la crea `npm run pubblica` in `dist/` (ignorata da git):
solo pagine .html della radice, manifest.json, sw.js e le cartelle js, images,
audio, video, assets (elenco di ciò che ENTRA, in `scripts/pubblica.js`);
JS/CSS/HTML minificati con esbuild file per file, nomi di primo livello
intatti, nessun commento, nessuna source map; controlla anche che ogni voce di
APP_SHELL esista. `npm run verifica-pubblicazione` confronta ogni pagina della
copia con l'originale; `YGO_RADICE_GIOCO=dist` fa giocare la suite sulla copia.
Una cartella nuova che il gioco legge va aggiunta a CARTELLE in pubblica.js.
Piano di hosting privato in memoria (Cloudflare Pages + controllo Supabase).

Modalità aggiuntive (2026-10-11): Puzzle (`puzzle.html`), Rivincite
(`rivincite.html`) e Torre dei Duellanti (`torre.html`), voci di Duelli. REGOLA
DELL'UTENTE, la più importante: il motore di Duel Monsters (`js/engine/`,
effetti delle carte, IA, dati carte) NON si tocca, perché va riusato così com'è.
Ogni modalità vive in `js/modes/` (dati in `js/data/puzzles-db.js`,
`rivincite-db.js`, `torre-db.js`) e cambia solo la preparazione del duello,
avvolgendo `preparaManiIniziali` come il Tutorial; registra le sue voci in
`window.ModalitaDuello[<mode>]`, lette dal solo blocco "EXTRA — MODALITÀ
AGGIUNTIVE" (`ModalitaExtra`) di `js/duel-session.js`. Contratto e forme in
`types/modalita.d.ts`, file sotto `// @ts-check`. Stato salvato con
`SaveManager.getModeState/setModeState`. Gli oggetti della Torre sono solo di
preparazione (+1 carta, prima mossa, avversario −1000 LP, carta fidata in mano):
niente bonus di statistiche. Premi: solo i crediti normali (e quelli della prima
soluzione di un puzzle); le Sfide delle modalità (sezione "Modalità" in
sfide.html) pagano solo crediti, i premi speciali arriveranno con carte nuove.
Lo sorveglia `guardrail-modalita-fuori-dal-motore`; spec `modalita-puzzle`,
`modalita-rivincite`, `modalita-torre`. Un puzzle nuovo va aggiunto anche allo
spec dei puzzle, con la sua soluzione.

Revamp Torre/field (2026-10-12): `torre.html` ha una UI dedicata a due colonne
su desktop e lineare su mobile, con stato della scalata, progresso, guardiano
corrente e torre in profondità ma strutturalmente immobile. Tutti i 20 duelli
usano `torreCastelloPegasus.jpg`. In `field-ambience.js` il Dirigibile ha vento
continuo con raffiche forti irregolari (`ventoContinuo`); gli altri ambienti
non-WW1 usano trame canvas procedurali e ritmi meno uniformi. I due field
Grande Guerra sono rimasti invariati per richiesta esplicita.

Equip con scelta asincrona (2026-10-11, bug segnalato giocando): con due o più
bersagli la lista si apre e la scelta è asincrona, ma la Carta Equipaggiamento
è già nella sua casella senza aggancio, e la pulizia degli Equip orfani in
`recomputeStaticEffects` (a ogni ridisegno) la mandava al Cimitero prima del
tocco. Con un solo bersaglio la scelta è immediata e il guasto non si vedeva.
Rimedio: la carta porta `equipInScelta` finché si sceglie (la pulizia la
salta) e l'effetto chiede di essere aspettato (`attendiScelta`, nella parte
SINCRONA di activate: dentro le callback `ctx.waitForChoice` non esiste più).
Fatto in `equipToChosenTarget` (tutte le Equip comuni), Flamberge (727) e
Sepoltura Prematura (633). Un Equip nuovo con una scelta propria deve fare lo
stesso. Spec `equip-con-scelta-del-bersaglio`: ogni Equip con più bersagli,
scegliendo l'ULTIMO della lista e toccandolo come un giocatore.

Tifone dello Spazio Mistico rifatto (branch `feature/vfx-tifone-cilindro-ritorno-mano`,
mergiato il 2026-10-16): imbuto di vento verticale che solleva e strappa la
carta bersaglio (`.fx-mst-scene`/`-funnel`/`-card`), al posto della vecchia
singolarità. Del branch è entrato SOLO il Tifone: nel frattempo `main` aveva
già un Cilindro Magico rifatto (portali con vignetta, sigillo e ponte) e un
movimento Terreno → mano generico (evento `transizione-carta` emesso da
`returnMonsterToHand`/`returnSpellTrapToHand`/Turbine Gigante, disegnato da
`FX.playZoneTransition`), quindi `FX.playCardToHand` e il Cilindro "a
cilindri scanalati" del branch sono stati scartati di proposito. Il
guardrail in `return-to-hand-mechanism` ascolta l'evento, non una classe
CSS. Cache `v263`.

Extra Deck evocabile in viola (2026-10-16, stile Master Duel): quando una
Fusione senza Polimerizzazione (`banishFusionMaterials`, es. Cannone Drago
XY/XYZ) si può Evocare ora, la zona Extra Deck del giocatore pulsa in viola
(`.fusion-ready`, casella + dorsi della pila); cliccandola si apre TUTTO
l'Extra Deck con le evocabili in viola e selezionabili e le altre spente.
Una sola condizione per entrambe, `fusioniEvocabiliOra` (game-flow.js), e
opzione generica `evocabili: [uid]` di `openCardListPicker` (actions.js),
riusabile per qualunque elenco "mostra tutto, scegli solo alcune". Nessuna
regola toccata. Spec `extra-deck-evocabile-pulsa`; cache `v264`.

Dorso e pile (2026-10-16, richiesta dell'utente): il dorso delle carte ha UN
solo bordo, quello esterno di `images/cards/backCard.jpg`; tolto il `::after`
di `card.css` che ci disegnava sopra un secondo filo dorato (non
reintrodurlo). Su telefono in verticale (`max-width: 600px`) carte in campo
e pile sono a metà strada: `--card-w` scende a ~43px e `--field-slot-pad`
cresce di quanto lei cala (casella e campo restano larghi uguale), la pila
sale dall'86% al 92% della casella con sfalsamento 2%/1,3% per strato
(ultimo strato esatto sul bordo). Desktop e orizzontale invariati. Cache `v265`.
Badge del campo (ATK/DEF e contatori delle pile), stesso giorno, due scelte
esplicite dell'utente da NON annullare: **una riga sola, mai due** (una
versione su due righe è stata respinta) e **niente pillola né bordo**: solo
i numeri, a gradiente (ATK arancio, DEF azzurro, pile oro) con rilievo 3D
dato da `filter: drop-shadow` impilati (non `text-shadow`, che sporcherebbe
il gradiente). Su mobile (`max-width: 900px`) ATK/DEF sta sul fondo della
propria carta e il contatore dentro la cima della propria pila, così nessuno
dei due arriva sulle carte vicine; sul desktop restano sotto la carta e
sopra la pila. Il lampo delle variazioni (duel-feedback.js) anima `scale` e
aggiunge il bagliore alla catena di drop-shadow, non `transform`/`box-shadow`.
Spec `badge-campo-non-si-sovrappongono-su-mobile` (nessuna sovrapposizione,
una riga, nessun box). Cache `v267`.

Barra delle fasi (2026-10-16): dopo sette giri di proposte grafiche tutte
respinte, l'utente ha scelto di tenere la barra ORIGINALE e cambiare solo
tre cose. 1) Misure: il primo pulsante comincia dove comincia la casella
Terreno, l'ultimo finisce dove finisce il Cimitero (`justify-content:
space-between`, padding laterale zero); su mobile prima erano raccolti al
centro. 2) Colori dal campo: `--fase-accento`, versione chiara della
`--campo-tinta` già usata dalle caselle (js/ui/tinta-campo.js +
js/data/tinte-campi.js), al posto dell'oro fisso; un'arena nuova la eredita.
3) Un solo bordo: il cerchietto dell'icona non ha più la sua cornice, e su
mobile il pulsante è trasparente e il quadratino porta tutto. Spec
`barra-fasi-dal-terreno-al-cimitero` (verificato al contrario). Cache `v269`.
Se in futuro si riprova a ridisegnarla, l'utente ha respinto: celle tutte
uguali "scolastiche", cornici elaborate, rombi, giallo acceso, fasce uniche
a capsula.
Subito dopo, controllando su 12 schermi e sul telefono vero (adb):
- **la barra veniva SCHIACCIATA quasi ovunque** (flex-shrink nella colonna
  centrale, `overflow: hidden`): 41px invece di 58 a 1400x900, 9px a
  740x360, con i pulsanti tagliati. Ora `flex-shrink: 0`; sui telefoni
  bassi in orizzontale è alta 20px con margini negativi, così occupa in
  pagina lo stesso spazio di prima e il campo non si sposta. Tolta la fascia
  scura arrotondata dietro i pulsanti (resta il filo). Su mobile i pulsanti
  si misurano in `cqw` della barra (crescono sui tablet).
- **Dorsi sulle carte piccole** (≤72px, regola "carta compatta" di card.css):
  restavano a 6px di raggio a ogni misura (pillole a 24px, cornice mangiata
  a 43px) e backCard.jpg rimpicciolita lasciava un filo nero solo sopra e a
  sinistra. Ora il dorso piccolo è disegnato in CSS con colori e proporzioni
  misurati sull'immagine, raggio 2px, cornice mai sotto 1px.
- **Pile e carte non allineate**: la carta sta al centro della casella, la
  pila era nell'angolo in alto a sinistra (6,3px su desktop dal 19/09;
  2,3px su telefono da quando le carte sono scese a 43px). Ora il dorso in
  cima ha misura e posizione di una carta (`--pila-x/--pila-y`), lo spessore
  sta nel margine verso il basso a destra.
- **Carte sollevate dopo un tocco**: `.card:hover` (-8px, ×1.06) scattava
  anche sui telefoni e restava attivo dopo il tocco. Ora solo con
  `(hover: hover) and (pointer: fine)`.
Spec `pile-allineate-alle-carte` (verificato al contrario). Cache `v270`.

Grido di Evocazione (2026-10-17, richiesta dell'utente): prima dell'Evocazione
di una carta simbolo il duellante appare a figura intera (sagoma trasparente da
`images/characters/avatarTrasparenza`, pedina da 320px su schermi stretti),
spinto dal vento, e la annuncia dentro due bande oblique (skewY -3deg, come\nl'annuncio di turno: grido in quella alta, nome carta in quella bassa) che\nattraversano il centro, mentre la figura le sfonda in altezza: 3 secondi (prima 2,2), un tocco la salta. I dati sono
SOLO in `js/data/gridi-evocazione.js` (duellante riconosciuto dal nome file
dell'immagine, non dall'id: vale per ogni suo aspetto e per i protagonisti
della Storia); la scena in `js/ui/grido-evocazione.js/.css`. Il motore emette
solo l'attesa `grido-evocazione` in DUE punti: Evocazione Normale
(`evocazioni.js`, prima del volo, mai per un Set) e Special Summon
(`duel-engine.js`, prima dell'effetto visivo: lì la regola è sincrona, quindi la
carta è già in campo sotto il velo e si ritarda solo il disegno). Un grido per
carta e per duellante in tutto il duello; rispetta l'impostazione "filmati di
Evocazione" e il movimento ridotto; si chiude da sola se si apre una scelta.
Insidie prese: la scena NON deve controllare `isBlockingModalOpen()` (risponde
sì anche per la propria cinematica e si chiuderebbe subito); i due script
vanno caricati DOPO `eventi-duello.js`. Nei test serve
`window.GRIDO_EVOCAZIONE_FORZA = true`, perché con `DUEL_FAST_OPENING` la scena
è spenta. Spec `grido-evocazione`; cache `v285`.

Stesso account su due dispositivi (2026-10-17, segnalato dall'utente: "rischio di
sovrascrittura"): il controllo "non sovrascrivo un cloud più recente" confrontava
le date di MODIFICA, ma ogni azione locale aggiorna quella data PRIMA del
caricamento — un dispositivo rimasto indietro, alla prima azione, risultava "più
recente" e cancellava le ore giocate sull'altro. Ora (`js/cloud/cloud-sync.js`,
"Base di sincronizzazione") ogni dispositivo ricorda da quale versione del cloud
è partito (`ygoCloudBase`: la `updated_at` che ha scaricato o scritto per ultima),
e il caricamento è atomico (`UPDATE ... WHERE updated_at = <quella vista>`, nessuna
migrazione: usa la colonna che già c'è). Se la riga è cambiata altrove il
caricamento NON scrive (`CLOUD_CAMBIATO`) e `risolviConflittoCloud` scarica il
cloud: vince lui, perché è l'unica copia che tutti i dispositivi ritrovano, e le
modifiche fatte qui nel frattempo restano in una copia di sicurezza
(`CloudSync.copiaDivergente()`, chiave `ygoSalvataggioDivergente`), solo se ce n'erano.
`inVolo` annota la `updated_at` che si sta per scrivere, così una risposta persa
non fa scambiare la propria scrittura per una altrui. Un dispositivo senza base
(mai allineato dopo questo aggiornamento) usa la vecchia regola per data finché non
si allinea. NON è un merge: se due dispositivi giocano davvero in parallelo, uno
dei due perde le ultime mosse (conservate nella copia). Un kick del primo
dispositivo è stato scartato apposta: non risolve il caso offline e punisce chi usa
due dispositivi in buona fede. Lo spec `sync-due-dispositivi-senza-sovrascrittura`
prova i quattro scenari con due dispositivi veri e il finto cloud (che ora capisce
update condizionato e insert duplicato, più il gancio `primaDelloUpdate` per far
cadere una scrittura altrui fra lettura e scrittura). Versione 1.3.29, cache `v294`.

Sessione di accesso a 48 ore (2026-10-17, richiesta dell'utente): Supabase tiene la
sessione per sempre (il refresh token si rinnova), quindi il limite è lato CLIENT
(`js/cloud/cloud-sync.js`, "Durata della sessione"): il blocco di durata massima di
Supabase è un'impostazione a pagamento, e qui serve a decidere QUANDO ripetere il
login, non a difendersi da chi manipola il dispositivo (quello è compito delle RLS).
`ygoSessioneInizio` = { uid, at } è scritto da `signIn`; una sessione già attiva prima
della regola non ha il segno e parte da adesso (nessuno viene cacciato al primo
avvio). Scaduta (`sessioneScaduta()`): `terminaPerScadenza()` fa PRIMA `pushSave` (tetto
6s: mai perdere ore di gioco per un limite di tempo), poi esce, e `showGate` in
index.html spiega il perché (`consumaAvvisoScadenza`). Controllo all'avvio, ogni 5
minuti e al ritorno in primo piano (l'APK resta aperta in sottofondo per giorni); mai
a metà di un duello (`gameState` presente e non finito). Insidia trovata scrivendolo:
con il gate già superato nella scheda (`sessionStorage`) il menu si apriva senza
guardare CHI fosse l'utente, quindi una sessione appena chiusa non si vedeva — ora
`initGate` chiama sempre `waitForUser()`. Il finto cloud dei test ha l'opzione
`collega(ctx, { ricordaUscita: true })` (signOut ricordato nel localStorage) usata da
`sessione-48-ore.spec.js`. Versione 1.3.30, cache `v295`.

Mano, box info e frecce (1.4.62, branch `feature/fluidita-mano`, mergiato in `main`):
- **Fluidità della mano** (`duelMonstersCore.html`, `js/engine/actions.js`, `game-flow.js`). Il "legno" NON era un calo di
  fps (misurato sul telefono vero: 60 fps prima e dopo): erano durate e proprietà sbagliate. Regole da non rompere:
  il fantasma del trascinamento si muove con `transform` in un solo `requestAnimationFrame` per fotogramma (mai
  `left/top`), nasce IDENTICO alla carta (posizione di presa, rotazione 0) e in 180 ms ruota/ingrandisce/si centra
  sul dito (`DURATA_ATTACCO_TRASCINAMENTO_MS`); il volo verso la casella è FLIP (solo `transform`); `.hand .card`
  ha transizione `transform .3s` con curva di decelerazione e niente bounce. **La classe `selected` NON fa parte
  della firma di `firmaRenderStabile`** e `reconcileHandCards` la riallinea sul nodo esistente: prima la carta
  toccata veniva sostituita (artwork ricaricato, nessuna transizione). Spec `mano-sollevamento-non-ridisegna`.
- **Caselle verdi**: una sola carta alla volta (`spegniEvidenziazioneCaselle`, chiamata da
  `selectHandCardForInspection` e `highlightEmptySlots`); durante il trascinamento si evidenziano come al tocco.
  Il catcher dei popover copre la mano: un tap su un'altra carta ora la seleziona subito
  (`mano-cambio-carta-con-popover`).
- **Box info** (`cardInfoPanel`): niente (X), si chiude toccando fuori, all'inizio del trascinamento e attivando un
  effetto dalla mano (`suppressCardInspectionFor`, che evita anche la riapertura da `mouseenter`). Su mobile
  verticale parte in alto sotto Abbandona (`top: offset + 58px`, `max-height: 44dvh`, scorre dentro). Sta dentro
  `.battlefield-side` (z-index 1) mentre le mani hanno 5: aperto, il contenitore sale a 90 (`:has`).
- **Stepper**: stesso stile minimal con più contrasto, e frecce `››` tra le fasi (`.phase-step::after`, maschera SVG
  nel colore `--fase-accento`; accese per fatte/attiva, spente per le future). Una regola vecchia più in basso le
  nascondeva ancora: se spariscono, cercare `.phase-step::after { display: none }`.
- **Freccia d'attacco** rifatta: percorso curvo (`aggiornaFrecciaAttacco`), alone, punta fissa 26 px, mirino sul
  bersaglio agganciato (`segnaFrecciaAgganciata`), punta che si attacca al centro del mostro se il dito è vicino.
  Il gradiente è `userSpaceOnUse`: sul riquadro dell'elemento un tratto verticale/orizzontale non si dipingeva.
  La posizione della punta si legge da `#attack-arrow-target` (cx/cy), non più da `x2/y2`.
  Le bande dell'attacco diretto sono molto più tenui (strisce a bassa opacità, sfumano anche verso l'interno).
- **Intro del campo su mobile** (`max-width: 900px`): solo dissolvenza. Misurato sul telefono (411x750): anche con
  28deg il campo partiva 142 px più in basso e sbordava di 15 px per lato, e si leggeva come uno scroll diagonale.
  Desktop invariato (1.7x / 58deg). Spec `intro-duello-non-sborda-su-mobile`.
- **Spade Rivelatrici fisse**: il marchio (`.field-sword-mark`, modo 7 in `icone-posizione-webgl.js`) usa la STESSA
  spada neon verde dell'animazione (`fx-webgl.js`), con bagliore sfumato verso i bordi del canvas (senza si vedeva
  il rettangolo). La perdita del contesto WebGL non blocca più `prepara()` per sempre (`pronto = null`): prima su
  telefono le spade fisse ricadevano per sempre sulle forme CSS vecchie.
- **Pedine** (1.4.59-1.4.60): in Multiplayer ognuno sceglie la propria pedina nella sala (`mp-pedina.js`, campo
  facoltativo `pedina` nel messaggio `ready`); nelle conversazioni della Storia parla sempre la pedina, anche il
  protagonista con ritratto scritto a mano (ripiego sull'avatar se la pedina manca). Il ripiego audio "parte al
  primo gesto" resta attivo finché `play()` non riesce (su touch `pointerdown`/`touchstart` non sbloccano l'audio).
- **Provare sul telefono vero** (nessuna APK da rifare): `adb reverse tcp:8080 tcp:8080`, un server statico senza
  cache che inietta `window.AUTH_GATE_SKIP = true` nell'HTML (lo script usato sta nello scratchpad, va riscritto in
  10 righe), Chrome su `http://localhost:8080/duelMonstersCore.html`; per misurare `adb forward tcp:9222
  localabstract:chrome_devtools_remote` + Playwright `connectOverCDP`. **Insidie**: il tab già aperto NON si
  ricarica da solo (va ricaricato, o si vede il JS vecchio); `execFileSync` blocca gli intervalli del processo,
  quindi non si campiona mentre si lancia `adb shell input swipe`; l'utente usa lo stesso telefono per Claude, e
  un tap automatico può finire nella sua app: controllare cosa mostra lo schermo prima di toccare.
  **Mai** pulire una copia di lavoro temporanea (`git worktree`) che contiene una giunzione a `node_modules`: la
  rimozione ha seguito il collegamento e ha cancellato `node_modules/.bin` (ripristinato con `npm rebuild`).
  Se serve provare `main` da solo, copiare i soli sorgenti o usare uno stash, non un worktree con la giunzione.

WebGL di cerimonie, distruzione e ologrammi (1.4.67, branch `feature/webgl-buste-distruzione`, mergiato in `main`):
- **Luce delle cerimonie** (`js/economy/pack-opening-webgl.js`, `window.PackOpeningGL`): un canvas AUTONOMO per
  cerimonia (la pagina del Negozio non carica `effects.js`, quindi non c'è `FxWebgl`), creato all'apertura e
  RILASCIATO alla chiusura (`distruggi()` fa anche `loseContext`: su telefono i contesti sono pochi). Un solo
  shader con fino a 6 impulsi `{x, y, istante, tier}`: tier 0 strappo, 1-6 dalla comune alla segreta/mitica (per
  fascia: colore, raggi, colonna di luce dalla super, scia anamorfica dall'ultra), **7 apertura del mazzo, 8
  carica, 9 fontana**. I bianchi si comprimono con `1-exp(-c*1.1)`, non con un `min`: sommando nucleo, raggi e
  alone un taglio netto faceva un disco bianco che copriva la carta. `crea()` torna `null` senza WebGL o con il
  movimento ridotto, e `pack-opening.js` ripiega sulle scintille DOM.
  Le fasce Super, Leggendaria, Segreta e Mitica prima cadevano nel valore delle comuni (tempo e festeggiamenti):
  ora `MOSTRA_MS`, `TIER_LUCE` e `FASCE_ALTE` le coprono, e il riepilogo annuncia la migliore.
- **Cerimonia del mazzo comprato** (`festeggiaMazzo`): tre atti — CARICA (0,9 s, la scatola trema:
  `.po-scatola-carica`), APERTURA (flash, tre onde, sedici raggi, colonna, scia, fontana; il ventaglio esce SOLO
  con `.po-deck-rivelato`, non alla creazione) e finale (alone oro + lampo sul sigillo). Un test che aspetta la
  scatola aperta deve aspettare il fatto (`waitForFunction`), non un tempo: dipende da WebGL sì/no.
- **Distruzione dei mostri** (`fx-webgl-scena.js`, primitiva `T.DUST`): ESPLOSIONE come prima + DISINTEGRAZIONE. La
  carta originale si nasconde subito e resta una COPIA in un contenitore non ruotato fuori dal campo (un
  ridisegno del Terreno non può farla sparire) con una maschera che scorre con la sola `mask-position`; i granelli
  sono quadratini di brace, senza texture (su `file://` le immagini non si possono usare come texture).
- **Ologrammi dei mostri in WebGL** (`js/ui/monster-hologram-webgl.js`): UN canvas dentro `#monsterHologramLayer`,
  texture = illustrazione, con scanner d'ingresso, glitch a strisce, aberrazione cromatica, due strati di profondità,
  scanline e base luminosa. `monster-hologram.js` calcola la lista (`calcolaRect`) e prova prima il WebGL
  (`MonsterHologramGL.aggiorna`); se non c'è torna al CSS. **Su `file://` non si prova nemmeno** (texture
  rifiutate): CSS subito. Un guasto a gioco avviato (contesto perso) spegne il modulo e `sync()` ridisegna in CSS.
  **Bordi:** le illustrazioni sono rettangoli pieni, e non se ne possono fare senza bordo: la visibilità si calcola
  SULL'IMMAGINE (ogni lato sfuma ~26%, gli effetti si moltiplicano agli angoli, un ovale li cancella), mai con un
  taglio netto, e la base luminosa sfuma prima del bordo del riquadro.
  `ologrammi-visibili.spec.js` è fragile sotto carico (la dimensione dell'ologramma si calcola dal riquadro della
  carta mentre è in animazione): fallisce a intermittenza ANCHE su `main`, non è una regressione.
1.4.68 (branch `feature/ologramma-lanciato`, mergiato in `main`) — WebGL: ologramma che si muove, effetti di carta e Cartoteca:
- **L'ologramma vola e si disintegra** (`monster-hologram-webgl.js`): con gli ologrammi WebGL, in attacco parte LA FIGURA
  (`MonsterHologramGL.lancia`: traiettoria DRITTA — l'utente non vuole archi, come la freccia d'attacco —, scia di 3 copie,
  glitch/aberrazione al massimo; la carta resta ferma, niente `is-attacking`); all'ingresso scende componendosi con lo scanner;
  in distruzione/Tributo/Cimitero `disintegra` fa salire un fronte con bordo incandescente e la figura sopravvive al mostro
  uscito dal Terreno finche' ha finito (la polvere `DUST` si centra su di lei, niente `disintegraCarta`; una seconda chiamata
  per lo stesso uid non rifa partire nulla). Senza ologramma WebGL tutto resta com'era. Spec `ologramma-volo-e-disintegrazione`.
- **Bordi dell'ologramma**: la sfumatura si attenua dove il pixel e' chiaro o colorato (il soggetto, es. la testa del Drago
  Bianco), cosi' non viene mangiato; fascia ~14%, ovale largo. **Insidia nota**: su una carta con lo sfondo CHIARO il
  rettangolo puo' tornare a vedersi (rimedio possibile: maschere alpha offline).
- **Attacco respinto** (`imp.playAttackBlocked`, primitiva `T.SHIELD`): barriera a celle esagonali con un'onda dal lato
  dell'attaccante. La stessa barriera e' la **Difesa** (`playPositionDefense`), e l'**Attacco** e' una carica luminosa
  (`playPositionAttack`): con WebGL niente piu' spade/scudo animati sulla carta (`showPositionEffect` in game-flow.js; senza
  WebGL restano `IconePosizione`). Spec `attacco-respinto-barriera`.
- **Movimenti di carta** (fx-webgl-scena.js, `rettaCarta`/`olograma` helper): Cimitero, rianimazione, cambio di controllo,
  Tributo, aggancio Equip, con `T.ORB` (sfera con coda), `fantasma` e le primitive esistenti. Spec `movimenti-carta-webgl`.
  **Niente doppio effetto**: una carta con una cinematica propria per la rianimazione (Mostro Resuscitato, Richiamo del
  Posseduto) passa `skipGraveyardTravel` a `specialSummon`, o partirebbe anche il volo generico (`rianimazione-senza-doppio-effetto`).
  Il cambio di controllo (Controllo Mentale/Cambio di Cuore: cinematica + viaggio di `takeControl`) NON e' stato verificato
  per lo stesso doppione.
- **Vetrina "Vedi ologramma"** (`js/ui/ologramma-vetrina.js`): pulsante nella scheda dei mostri (`card-detail.js`) SOLO nelle
  pagine che la caricano (oggi la Cartoteca); riusa il WebGL del duello portando `#monsterHologramLayer` sopra la vetrina
  (`layer()` lo crea se manca), ripiego CSS (`.ov-css`) su `file://`. Spec `cartoteca-vedi-ologramma`.
- Conteggio dei Life Point a 1,9 s (il suono dura ~2 s, `animateLifePoints`); freccia d'attacco retta.
  Non verificato su telefono ne' con 10 ologrammi insieme (con la scia fino a 40 riquadri).

**Audio su telefono (1.4.69, segnalato dall'utente: "funziona solo il main theme e le ultime, le altre no, nel Duello Libero sicuro")**: l'APK suona la soundtrack con `NativeMusicPlugin` (Android `MediaPlayer`, `setDataSource` su URL https, fuori da questo repository in `C:\AndroidDev\...`). 55 mp3 su 59 in `audio/soundtracks/` avevano una COPERTINA incorporata nel tag ID3 (~958 KB prima del primo frame audio): il browser le suona, `MediaPlayer` in streaming no. Quelle che funzionavano erano proprio le poche con tag piccolo (`56-59` e `32 ... HD`). Rimedio: tolti i tag ID3 grossi senza ricodificare (si taglia dall'inizio del primo frame, il frame Xing/VBR resta): 56 file, -50,7 MB, tutti ancora leggibili (provato con un `Audio` nel browser). **Un mp3 nuovo va salvato senza copertina**: lo sorveglia `guardrail-mp3-senza-copertina` (limite 100 KB). Insidia di metodo: sul computer queste tracce funzionano, quindi il difetto si vede SOLO sul telefono; il test nel browser con 8 s di attesa ha dato 4 falsi "illeggibili" per carico, ripetuto con 30 s era tutto a posto. Non verificato sul telefono vero: serve ricaricare l'app (la cache del Service Worker e' passata a v378).

Stelle per ogni arco della Storia anime (richiesta dell'utente): ogni CAPITOLO (= arco, un'area sulla mappa grande: Prologo, Regno, Battle City 1, Mondo Virtuale, Battle City 2, Mondo dei Ricordi) completato la prima volta, a QUALUNQUE livello, paga 3 Stelle e 350 Crediti una volta sola (`Rewards.forStoryArc`, `StoryProgress.pagaStelleArco`, banner "Arco narrativo completato!"). Gli archi gia' pagati stanno in `cardAcquisition.starArcs`, NON in `save.story` (l'azzeramento delle storie lo svuoterebbe e si ripagherebbe). Paga in `avanza` (solo gli archi NUOVI di quel passo: chi aveva gia' finito archi prima non li riceve da solo) e in `rifattoNodo`: PREGRESSO = rifare l'ULTIMO nodo dell'arco (scena riletta in `mostraScena`, o duello rivinto dall'area gia' superata, che porta `tappaId` nell'esito) oppure completare l'arco a un altro livello. Gli ultimi nodi: `anime-1-tempo-scaduto`, `anime-2-pegasus` (duello), `anime-4-scena`, `anime-6-gozaburo`, `anime-4b-epilogo`, `anime-5-aeroporto`; si leggono con `StoryProgress.ultimoNodoDelCapitolo`. Spec `storia-stelle-per-arco`.

WebGL di Catena, attivazione, mappe e Torre (1.4.70, branch `feature/webgl-catena-mappe-torre`, mergiato in `main`):
- **Aura di attivazione** (`imp.playActivationAura`, chiamata dalla facciata di `FX.playCardActivateCenterScreen` in effects.js, quindi per OGNI attivazione): lampo del colore del tipo (Magia verde, Trappola magenta, mostro oro), due onde e scintille DIETRO la carta a centro schermo. Non sostituisce la carta DOM: i chiamanti aspettano `ACTIVATE_CENTER_DURATION_MS`.
- **Energia fra i Link** (`imp.playChainLink`, agganciata in fondo a `renderChainStack`): alla comparsa di un Link una sfera corre dal precedente al nuovo (rossa se e' dell'avversario, azzurra se e' tua), alla risoluzione lampo oro. Lo stato (`chainStackUltimoConteggio/Risolto`) evita di rifarla a ogni ridisegno del pannello. Le posizioni si leggono dal DOM dopo ~200 ms, quando le miniature si sono assestate.
- **Sentiero e faro sulle mappe a nodi** (`js/ui/mappa-percorso-webgl.js`, `MappaPercorsoGL.crea`, chiamato da `NodeMap.render` fra le linee e i nodi): luce lenta sulle tratte percorse, comete sulla tratta verso la tappa corrente, faro che respira sulla tappa corrente. Indipendente dal disegno: serve alle mappe SENZA voce in `ambiente-mappe-storia.js` e dice la direzione anche sulle altre. Si accende solo con Dettagli video "Alti".
- **Tempesta sulla Torre** (`js/ui/torre-ambiente-webgl.js`, `TorreAmbienteGL.monta(.tw)`, da `disegna()` di torre.html): nebbia, braci dal basso, un fulmine ogni ~7 s con il lampo, aura d'oro sulla corona e riquadro che pulsa attorno al piano corrente. Un canvas sopra la torre, pointer-events none, il layout non cambia (la torre resta immobile di proposito). Solo "Alti".
- Spec `webgl-catena-mappe-torre`. Non verificato sul telefono; i Dettagli video "Alti" sono necessari per mappe e Torre (come per gli ambienti dei duelli).

Salvataggio locale legato all'account (1.4.71, segnalato dall'utente: "sono entrato con un secondo account, poi con il mio admin e mi sono trovato con il deck dell'altro e ho perso tutti i miei deck"): il salvataggio locale e' UNO per dispositivo e non diceva di quale account fosse. Admin -> altro account -> admin: al rientro la regola "vince il piu' recente" confrontava la data del locale (che era dell'altro account) con la riga cloud dell'admin e, essendo piu' nuovo, lo CARICAVA SOPRA, cancellando i deck veri (misurato sul database: due righe `saves` con lo stesso id di deck). La base di sincronizzazione non bastava: e' per utente ma si sovrascrive al cambio account. Ora `js/cloud/cloud-sync.js` ricorda a chi appartiene il locale (`ygoProprietarioSalvataggio`, scritto su pull/push riusciti; senza marcatore si ricava dall'ultima `ygoCloudBase`) e `leggiCloud` — il punto da cui passano gate, riconciliazione, auto-sync e Profilo — chiama `mettiDaParteSeDiAltri()` PRIMA di tutto: se chi e' collegato non e' il proprietario, il locale si conserva in `ygoSalvataggiDiAltriAccount[uid]` (una copia per account, `CloudSync.copieDiAltriAccount()`), il dispositivo si libera e riparte dal cloud dell'account che entra (o dal nome se non ne ha). `pushSave` rifiuta con `SALVATAGGIO_DI_ALTRO_ACCOUNT`. Spec `sync-salvataggio-di-un-altro-account` (verificato al contrario). **Non recupera** i deck persi prima della correzione: il cloud non tiene versioni; servono una copia sul dispositivo o un backup di Supabase. **Un secondo account sullo stesso dispositivo e' ora sicuro, ma la copia di chi esce NON e' ancora ripristinabile dall'interfaccia (solo da console).**

Mazzi della Grande Guerra gratuiti + messaggi del Multiplayer (1.4.72). **Mazzi WW1 gratis, una volta sola** (richiesta dell'utente): `gratis: true` sui tre pacchetti WW1 di `js/data/starter-structure-decks.js` (`starter_ww1_regio_esercito`, `starter_ww1_kuk`, `ww1_regio_esercito`); `ShopCatalog.mazziInVendita` li dà a costo 0 senza carte speciali, `possedutiDelTipo` li ESCLUDE (non rincarano lo scaffale), il Negozio mostra "🎁 Gratis — una sola volta" e poi "Già acquistato"; neppure l'amministratore li riacquista. Spec `negozio-mazzi-ww1-gratis`. **Multiplayer "versione incompatibile"**: nel duello, ogni guasto dello scambio dei mazzi (`MpPassoComune.prepara`) finiva nello stesso messaggio "usa una versione non compatibile", anche solo perche' l'altro telefono era ancora in caricamento (l'attesa era di 15 s; ora 45 s e il messaggio dice il motivo VERO: `err.message`). Il relay su Render e' stato provato dal vivo (due WebSocket: `mazzo`/`passo`/`passo-riprendi` passano, avvio a freddo ~12 s), quindi non era il server. Se ricapita, guardare QUALE frase compare: "non ha ancora caricato il duello" = timeout dell'altro client; "versione Multiplayer dell'avversario non e' compatibile" = `VERSIONE_PROTOCOLLO` diverso.

Multiplayer, arena e musica dell'host (1.4.73, segnalato dall'utente: "terreno e forse musica: anche se l'host seleziona, esce casuale"): l'host risolveva e trasmetteva le sue scelte UNA volta sola, a `room-ready`. La stanza di solito si riempie subito e i selettori si toccano DOPO, mentre si aspetta: quelle scelte restavano ignorate (e l'host stesso partiva dalla copia vecchia, `configRicevuta`), quindi il duello usava il valore di default fissato all'ingresso, cioe' un'arena e una musica CASUALI. Ora `inviaConfigHost()` (mp-lobby.js) rimanda `room-config` a ogni cambio dell'host con l'ospite presente; un "casuale" si estrae una volta e resta stabile finche' resta casuale. Spec `multiplayer-scelta-arena-dopo-ingresso` (verificato al contrario: fallisce con "usa l'arena casuale").


Connessione lenta (1.4.74, richiesta dell'utente: "su connessione lenta l'applicativo e' un disastro: pulsanti che non fanno nulla, field default poi loading poi stock"). Misurato con un server che simula 300 ms di latenza e 250 KB/s sulla copia di `dist/` (script `lenta2.js` nello scratchpad, riscrivibile in 40 righe: server http con ritardo + Playwright che campiona loader/gioco/sfondo ogni 250 ms). Cause e rimedi:
- **Copertura d'avvio inline** (classe `avvio-in-corso` su `<html>`, in OGNI pagina col loader tranne `index.html`, che ha lo splash): il loader (`js/ui/page-loader.js`) sta nel body ed e' un file esterno, quindi arriva dopo gli script bloccanti dell'head; fino ad allora lo schermo era vuoto (o col campo di default nudo) e i tocchi non facevano nulla. Il blocco e' IDENTICO in tutte le pagine (inserito da uno script usa-e-getta, sorvegliato da `guardrail-copertura-avvio`) e lo toglie `page-loader.js` appena nasce (15 s di rete di sicurezza). `duelMonstersCore.html` ha la versione estesa.
- **Campo richiesto subito**: sempre in `duelMonstersCore.html`, l'head legge `?field=` (tabella `window.CAMPI_RITIRATI` condivisa col resto della pagina), scrive subito lo sfondo e fa il preload di QUEL campo, al posto del dirigibile scaricato a vuoto. Misurato: lo sfondo giusto c'e' dal primo campione (prima: default a 2,2 s, campo vero a 6,4 s). Nel Multiplayer l'arena viene importata nella pagina della lobby: gli script dell'head NON vengono eseguiti, quindi li' la tabella dei campi ritirati e' vuota (irrilevante: l'host sceglie solo campi esistenti).
- **Service Worker** (`rispostaAppShell`, `ATTESA_RETE_APP_SHELL_MS` = 1,5 s): per html/css/js con la copia in cache, se la rete non risponde (intestazioni) entro 1,5 s si serve la cache e la rete continua in sottofondo ad aggiornarla. Prima era network-first puro e una rete lenta ma presente non falliva mai, quindi la cache non serviva a niente (duello pronto a 11,3 s a freddo e con SW installato; ora ~6,6 s con SW). Senza copia in cache non c'e' scadenza. Limite noto: subito dopo un rilascio, prima che il SW nuovo abbia riscaricato tutto, una pagina puo' mescolare file nuovi (rete) e vecchi (cache); `pwa-register.js` forza `update()` ad ogni avvio per stringere quella finestra. Spec `service-worker-cache` (orologio finto, scadenza fatta scattare a mano).
- **Multiplayer**: (1) `precaricaArena()` scarica documento, script e fogli dell'arena appena l'avversario entra in stanza e `loadDuelArena` li precarica in parallelo prima del caricamento sequenziale (prima ogni script partiva a scaricarsi solo dopo l'esecuzione del precedente: ~100 file x 300 ms); (2) `PageLoader.show()` all'avvio dell'arena, cosi' non si vede la pagina mezza costruita; (3) `ATTESA_CONFIG_MS` da 4 a 20 s e l'host riinvia `room-config` quando l'ospite dice "pronto" (`riceviPronto`): prima, allo scadere dei 4 s, l'ospite partiva con arena e musica SUE. NON e' stata aggiunta una barriera "pagina caricata su entrambi" prima di `DuelSession.start()`: `start()` gira quando carica `game-flow.js`, PRIMA di `multiplayer.js`, e spostarlo cambierebbe l'ordine di caricamento dell'arena; lo scambio dei mazzi di `MpPassoComune.prepara` (45 s) fa gia' da barriera per la partita. Spec `multiplayer-precarica-arena`, `avvio-lento-copertura-e-campo`.
- **Ancora da fare** (proposte non richieste): musica casuale da 10 MB che compete con script e immagini al primo avvio; bundle degli script nella build `pubblica` (103 richieste nel duello); `index.html` non ha la copertura (splash dedicato) e fra il primo paint del menu e il `load` passano ~0,8 s in cui i pulsanti si vedono; `storia.html` impiega 17 s al `load` con questa rete.

Hotfix 1.4.75 (cache v384): **il Service Worker di 1.4.74 rompeva ogni pagina sul telefono** ("Pagina web non disponibile, net::ERR_FAILED" su duello-libero.html, visto via adb subito dopo il push). Il sito pubblicato (Cloudflare Workers) risponde 307 a `/pagina.html` verso `/pagina`; l'installazione scarica `pagina.html` seguendo il redirect, quindi Cache Storage contiene una risposta con `redirected: true`, che il browser RIFIUTA per una richiesta di navigazione. La nuova scadenza di rete scambiava il redirect (non `ok`) con la copia in cache, cioe' proprio quella risposta. Ora: un redirect (`opaqueredirect`) e' una risposta valida e si consegna cosi' com'e' (`utilizzabile`); ogni copia servita dalla cache viene ricostruita senza il segno `redirected` (`senzaRedirect`); e un percorso senza estensione (`/pagina`, dopo il redirect) e' app shell, non "media" cache-first (prima la pagina restava servita dalla cache fino al rilascio dopo). **Perche' i test non lo avevano visto**: il server dei test non rediriga `.html` e `service-worker-cache` usa risposte finte. Spec `service-worker-redirect-del-sito`: un server che si comporta come Cloudflare + il Service Worker VERO in Chromium; verificato al contrario (con lo sw.js di 1.4.74 fallisce con lo stesso `net::ERR_FAILED`). **Lezione**: una modifica al Service Worker va provata contro il comportamento reale del sito pubblicato (redirect compresi) e su un dispositivo, non solo con risposte finte; il telefono dell'utente ha trovato in un minuto quello che 11 spec non cercavano. Un telefono rimasto con la v383 si ripara da solo: il browser ricontrolla sw.js a ogni navigazione, anche fallita.

Ultimo accesso online nel pannello Admin (1.4.76, richiesta dell'utente). `profiles.last_seen_at` (colonna nuova, applicata sul database vero con il connettore Supabase il 2026-10-24 e scritta anche in `supabase/schema.sql`) la scrive SOLO la funzione `segna_visto()` con l'ora del SERVER (un telefono con l'orologio sbagliato non falsa nulla). Il gioco la chiama da `segnaVisto()` in `js/cloud/cloud-sync.js`: all'apertura di ogni pagina (appena `waitForUser()` sa chi e'), ogni 5 minuti e al ritorno in primo piano, al massimo una volta ogni 5 minuti per dispositivo (`ygoUltimoVisto` in localStorage, annotato PRIMA della chiamata perche' due pagine che si aprono insieme non la facciano due volte); un errore non fa nulla. Il pannello (`admin.html`, `quantoTempoFa`) scrive sotto ogni account "Ultimo accesso: 3 ore fa / ieri / N giorni fa / mai" (data esatta nel `title`), "● Online ora" entro 10 minuti, e ordina gli account dal visto piu' di recente. **Il primo valore viene da `auth.users.last_sign_in_at`** (solo gli accessi, non le sessioni rinnovate): finche' un giocatore non apre il gioco dopo questo aggiornamento il suo "ultimo accesso" puo' essere molto piu' vecchio dell'ultima volta in cui ha giocato davvero. Il cloud finto dei test (`tests/helpers/finto-cloud.js`) ora instrada `rpc` e fa tornare `cloud.profili` come elenco; spec `admin-ultimo-accesso`.

Due account sullo stesso dispositivo, audit e correzioni (1.4.77, richiesta dell'utente, MASSIMA PRIORITA': "controlla che non ci siano perdite, sovrascrizioni... e che non succeda qualcosa se hanno lo stesso nome giocatore"; poi "anche progressi e statistiche"). **Il nome del giocatore non conta in nessun punto**: nessun confronto per nome nel codice, i salvataggi sul cloud sono per `user_id` (le policy RLS impediscono a un account di toccare le righe dell'altro). I rischi veri stavano nel salvataggio LOCALE, che e' uno solo per dispositivo. Trovati e chiusi:
- **Un salvataggio non sincronizzato non diceva di chi fosse** (marcatore a parte, scritto solo a sincronizzazione riuscita): se A giocava offline, usciva, e entrava B, quel salvataggio veniva trattato come di B — e con la regola "vince il piu' recente" poteva finire sul cloud di B cancellandone i progressi, oppure B ereditava il profilo di A. Ora l'etichetta e' DENTRO il salvataggio (`accountId`: `SaveManager.createNew`/`touch`/`impostaProprietario`/`getAccountId`) e quindi viaggia ovunque (backup nativo dell'APK, copie, scritture tardive di un'altra scheda). `proprietarioLocale()` la legge per prima, poi il marcatore, poi l'ultima base. `signOut` etichetta un salvataggio senza etichetta prima di uscire. `applyExternalSave` assegna il salvataggio a chi e' collegato (un file importato o scaricato dal cloud e' di chi lo prende), salvo `{ mantieniProprietario: true }` (ripristino del backup nativo prima dell'accesso, copia di un account che rientra).
- **Salvataggio di cui NESSUNO sa di chi sia** (nato prima di queste regole, mai sincronizzato): se il cloud di chi entra esiste, vince il cloud e quel salvataggio resta in una copia `'sconosciuto'` (`mettiDaParteSeDiAltri(true)`); se il cloud non esiste e' il primo accesso e gli si assegna (il vecchio salvataggio offline).
- **Le carte inventate (e la terminologia) del giocatore che esce andavano perse** (si azzeravano senza copia): ora la copia messa da parte le contiene (`fotografiaDelDispositivo`), e il segno "carte da caricare" (`ygoSyncCarteInSospeso`) lo toglie `svuotaQuestoDispositivo`.
- **Chi RIENTRA ritrova quello che aveva lasciato** (`riportaCopiaDelProprietario`, chiamata da `leggiCloud`): progressi mai arrivati sul cloud, statistiche, carte inventate. Se il cloud e' piu' nuovo della copia, la copia non si butta: diventa la sua copia di sicurezza (Profilo > recupera). Una copia presa PRIMA di un azzeramento del profilo non risorge (`generazione`). Le copie sono per account, fino a 3 (`precedenti`); `resetAccount`/`deleteAccount` le tolgono (`dimenticaCopieDi`).
- **La copia di sicurezza divergente era UNA per dispositivo e senza proprietario**: un account poteva vedere nel Profilo "recupera le modifiche" il salvataggio di un altro e caricarlo sul proprio cloud. Ora e' per account (`ygoSalvataggiDivergenti`, `CloudSync.copiaDivergente()` torna solo quella di chi e' collegato; la vecchia chiave `ygoSalvataggioDivergente` si migra da sola). I test non leggono piu' la chiave a mano: usano `CloudSync.copiaDivergente()`.
- **Niente posto per tenere la copia** (spazio del sito esaurito): prima si andava avanti col salvataggio dell'altro come fosse di chi entra. Ora `leggiCloud` si ferma con `SPAZIO_ESAURITO` senza toccare niente.
- **Un duello iniziato da un account e finito mentre ne era collegato un altro** (due schede): `DuelSession.finish` non scrive record/Sfide/premi nel salvataggio di chi c'e' adesso, torna al menu con l'avviso `accountCambiato`.
- **Statistiche e progressi**: vittorie/sconfitte (`records`), Sfide, missioni, tornei e relative statistiche, collezione, pacchetti, sblocchi, oggetti del Millennio, Storia, valute, mazzi stanno TUTTI dentro il salvataggio (nessuna chiave a parte: `duelArenaRecord_*` e' solo il ripiego di una pagina senza SaveManager), quindi seguono le stesse regole.
Spec `due-account-stesso-dispositivo` (cloud finto a piu' utenti, `utenti` in `tests/helpers/finto-cloud.js`, cambio account con `onAuthStateChange` come Supabase): stesso nome, uscita con e senza caricamento, rientro, cicli ripetuti, scrittura tardiva, salvataggio senza proprietario, copie isolate, spazio esaurito, impronta di 14 sezioni di statistiche per A e per B, azzeramento. **Verificato al contrario**: con il codice di 1.4.76 la sezione 3 fallisce (la carta inventata di A andava persa). `tutorial-lezioni-brevi` e' FLAKY gia' su 1.4.76 (1 corsa su 3 fallisce a ~95 s, anche con l'albero pulito): non e' una regressione.

WebGL carta Settata e danno (1.4.78, cache v387): le carte coperte sul Terreno (mostri in Difesa coperta, Magie/Trappole Set, di entrambi i lati) hanno un riflesso sul dorso e un lampo quando si scoprono (monster-hologram-webgl.js, syncSettate in monster-hologram.js); solo con Dettagli video Alti, funziona anche su file://, e il modulo NON riceve tipo o identita' della carta (l'effetto e' identico per ogni carta coperta, o tradirebbe una Trappola). Spec carta-settata-webgl. Danno ai Life Point (imp.playDamageEffect): da 1000 onde d'urto dalla casella LP, da 3000 terza onda e lampo bianco; sotto 1000 invariato. Il fondale WebGL della schermata di fine duello esiste gia' (DuelFxWebgl). Suite completa non eseguita.

Indicatore di salvataggio nel menu (1.4.79, cache v388): AutoSync.stato()/onStato (js/cloud/auto-sync.js) racconta 'salvato | in-attesa | in-corso | errore | offline | nessun-account' senza decidere nulla; js/ui/stato-salvataggio.js (StatoSalvataggio.monta) lo disegna sotto il menu di index.html. Un rifiuto di merito (CLOUD_PIU_RECENTE, PROFILO_AZZERATO, CLOUD_CAMBIATO) NON accende l'avviso di errore: non e' un guasto di rete. Spec stato-salvataggio-menu. Suite completa non eseguita.

Salvataggi messi da parte, ripristinabili dal Profilo (1.4.80, cache v389): chiude il limite scritto sotto 1.4.71 (la copia di chi esce non era ripristinabile dall'interfaccia). CloudSync.copieRecuperabili() elenca SOLO le copie dell'account collegato (la piu' recente rientra da sola; qui anche le piu' vecchie e quella non rientrata perche' il cloud era piu' nuovo) e quelle 'sconosciuto'; MAI quelle di un altro account (ripristinarle caricherebbe i suoi progressi sul cloud di chi guarda: ripristinaCopiaMessaDaParte le rifiuta anche chiamata a mano). Ripristino come per la copia di sicurezza: applica, il salvataggio di adesso diventa copia di sicurezza, la copia usata esce dall'elenco. UI: un pulsante per copia in RecuperoCopia.monta. Spec profilo-recupera-copie-messe-da-parte. Suite completa non eseguita.

Storia piu' veloce su rete lenta (1.4.81, cache v390): storia.html impiegava 18,3 s al load e scaricava 12,8 MB (stessa rete simulata di 1.4.74: 300 ms, 250 KB/s, sul build dist/). Cause: le testate delle campagne (alte 128px) usavano le mappe intere (fino a 2,2 MB l'una) e il browser scarica TUTTI i livelli di un background multiplo; e un <link rel=preload> della musica da 4,5 MB passava davanti a tutto. Ora le testate usano images/thumbs-banner/<stesso nome file> (640px, 40-75 KB, generate una tantum con System.Drawing: un'immagine di sfondo nuova per una campagna richiede la sua miniatura, lo controlla lo spec) e il preload e' tolto: 6,8 s e 6,7 MB. Misurato anche index.html con la stessa rete: i pulsanti compaiono DOPO che gli script sono stati eseguiti (splash fino a 3,5 s, gate/menu 3,5 s, load 4,5 s), quindi non esiste una finestra in cui si vedono senza funzionare: nessuna modifica. Spec storia-miniature-testata. Suite completa non eseguita.

Sentiero WebGL delle mappe non piu' seghettato (1.4.82, cache v391, segnalato dall'utente: 'orrende, seghettate'). Quattro cause in js/ui/mappa-percorso-webgl.js: 1) lo shader era mediump (16 bit sui telefoni): x*len si quantizzava a gradini di decine di pixel e le comete avanzavano a scatti - ora highp dove c'e' (GL_FRAGMENT_PRECISION_HIGH); 2) il profilo della cometa era GIRATO (coda davanti alla testa) e con il fronte tagliato netto (smoothstep su 2% del periodo) - ora q=1-fract(...), testa che cresce in 14% del periodo e coda dietro; 3) il riquadro di ogni tratta aveva un bordo netto - ora la luce si spegne prima (lato); 4) la risoluzione del canvas ignorava devicePixelRatio (al piu' 1 px per px CSS) - ora min(dpr<=2, tetto 3,2 Mpx). Guardato con uno screenshot a dpr 2 (pagina di prova con tre tratte e il faro). Gli altri moduli WebGL (ambienti, ologrammi, FX) restano mediump e a bassa risoluzione: sono luci morbide, ma lo stesso difetto del punto 1 potrebbe vedersi li' se hanno forme a bordo netto che si muovono. Suite completa non eseguita.

Effetto WebGL delle carte Settate TOLTO (1.4.83, cache v392, richiesta dell'utente: 'orrendo'): monster-hologram-webgl.js e monster-hologram.js sono tornati a prima di 1.4.78 e lo spec carta-settata-webgl e' eliminato. La nota di 1.4.78 su riflesso e lampo delle carte coperte non vale piu'; restano le onde d'urto sui danni pesanti. Le carte coperte tornano senza alcun effetto WebGL. Suite completa non eseguita.

Revamp degli effetti WebGL di sette arene, localizzati (1.4.84, cache v393, richiesta dell'utente: mondo virtuale, citta', campo acquatico, arena Antico Egitto giorno e notte, Castello di Pegasus interno 'troppo bagliore', industria KaibaCorp; escluse le due del campo da guerra). Prima gli effetti erano su tutto lo schermo (braciere sui lati del Castello, griglia e spirale sul Mondo Virtuale, raggi e strisce sulla citta'); ora ogni cosa sta dove c'e' la sua sorgente nell'illustrazione. js/ui/ambiente-webgl.js: opzione zone su QUALUNQUE modulo (rettangoli dell'IMMAGINE, y dall'alto, con lo stesso ritaglio cover dello sfondo; fuori zona il modulo NON viene calcolato, un if sulla maschera) e quattro moduli nuovi ontane (getto, onde, goccioline), 	raffico (auto viste dall'alto su corsie), spie (lampeggi, in fila sfasati) e scintillePunti (scintille da punti precisi). Le posizioni si scrivono in PIXEL dell'illustrazione (PX/ZPX, costanti PEGASUS_*, VIRTUALE_*, INDUSTRIA_*, ACQUA_*, EGITTO_*, CITTA_*): se si cambia un'illustrazione vanno riguardate. Castello: 27 candele vere (rilevate sull'immagine) al posto del bagliore; Mondo Virtuale: disturbo solo nei quattro pannelli al plasma, led del bordo in sequenza, scansione solo sul pavimento; Industria: spie rosse, lampade blu, stanze illuminate, scintille dai giunti; Acquatico: bracieri nei punti giusti, luce rifratta solo nello stagno; Egitto: otto fontane nelle vasche, bracieri, obelischi, Occhio di Horus; Citta': auto sulle strade (visibili solo con schermi larghi: in verticale l'immagine e' ritagliata sulla piazza). **Misurato**: in software (swiftshader) le scene nuove costano 2-4x le vecchie, ma sul telefono vero (Adreno 750) vecchie e nuove girano tutte a 60 fps pieni e nessuna si spegne. **Provato e scartato**: dividere l'immagine in celle e valutare solo i punti vicini con ternari annidati: 4x PIU' lento e shader enorme (resta catenaPunti come punto unico per riprovarci). **Insidia**: una scena che usa un modulo nuovo deve avere MOD.<stesso nome della chiamata> (era uto contro 	raffico: lo shader non compilava e la scena restava spenta). I fallback DOM di field-ambience.js non sono toccati.

Grido di Evocazione: la posa dedicata non ripiega piu' sulla pedina normale (1.4.84, segnalato dall'utente: 'a volte vedo la pedina normale'). La posa di images/characters/pedine-esclamazione/ pesa 1-2,5 MB e la scena la aspettava 900 ms: su rete lenta o APK appena aperta scadeva e usciva la pedina normale. Ora il caricamento di ogni immagine e' uno per indirizzo e NON si interrompe se chi la chiede smette di aspettare, la posa si aspetta fino a 3,5 s, e precarica scarica in anticipo le pose dei due duellanti (se hanno almeno un grido) 1,5 e 5 s dopo l'apertura. Lo spec grido-evocazione ritarda la prima assegnazione di src (Playwright non intercetta file://) e fallisce con la versione precedente.

Evocazione epica WebGL e Fusione (1.4.85, cache v394, branch `feature/evocazione-epica-webgl`, mergiato in `main`): `js/ui/evocazione-epica-webgl.js` rifà in WebGL la convergenza dei mostri di Livello 7+ ("Il Risveglio", 5,2 s) e la Fusione. UNO shader a tutto schermo con canvas proprio (rilasciato a fine scena): sigillo in prospettiva, spirale di energia, colonna di luce, archi, impatto a 2,7 s e una firma per Attributo (`uTipo`); poi DOM per la seconda parte — grande illustrazione nitida, nome, stelle una alla volta, ATK/DEF attuali — in colonna, mai sovrapposti. Sfondo molto scuro fino a 4,4 s, NESSUNA banda nera (scelta dell'utente). **Il filmato dedicato resta prioritario** (lo decide `playMonsterSummonEffect`, prima di arrivare qui); backend attivo solo con Dettagli video "Alti", WebGL con highp e senza movimento ridotto (`EvocazioneEpicaPronta`), altrimenti vale la versione GSAP/CSS di sempre. **`playElementalConvergence` ora TORNA la sua durata in ms** e `effects.js` la usa al posto di `ELEMENTAL_CONVERGENCE_MS`. La carta evocata, il suo ologramma (CSS e `MonsterHologramGL.nascondiPer`) e il badge ATK/DEF restano nascosti fino all'impatto con una regola per `data-uid`, non con un'animazione sul nodo (un ridisegno del Terreno sostituisce il nodo). **Fusione**: il vortice di carte è disegnato in DOM (rAF) sopra il vortice dello shader (`uFus`); il mostro entra solo a fine scena (`onDone`) e `FX.rivelazioneFusioneFatta(card)` dice a `specialSummon` (duel-engine.js) di NON rifare l'effetto di Evocazione. Il suono resta `SFX.evocation` (Evocazione) / `SFX.fusion` (Fusione). Le pagine di prova `_anteprima-evocazioni.html` e `_anteprima-fusioni.html` sono ignorate da git (`?t=<s>` congela lo shader, `?vel=0.25` rallenta). Spec `evocazione-epica-webgl`. `fusion-material-cinematic` e' intermittente (2 corse su ~8 fallite una volta, poi 11 di fila verdi; causa non vista). Non verificato sul telefono. Suite completa non eseguita.
Splash d'apertura con il Puzzle del Millennio in WebGL (1.4.86, cache v395, branch `feature/splash-puzzle-webgl`, mergiato in `main` con `--no-ff`): `js/ui/splash-webgl.js` disegna con UNO shader (raymarching, nessun modello/texture, funziona su file://) il Puzzle di Yugi Muto che ruota piano, polvere d'oro e alone; NESSUN raggio che gira (richiesta esplicita). L'Occhio di Wedjat inciso si accende da sinistra a destra col PROGRESSO VERO (`creaMisuratore`: risorse script/CSS finite via Resource Timing contro quelle attese lette dal testo della pagina, poi DOM pronto, `load`, e il verdetto dell'accesso passato da `hideSplashThen` → `SplashWebgl.concludi`); minimo 2,8 s e velocita' massima di riempimento. Finale: Occhio bianco, onda, camera nel Puzzle, bianco da cui compare il menu. In `index.html` lo splash di sempre resta come ripiego (senza WebGL highp, con movimento ridotto la scena resta ma senza dolly, o se spento). Il titolo e' il `<game-logo>` col suo emblema SVG nascosto (`.splash-webgl-on`). Pagina di prova `_anteprima-splash.html` (ignorata da git; `?t=` congela, `?p=` fissa il progresso). Spec `splash-puzzle-webgl`. Non misurato su telefono (il raymarching costa per pixel: tetto di pixel piu' basso su touch e riduzione automatica della risoluzione).
**ROLLBACK**: (1) a caldo, senza ripubblicare: `?splash3d=0` nell'indirizzo spegne lo splash 3D su quel dispositivo e lo ricorda (`localStorage.ygoSplash3D='0'`), `?splash3d=1` lo riaccende; (2) a freddo: `git revert -m 1 <merge>` (il merge e' un commit solo: `git log --merges -1 --grep splash-puzzle`) e push, oppure tornare al tag `pre-splash-webgl` (main com'era PRIMA): `git revert -m 1` e' preferibile perche' non riscrive la storia. Suite completa non eseguita.
1.4.87 (cache v396, branch `fix/splash-rilievo-e-transizione`): (1) lo splash 3D esce nel NERO e costruisce il menu a nero pieno (prima il lavoro della pagina a meta' animazione si vedeva come uno scatto); l'Occhio del Puzzle e' in RILIEVO (altezza nello shader, non linee). (2) Il logo di menu e accesso e' l'emblema SVG di `<game-logo>` con l'Occhio in rilievo bronzo (tre strati ombra/corpo/luce da `<use>`), senza parallasse. (3) "Profondita del menu" non esiste piu': la voce e' "Carte lucide: giroscopio" (`cardGyro`); spenta, il riflesso della carta in dettaglio segue il TOCCO (`modoTocco` in `rendiCartaViva`, `touch-action:none` sull'area). (4) **Evocazione Tributo**: pagati i Tributi non si esce senza Evocare — domanda `evocazione-in-sospeso` (eventi-duello.js), risposta in actions.js (`evocazioneTributoInSospeso`, che RIAPRE la scelta se sparita), guardie in `nextPhase` e nel comando 'fase'; nessun altro click/trascinamento durante `pendingTributePlacement`. Prima un pulsante di fase azzerava la scelta e il mostro sacrificato andava perso. (5) **Multiplayer**: la voce `GENERIC_OPPONENTS.multiplayer` era finita dentro un commento (due "\n" letterali in una riga) → avversario "Bot" nel duello e "undefined" a fine duello; ora il nome del profilo viaggia col messaggio `ready` (`nome`, ripulito, `?nomeAvv=`). **Lezione**: un `\n` letterale dentro un commento `//` mangia tutto il resto della riga. (6) Typecheck e guardrail rimessi a posto (fallivano dal 1.4.84: globali in types/globali.d.ts). Il box info delle Magie attivabili in mano non e' stato riprodotto; allineato ai rami delle altre carte.
1.4.88-1.4.89 (cache v398): (1) **Lo splash 3D dipende da "Dettagli video"**: `SplashWebgl` parte solo con "Alti" (`VideoQuality.isAlti()`), con "Normali" resta lo splash di sempre; `?splash3d=1` lo forza comunque. `video-quality.js` e' caricato PRIMA di `splash-webgl.js` in `index.html`. (2) **Primo accesso di un account nuovo**: dal gate (`afterGateSignIn`) senza salvataggio ora parte `Onboarding.avvia()` (nome + mazzo Yugi/Kaiba + lezione obbligatoria) invece del vecchio modale col solo nome, che resta come ripiego. (3) **Ra (id 472)**: la somma da pagare all'Evocazione si sceglie (`maybeAskRaLpChoice`: slider 0..LP-100, Metà/Tutto/Paga/Non pagare; `_raPayLp` e' un NUMERO, `true`/assente = tutto, `false` = niente) e l'Ignition da 1000 LP lascia scegliere il bersaglio su entrambi i Terreni (`raBersagli`, `chooseFieldCardTargetWaiting`). (4) **Ra - Modalita' Sfera (id 1275)**: l'effetto "offri in Tributo" richiede la Sfera scoperta sul Terreno (`ctx.zone === 'monster'`; prima era "attivabile" anche in mano e non faceva nulla) e non chiede piu' una casella libera (la sua si libera per Ra). Spec `ra-scelte-del-giocatore`. Lo spec `tutorial-lezione-col-nonno` e' INSTABILE (passa in una copia fuori da OneDrive, fallisce a intermittenza nella cartella del progetto: il Cilindro Magico non apre la finestra di risposta durante il turno del nonno), non e' una regressione di 1.4.87. Suite completa non eseguita.
1.4.90 (cache v399): verifica dei supporti alle Divinita Egizie (1271 Attacco Forza del Tuono, 1272 Pugno del Fato, 1273 Canto Antico, 1274 Incrocio di Anime, 1275 Sfera, 1276 Fenice). Un solo difetto vero: la Fenice (1276) pagava i 1000 LP con `ctx.dealDamage`, che passa dai blocchi dei danni (Carta della Rovina, Virus Distruggi-Carte): con uno attivo distruggeva senza pagare. **Pagare Life Point e' un costo, non un danno: si sottrae direttamente** (come Ra). Spec `supporti-divinita-scelte-e-costi` (1271, 1272, costo della Fenice; verificato al contrario). **Insidia di test**: rispondere a una scelta con `Decisioni.rispondi` NON chiude il modale che la mostrava, e la Catena aspetta finche' resta aperto (sembra una Catena bloccata): nei test si chiudono i modali a mano. Dubbi NON risolti: se l'Evocazione Tributo di Incrocio di Anime (1274) debba consumare l'Evocazione Normale del turno (ora la consuma: `canUseNormalSummonQuota`), non ho trovato un chiarimento ufficiale; la Fenice scambia con la Sfera solo nella End Phase del proprio turno (il testo dice "durante la End Phase"); l'effetto da cimitero di Canto Antico richiede Ra in mano. Suite completa non eseguita.
1.4.91 (cache v400): (1) **Missioni giornaliere rifatte**: 4, sempre le stesse e GENERICHE (js/data/missions-db.js, id `m-daily-*`): giocare un duello fino alla fine (conta anche una sconfitta, evento nuovo `playDuel` in `DuelSession.finish`, mai per abbandono/Demo/sandbox), vincerne uno, evocare 3 mostri, attivare 2 Magie/Trappole (`activateCard` porta ora `cardType`). Le missioni a tema (carte, Duellanti) sono passate al pool SETTIMANALE; un elenco di oggi salvato prima dell'aggiornamento e' rifatto da `getMissions` se nomina missioni non piu' nel pool. (2) **Bug vecchio chiuso**: `duelMonstersCore.html` caricava il tracker ma NON `missions-db.js` (nessuna missione avanzava dai duelli) e le tre pagine dei tornei non caricavano il tracker (`completeTournament` non contava ne' per le Sfide ne' per le missioni). Lo sorveglia `missioni-giornaliere-generiche`: ogni pagina col tracker deve avere i due cataloghi. (3) **Titoli**: la scala del Profilo ha 14 titoli (i 6 di prima restano con le stesse soglie) e ci sono ~45 **titoli speciali** (`js/data/titles-db.js`: storie a ogni livello, tornei, Torre/Puzzle/Rivincite, traguardi, Duellanti) che si sbloccano dalle SFIDE completate (permanenti: un "Ricomincia" in una storia NON li toglie) e si scelgono dal Profilo (`SaveManager.getTitoloScelto/setTitoloScelto`, in `save.player.titoloScelto`). Per un titolo nuovo serve prima una Sfida che dica la stessa cosa. Suite completa non eseguita.
1.4.92 (cache v401): (1) **Multiplayer + Ra**: spec `multiplayer-ra-somma-scelta` (due client veri, relay vero): la somma scelta viaggia nel comando `evoca` (`pagaLpRa`, un NUMERO) e su entrambi i lati restano uguali LP, bonus e impronta; verificato al contrario togliendo la lettura di `c.pagaLpRa` in `eseguiEvocazioneNormale` (chi riceve pagava tutto: 7900). (2) **Sfera sul Terreno avversario**: spec `sfera-ritorna-al-proprietario` con un vero cambio di turno (il bot gioca): resta sul Terreno del bot, non attacca, torna a chi l'ha giocata alla fine del turno dopo. (3) **Titoli speciali piu' compatti**: gruppi richiudibili (aperti solo dove c'e' qualcosa di sbloccato o il titolo in uso), filtro "Mostra solo gli sbloccati" (preferenza del dispositivo, `ygoTitoliSoloSbloccati`). (4) **Premi missioni settimanali**: Kuriboh, Joey e Spada Rivelatrice, passati da giornaliere a settimanali, avevano obiettivo 1 e 200-250 crediti; ora x3/x2/x3 e 700-800. Giornaliere: ~700 crediti/giorno (prima ~850 con 3 sorteggiate); settimanali ~10.900 a settimana (prima ~11.700); simulazione `tools/simula-economia.js` invariata nelle conclusioni (5,56 Stelle/settimana dalle missioni). Suite completa non eseguita.
1.4.93 (cache v402): **Il bot paga per Ra una somma ragionata** (`AI_SHARED.raLpDecisione`/`raLpDaPagare`, js/ai/ai-shared.js; prima tutto o niente a campo vuoto). A) Obiettivo: Ra batte il mostro avversario piu' forte con +500 e comunque arriva ad almeno 3000 (un mostro coperto vale 1800: mai un Ra da 900 davanti a un mostro da 800). B) Soglia di LP da non toccare: 1000 + l'ATK degli altri attaccanti avversari (Ra ne ferma uno) + 500 con 2 o piu' Magie/Trappole avversarie + 500 con la sua mano da 4 o piu'; se restando sopra la soglia non si arriva a 3000 non paga (e `estimateSummonedStats`, che usa la stessa funzione, non sceglie nemmeno di Evocarlo). Eccezione "scacco": a campo avversario VUOTO, se un colpo diretto vince (LP avversario <= Ra piu' gli altri attaccanti pronti, esclusi i Tributi e chi ha gia' attaccato) paga solo il necessario, anche 1400 e anche oltre la soglia. `bot.js` passa i Tributi e invia un NUMERO in `pagaLpRa`. Spec `ia-ra-somma-da-pagare` (verificato al contrario). Campione 200 duelli Marik Difficile vs Yami Yugi Difficile, stessi semi: 139 vittorie contro 132 della politica vecchia. Suite completa non eseguita.
1.4.94 (cache v403): per il bot un mostro avversario COPERTO conta 3000 ATK (`RA_ATK_IGNOTO`, prima 1800), scelta dell'utente: l'obiettivo davanti a un coperto e' 3500 e ogni coperto in piu' pesa 3000 sulla soglia di LP. Spec `ia-ra-somma-da-pagare` aggiornato. Suite completa non eseguita.
1.4.95 (cache v404): **regole delle Divinita' verificate online** (Yugipedia, YGOrganization, database ufficiale, fonti giapponesi). (1) **Incrocio di Anime** (id 1274) e' "Cross Soul" in giapponese ("モンスター1体のアドバンス召喚を行う"): l'Evocazione Tributo la fa l'EFFETTO, quindi NON usa l'Evocazione Normale del turno e si attiva anche dopo averla fatta; nessun Q&A ufficiale esplicito trovato, ma le fonti giapponesi (e la differenza con "in aggiunta alla tua Evocazione" di Card Advance, che dice il contrario per il permesso) concordano. `resolveCrossFieldTributeSummon(..., { senzaConsumareEvocazione: true })`, tolto il controllo `canUseNormalSummonQuota` da canActivate. (2) **Fenice** (id 1276): "Una volta per turno, durante la End Phase" scatta in OGNI End Phase, anche dell'avversario (`onOpponentEndPhase`, stesso corpo di `onEndPhase`). (3) **Canto Antico** (id 1273): il testo ufficiale non chiede Ra in mano per l'effetto dal Cimitero; resta cosi' per un limite del motore (`fireOwnMainPhase1GraveyardActivations` applica da sola l'attivazione all'inizio della Main Phase 1, senza scelta: senza la condizione si bandirebbe a vuoto ad ogni turno) — da risolvere solo con un'attivazione scelta dalla persona. Spec `supporti-divinita-scelte-e-costi` (Incrocio) e `fenice-scambio-fase-avversario`, entrambi verificati al contrario. Suite completa non eseguita.
1.4.96 (cache v405): **causa trovata dell'instabilita' delle lezioni del Tutorial** (`tutorial-lezione-col-nonno`, e quasi certamente `tutorial-lezioni-brevi`, segnalato "flaky" piu' sopra). Nei passi "Adesso tocca a me" (lezione col nonno e lezione sulla Catena) il cancello dei clic (`consenti`) permetteva `#activateModal`, cioe' anche lo SFONDO della finestra di risposta alla Trappola: un tocco sullo sfondo la chiude, cioe' RIFIUTA la risposta, e il Cilindro Magico non scatta piu' (il nonno attacca, "Perdi 500 LP", la lezione deraglia). Il passo avanza da solo con un controllo ogni 200 ms, quindi per un attimo dopo l'apertura della finestra un tocco sullo sfondo passava: lo specifico test (che clicca ogni 600 ms il punto indicato dal riflettore) ci cadeva quasi sempre nella cartella OneDrive, e una persona poteva cadere nello stesso. Ora i due passi consentono solo `#activateConfirmBtn`. Riprodotto 1 volta su 1 con clic fitti prima della correzione, 6 su 6 verdi dopo; `tutorial-lezione-col-nonno` e `tutorial-lezioni-brevi` 3 su 3 verdi. Il primo spec controlla anche il sorgente: nessun passo "Adesso tocca a me" puo' consentire lo sfondo. **Regola per le lezioni nuove**: in un passo in cui si aspetta una finestra di RISPOSTA dell'avversario, mai consentire il suo sfondo. Suite completa non eseguita.
1.4.97 (cache v406): **bilanciamento dei mazzi dei Duellanti dalla matrice completa** (richiesta dell'utente: proposte A per Lumis/Seeker/Umbra e per i Difficili piatti, Nitemare/Heishin "un po' meno duri", **Main Deck avversari restano a 40 carte**). Scoperta chiave della matrice incrociata (`tools/audit-matrice-completa.js --incrocia`: mazzo x IA, 3x3 per duellante): **l'IA dell'avversario sposta il risultato di soli 0-6 punti, la difficolta' la fa quasi tutta il MAZZO**; e l'IA Facile e Normale danno risultati quasi identici (da guardare). Alzare i mazzi a 50/60 carte NON e' una leva (misurato con `mazzoAvversario`: Lumis Hard 81->59%, Nitemare 6->11%, effetti opposti a seconda di come si riempiono gli slot). Modifiche (vittorie del giocatore, 8 mazzi di riferimento x 40 partite, prima->dopo): Lumis Normale 87->71 e Difficile 81->58, Seeker 83->76 e 77->57, Umbra 85->74 e 72->59 (i mostri da 800-1100 ATK sostituiti da Abile Mago Nero, Predatore Vorse, Genio della Lampada); Joey Hard 46->32, Pegasus 36->27, Atenza 35->33, Neku 20->16, Nesbitt 22->18, Strings 63->53, Weevil 63->53, Odion 58->48; Nitemare Hard 4->16, Heishin Hard 8->19 (meno Raigeki/Controllo della Mente, piu' mostri). In `character-decks.js` i ritocchi sono `ritoccaDeckHard` dopo quello di Nitemare; Lumis/Seeker/Umbra sono liste inline. **Insidie**: la carta simbolo deve avere la stessa quantita' a tutti i livelli (spec `mazzi-livello-facile`: Pegasus 123 e Heishin 13 facevano 3 invece di 2) e 3 copie e' il massimo (Predatore Vorse 4 su Nitemare); un drago di Livello alto in piu' PEGGIORA un mazzo di draghi (Atenza 35->43%: serve Livello 4 da 1900 ATK). Non toccati: Giacobbo e Dark Nite (salto Normale-Difficile ~7 punti, vicino al rumore di +/-3). Strumento di prova nello scratchpad (`prova.js`: varianti con `mazzoAvversario`), riscrivibile in 40 righe. Suite completa non eseguita (provati `mazzi-livello-facile`, `temi-ombra-duellanti`, `duellanti-main-strategie`, `duellanti-extra-storici`).
1.4.98 (cache v407): **versione che chiude il giro di 1.4.97 con la suite completa eseguita (richiesta dell'utente)**. Dopo il numero 1.4.97 le liste di Pegasus (Coniglio Oscuro 190 e Alligatore Toon 481 restano: sono nel nucleo che lo spec `audit-supporti-toon` protegge), Heishin (+Re di Yamimakai al posto del terzo Teschio Evocato, carta simbolo a 2 copie) e Nitemare (Lama Oscura e Drago Serpente Notturno al posto di Predatore Vorse e Armatura Sakuretsu, Predatore Vorse a 3) erano cambiate: chi aveva il sito a 1.4.97 aveva mazzi diversi, da qui il nuovo numero. Valori finali (vittorie del giocatore): Pegasus Hard 27%, Heishin Hard 19%, Nitemare Hard 16%. **Suite completa: 376/378 al primo giro**; i due rossi (`equip-con-scelta-del-bersaglio`, `multiplayer-nome-e-avatar-avversario`) passano rilanciati da soli e sono INSTABILI (l'Equip fallisce su una carta diversa ogni volta), non regressioni. Quattro spec aggiornati ai nuovi mazzi o resi robusti: `boss-hard-balance` (Heishin `[0,1,2]`, Nitemare `[0,1,1,3]`: sono i numeri pinnati di Raigeki/Forza Riflessa/Anfora/Jinzo), `premi-sfide` (una missione giornaliera "vinci un duello" paga per conto suo: le missioni si tolgono per la durata del test), `sfera-ritorna-al-proprietario` (con l'IA di 1.4.93 il bot usa la Sfera, 0 ATK, come Tributo: nel test mano e mazzo del bot sono solo Trappole non Evocabili) e il test Pegasus. **Progetto spostato (2026-10-25): ora vive in `D:\Sviluppo\millennium-duel-arena`** (prima OneDrive); le chat di Claude Code stanno in `~\.claude\projects\d--Sviluppo-millennium-duel-arena` (la storia di `YuGiOhGame` fino all'11/10 e' rimasta nella vecchia cartella `c--…-YuGiOhGame`, non contenuta nella nuova) e quelle di Codex sono state ricollegate nel suo `state_5.sqlite` (backup in `D:\Sviluppo\_backup-codex`). Verificare i percorsi assoluti in `C:\AndroidDev` (`generate-icons.ps1` punta ancora a `OneDrive\…\YuGiOhGame\images\icons`). Suite completa eseguita.
1.4.99 (cache v408, branch `feature/catena-webgl`): **la Catena in WebGL, stile Master Duel** (`js/ui/catena-webgl.js`, richiesta dell'utente con un'immagine di riferimento). Dal SECONDO Link nasce una scena a tutto schermo (un Link solo non fa scena: c'e' gia' la carta a centro schermo di `playCardActivateCenterScreen`): mondo oscurato, le carte VERE del gioco (`createCardElement`) a zig-zag (orizzontale su schermo largo, verticale su telefono) con il numero del Link luminoso all'angolo e un alone azzurro (tuo) o rosso (avversario), una CATENA di acciaio disegnata da uno shader fra una carta e l'altra (maglie che si incastrano, onda di luce che corre, nessuna immagine: funziona su `file://`), onda d'urto + scossa + scritta CATENA quando una carta piomba. Alla risoluzione (dall'ultimo) la carta in corso si ingrandisce e passa davanti, la maglia che la regge si spezza in scintille, poi la carta esce. A Catena finita la scena si smonta e il contesto WebGL e' RILASCIATO. **Aggancio**: `renderChainStack` (game-flow.js) chiama `CatenaGL.aggiorna(displayLinks, resolvingLink)` per primo; se torna `true` il vecchio pannello `#chainStack` resta spento, se `false` (Dettagli video "Normali", movimento ridotto, WebGL senza highp, `CATENA_GL_OFF`, o shader che non parte: `guasto`) vale il pannello di sempre, identico (`chain-stack-semi-3d` lo prova perche' la suite gira a "Normali"). Il motore non e' toccato: la regola e' quella di prima. Canvas a z-index 10086, `pointer-events: none`, SOTTO i modali (100000): la finestra "Rispondere?" resta cliccabile. **Insidie**: (1) lo shader gira a 2-4 fps in software (swiftshader) e gli screenshot di Playwright vedono fotogrammi vecchi: per giudicare i TEMPI dell'animazione leggere `getAnimations()`/`currentTime`, non fidarsi dell'immagine; (2) su telefoni deboli la risoluzione scende da sola (`adatta`, mai sotto il 35%) se i fotogrammi superano 40 ms; (3) un `window.gameState` non esiste sempre come proprieta' di window (variabile globale del duello): in questo file si usa `typeof gameState`. **Verificato sul telefono vero** (SM-S928B, Chrome, 411x750 css): 60 fps pieni con 2, 3 e 4 Link e alla risoluzione. Provato con una Catena FINTA iniettata via CDP (`gameState.chain = { active: true, links }` + `renderChainStack()`), NON con una Catena giocata: i Link finti devono avere `def: {}`, `handlerName` e `ctx`, o il ciclo vero del duello li risolve e `runHandler` lancia un TypeError (banner rosso dell'errore, non un difetto della scena). **Misurato sul telefono, tre correzioni**: la catena va disegnata SOPRA le carte e da bordo a bordo (da centro a centro copriva l'illustrazione), le carte in verticale devono lasciare un vuoto fra loro (altezza limitata da `passoV`) o le maglie restano nascoste, e il numero sta sull'angolo LONTANO dalla catena. **Una sola animazione per ogni Link, e chi e' chi**: le RISPOSTE non hanno mai avuto la carta a centro schermo all'attivazione (arriva solo alla risoluzione, `resolveChain`, riga con `link.alreadyAnnounced`): con la scena aperta il motore la salta (`CatenaGL.mostra(link)`) perche' la scena mostra gia' la carta ingrandita, mentre l'attesa `activatedAt` resta identica (il ritmo del duello non cambia). Il Link 1 conserva la sua carta a centro (la scena non c'e' ancora) e le carte che si attivano per un trigger durante la risoluzione (onFlip, onDestroy...) la mantengono: solo i Link della Catena la saltano. Sotto (o sopra, dal lato opposto al numero) ogni carta c'e' la scritta TU/AVVERSARIO (`.cgl-chi`) nel colore del proprietario. Idee non fatte: carte dell'avversario che entrano dall'alto e le tue dal basso, gettone col numero del Link sulla carta ancora sul Terreno (come in Master Duel), velo piu' chiaro durante la risoluzione per vedere gli effetti sul campo. Per rifare la prova: server statico che inietta `AUTH_GATE_SKIP`, `adb reverse tcp:8080`, Chrome sul telefono, `adb forward tcp:9222 localabstract:chrome_devtools_remote` e Playwright `connectOverCDP` (con molte schede aperte scegliere quella con `document.visibilityState === 'visible'`: le altre non fanno girare `requestAnimationFrame`). Spec `catena-webgl` (verificato al contrario togliendo l'aggancio in game-flow.js). Suite completa non eseguita su questo branch (provati `catena`, `guardrail-`, `tutto-aspetta`, `multiplayer-end-to-end`, typecheck).
Matrice completa di bilanciamento (2026-10-25, senza modifiche al gioco): `tools/audit-matrice-completa.js` fa giocare OGNI deck del giocatore (16 Starter/Structure di Yu-Gi-Oh piu' il Custom, letto da `reports/archetypes/CLASSIC_ARCHETYPES_WITH_CUSTOM.json`) contro OGNI duellante (61, esclusi i 6 della Grande Guerra) a Facile/Medio/Difficile, 50 partite per cella, IA del giocatore sempre Difficile, stessi semi ai tre livelli: 155.550 duelli, ~35 minuti con 12 processi (`--lavoratori`), risultati man mano in `reports/matrix/matrice-completa.jsonl` (`--riprendi` per ripartire, `--riassumi` per rifare le tabelle). Conclusioni in `docs/audits/FULL_MATRIX_AUDIT.md`; `tools/analizza-matrice.js` ricava le anomalie. Esito: scala globale coerente (giocatore 69,4% / 41,7% / 28,7%); anomalie su Lumis, Seeker e Umbra (scala piatta e Difficile facile), su Nitemare e Heishin (Difficile quasi imbattibile), su Joey (Difficile piu' facile di Medio) e su 17 duellanti con meno di 8 punti fra Medio e Difficile. Non si e' toccato nessun deck. Suite completa non eseguita.
1.4.100 (cache v409): numeri luminosi e ologramma. I Life Point di entrambi i duellanti, i danni/cure fluttuanti e il grande numero a centro schermo usano lo stile dei numeri della Catena (corsivo pesante, riempimento bianco, contorno e alone in --num-c: tu azzurro, avversario rosso, danno rosso, cura verde); CSS in duelMonstersCore.html. Con gli ologrammi accesi monster-hologram.js mette holo-on sull'<html> a ogni sync e il badge ATK/DEF diventa traslucido azzurro con righe di scansione e sfarfallio sull'opacita' (una riga, niente pillola; la classe sta sull'html e non sul nodo, cosi' il ridisegno incrementale non lo sostituisce). Provati badge-campo, riscontri-duello, catena-webgl, ologrammi. Suite completa non eseguita.

1.4.101 (cache v410): ATK/DEF a ologramma piu' grandi (desktop 0,82-1,12rem; telefono 9px con casella da 50px, misurato: a 10,6px la riga e' 55px e tocca la vicina), niente corsivo e righe di scansione quasi invisibili sul telefono. Spec badge-campo provato. Suite completa non eseguita.

1.4.102 (cache v411): ATK/DEF a ologramma BIANCHI NEUTRI, senza i colori arancio/azzurro; conta la dimensione: la cifra della Posizione attuale e' piu' grande (ATK se Attacco, DEF se Difesa; 1,2em contro 0,8em su desktop, in riga). Sul telefono si IMPILANO (ATK sopra, DEF sotto, 1,5em contro 1em, niente barra) e salgono sulla parte bassa della carta (richiesta dell'utente: 'vai anche un po sopra la carta'): ogni colonna e' larga 4 cifre, due mostri vicini non si toccano. Lo spec badge-campo ammette il badge dentro la carta (fino a 40px) e l'altezza impilata SOLO con holo-on; senza ologrammi restano una riga sola sotto la carta. Suite completa non eseguita.

1.4.103 (cache v412): **ATK/DEF a ologramma: VIETATO IMPILARLI** (richiesta esplicita dell'utente, 1.4.102 lo faceva sul telefono e l'ha respinto): sempre UNA riga, anche con gli ologrammi; lo spec adge-campo lo controlla di nuovo senza eccezioni. Sul telefono la riga perde la barra '/', sale sulla carta fino al bordo inferiore di una carta VICINA in Difesa (ruotata, larga quanto una carta e' alta: piu' in alto toccherebbe i suoi numeri) e il corpo e' ~10px (limite: casella da 50px). Suite completa non eseguita.

1.4.104 (cache v413): ATK/DEF a ologramma tornano SOTTO la carta sul telefono: 'sopra la carta' era un permesso condizionato ('se serve'), e non serve, perche' il limite e' la larghezza della casella e non l'altezza. Una riga, senza '/', ~10px. Suite completa non eseguita.

1.4.105 (cache v414): lo stile dei numeri ATK/DEF (bianchi neutri, la cifra della Posizione attuale piu' grande, una riga, senza '/' sul telefono, ~10px) vale ORA ANCHE SENZA OLOGRAMMI (richiesta dell'utente). Con gli ologrammi (holo-on) restano in piu' solo bagliore azzurro, righe di scansione e sfarfallio. Suite completa non eseguita.

1.4.106 (cache v415): tolte le righe di scansione dai numeri ATK/DEF con gli ologrammi (restano bagliore azzurro e leggero sfarfallio). Suite completa non eseguita.

1.4.107 (cache v416): la cifra piu' piccola di ATK/DEF (0,8em -> 0,68em, con e senza ologrammi) e un filo di margine a destra di ogni cifra: il corsivo sporgeva e background-clip:text lo tagliava. Suite completa non eseguita.

1.4.108 (cache v417): (1) nomi lunghi nel riquadro dei duellanti: vanno a capo su DUE righe (poi ellissi, tooltip col nome intero) invece di essere troncati su una; la regola nowrap+ellipsis di '.player-info h3' pesava piu' di '.duelist-name', quindi serve '.player-info.side-player .duelist-name'. (2) Turno: al posto della sola corona, una targhetta dorata 'TURNO' con la corona (.turn-crown + ::after) accanto al nome di chi e' di turno, e il ritratto di chi NON lo e' si spegne un po' (saturazione/luminosita'). Niente pulsazione (scartata prima dall'utente). Suite completa non eseguita.

1.4.109 (cache v418): indicatore di turno RIFATTO (la targhetta 'TURNO' scritta era brutta, parola e forma): medaglione tondo d'oro con la corona dentro, doppio anello e bagliore fermo, in riga col nome (nowrap), piu' un filo d'oro sotto il nome che sfuma verso l'interno dello schermo; ritratto di chi non e' di turno spento. Nomi lunghi fino a 3 righe. Suite completa non eseguita.

1.4.110 (cache v419): (1) contatore dei turni delle carte a durata (Spada Rivelatrice & co., .field-turns-badge): non e' piu' una pillola verde SOTTO la carta ma un numero luminoso SULLA carta, verso il basso, stesso linguaggio dei numeri di Catena/LP (verde); con gli ologrammi accesi (.holo-on) diventa azzurro con bagliore e sfarfallio. (2) Barra delle fasi piu' leggibile (richiesta dell'utente): la fase ATTUALE ha un disco scuro del colore del campo con anello chiaro e l'etichetta bianca col filo sotto, la PROSSIMA cliccabile un anello acceso attorno all'icona (l'etichetta 'VAI ›' c'era gia'), le altre piu' spente (fatte 0,45, non raggiungibili 0,2). Restano le regole dello spec phase-stepper-responsive (icona con glow animato sulla fase attuale, niente sfondo sul step, cliccabile senza sfondo sul badge). Suite completa non eseguita.

1.4.111 (cache v420): barra delle fasi come BARRA DI AVANZAMENTO (richiesta dell'utente): niente scritte VAI/ORA/segni; sotto ogni fase un segmento (.phase-step::before): spento = da fare, colore del campo = fatta, chiaro e luminoso = attuale, che si riempie da sinistra quando lo diventa (aseRiempi). Fatte e non raggiungibili si spengono su badge ed etichetta, non sullo step (o si spegnerebbe anche il segmento). Spec phase-stepper-responsive aggiornato (niente VAI/ORA, segmento da 3px, opacita' letta dal badge). Suite completa non eseguita.

1.4.112 (cache v421): la barra di avanzamento delle fasi e' CONTINUA, non a segmenti (richiesta dell'utente): un binario sottile sotto lo stepper dal centro della prima fase al centro dell'ultima (.phase-stepper::before) e un riempimento che avanza fino alla fase attuale, piu' chiaro verso la testa (::after, transizione di larghezza 0,65s). Le misure (--fase-x0/xn/x1, px) le scrive ggiornaBarraFasi() in game-flow.js (anche al resize): i passi hanno larghezze diverse. Insidia: le regole vecchie di .phase-stepper::before lasciavano 	op: 50% (la linea finiva in mezzo alle icone) e lo stepper ha overflow hidden (a bottom negativo spariva): servono top:auto e bottom:2px. Spec phase-stepper-responsive aggiornato. Suite completa non eseguita.

1.4.113 (cache v422): indicatore di turno = il NOME evidenziato (richiesta dell'utente dopo tre badge scartati: targhetta TURNO, medaglione con corona): il nome di chi e' di turno e' in oro con alone e filo d'oro sotto, l'altro e' al 60%. La corona (.turn-crown) resta nel markup, nascosta, perche' duel-session.js ci scrive l'icona. Il ritratto di chi non e' di turno resta un po' spento. Suite completa non eseguita.

1.4.114 (cache v423): indicatore di turno = SIMBOLO: l'Occhio d'oro (Wedjat, icona eye di icon-library, lo stesso del logo) accanto al nome di chi e' di turno, fermo, senza sfondo (scartati in fila: targhetta TURNO, medaglione con corona, nome evidenziato); l'altro duellante non ha nulla e il ritratto e' un po' spento. I Life Point di ENTRAMBI i duellanti sono bianchi con contorno azzurrino (--num-c rgb(150,225,255)); rosso/verde restano solo durante danno/cura. Suite completa non eseguita.

1.4.115 (cache v424): indicatore di turno = CORONA d'oro DAVANTI al nome di chi e' di turno (l'Occhio del 1.4.114 e' stato scartato; l'utente aveva detto 'una corona davanti al nome'). Lato giocatore il nome e' allineato a destra: #playerInfo .duelist-name torna in riga normale (era row-reverse) e .name-text ha width: max-content, cosi' la corona sta attaccata al testo. Insidia: una regola scritta sulla stessa riga di una precedente non veniva trovata da Replace con \n finale: controllare sempre che la sostituzione sia avvenuta. Suite completa non eseguita.

1.4.116 (cache v425, branch eature/campo-orizzontale, NON ancora in main): campo piu' grande sui telefoni in ORIZZONTALE tra 325 e 420px di altezza. Misurato su 7 schermi (807x325, 891x412, 740x360, 667x375, 640x360, 568x320, 800x360): --card-w: clamp(28px, min(6.2vh, 6.4vw), 118px) stava SEMPRE sul minimo (28px) fino a 450px di altezza, quindi un telefono da 412px aveva le carte da 28px come uno da 325 e usava il 43% della larghezza. Ora clamp(28px, min(calc(28px + (100vh - 325px) * 0.19), 6.4vw), 118px): 45px a 412 (+60%), 38 a 375, 35 a 360, 28 sotto i 330. Il tetto e' quanto le due mani coprono le file Magia/Trappola (max ~27-33%, come gia' sui telefoni piu' piccoli): con k piu' alto la copertura sale a 40-80%. **Insidia presa**: in una stringa PowerShell fra virgolette doppie \n NON e' un a capo: e' finito letterale dopo un commento CSS e ha invalidato la dichiarazione (le carte tornavano a 46px, quelle del breakpoint verticale). Il margine per andare oltre e' ridurre l'ingombro delle MANI (la mano del giocatore e' 50x73px, la meta' del campo): non fatto. Suite completa non eseguita.

1.4.117 (cache v426, branch eature/campo-orizzontale): provato sull'APK di debug sul telefono vero (891x411, SM-S928B): con pendenza 0,19 (carta da 44px a 411) all'utente sembrava 'troppo grande'. Ora 0,08: 35px a 411 (+25% su 28), 31 a 360. Per provare un APK di sviluppo: capacitor.config.json di C:\AndroidDev\YuGiOhGameAndroid con server.url = http://localhost:8080 (anche in ndroid/app/src/main/assets/), db reverse tcp:8080 tcp:8080, build con JDK 21 (JAVA_HOME=C:\AndroidDev\jdk21, gradlew assembleDebug --offline; con il 17 fallisce 'invalid source release: 21'); poi per pilotarlo db forward tcp:9223 localabstract:webview_devtools_remote_<pid> e Playwright connectOverCDP. Una page.goto mentre un duello e' aperto mostra il dialogo beforeunload 'Conferma navigazione' (va chiuso con un tap su ABBANDONA). La rotazione si forza con settings put system user_rotation 1 dopo ccelerometer_rotation 0 (e va rimessa a 1 a fine prova). Suite completa non eseguita.

1.4.118 (cache v427, branch eature/campo-orizzontale): **pulsante laterale delle fasi, stile Duel Masters** (SOLO telefono in orizzontale: max-width: 960px, max-height: 520px, landscape, pointer: coarse). La barra delle fasi resta nel DOM ma e' isibility: hidden (NON display: none: il suo spazio fra le due file di mostri serve ai numeri ATK/DEF di quella di sopra, altrimenti finivano sotto gli ologrammi di quella di sotto) e a destra del campo, a meta' altezza, compare un tondo (#phaseSideBtn) con l'icona e la sigla della fase attuale e un anello che si riempie con l'avanzare (--psb-p). Un tocco: con UNA fase raggiungibile la raggiunge, con piu' d'una apre un menu a pillole (Battaglia / Fine turno) a sinistra del tondo. Non ha regole sue: legge dalla barra nascosta quali fasi sono .clickable e chiama handlePhaseStepperClick (ggiornaPulsanteFasi/	occaPulsanteFasi in game-flow.js), quindi primo turno, Catena aperta e attacchi forzati valgono come prima. Spec pulsante-fasi-laterale (viewport 891x411 touch + desktop). Provato sull'APK di debug sul telefono vero (tondo e menu visibili e toccabili). Suite completa non eseguita.

1.4.119 (cache v428, branch eature/campo-orizzontale): (1) **box info carta a SINISTRA e piu' largo** nei telefoni in orizzontale (come Master Duel: carta e testo a sinistra, comandi di turno a destra): parte sotto la plancia dell'avversario, larghezza min(31vw, 278px) (il bordo destro resta a sinistra della mano), altezza fino al fondo; tocco fuori = chiude. (2) **Pulsante delle fasi vicino al campo**, non al bordo: posizionaPulsanteFasi() legge il bordo destro dell'ULTIMA CASELLA (non quello di #playerFieldBoard, piu' largo del campo) e scrive --psb-left; il menu lo segue. (3) **Il menu mostra TUTTE le fasi**: attuale in giallo (psm-attuale), raggiungibili accese (psm-attiva), le altre grigie e disabilitate (psm-spenta); si apre sempre, anche con una sola scelta o nel turno avversario. Spec pulsante-fasi-laterale aggiornato (sei voci, Battaglia grigia nel primo turno, tondo a meno di 40px dal campo). Provato sull'APK di debug: menu e box info visibili. Suite completa non eseguita.

1.4.120 (cache v429, branch eature/campo-orizzontale): (1) il tondo delle fasi NON copre nessuna casella (richiesta esplicita): sta subito FUORI dalla colonna destra delle caselle (destra + 5px), sulla cornice del campo, a meta' altezza; il menu si apre piu' a destra ancora (--psb-menu-left); lo spec controlla che nessuna .field-slot si sovrapponga al tondo. (2) Il box info carta si ferma PRIMA del campo: larghezza clamp(120px, --campo-sx - 14px, 278px), con --campo-sx = bordo sinistro della prima casella (scritto da posizionaPulsanteFasi). (3) **Gli ologrammi restano visibili col box info aperto** nei telefoni in orizzontale bassi (prima ody:has(.card-info-panel.visible) li azzerava sotto i 900px: li' il box sta a sinistra e non li copre); la regola vale ancora in verticale. (4) **Ologrammi piu' arretrati sulla carta** ovunque: sollevamento 0.32 -> 0.18 (compatte) e 0.35 -> 0.2 (ampie): la base scende dal 68% all'82% e la figura sporge meno sopra la carta (non copre piu' i numeri ATK/DEF e la barra della fila di sopra). Provato sul telefono vero (APK di debug). Suite completa non eseguita.

1.4.121 (cache v430, branch eature/campo-orizzontale): icone (.field-slot-icon: Cimitero, Extra Deck, Terreno) e numeri (.field-slot-count) delle zone speciali piu' piccoli nei telefoni in orizzontale (richiesta: 'prendi esempio dal numero sopra il Mazzo'): icona da ~26px a card-w * 0.5 (15-22px), numero da 15px a card-w * 0.27 (9-13px, come il contatore del Mazzo). Suite completa non eseguita.

1.4.122 (cache v431, branch eature/campo-orizzontale): **campo centrato fra le due mani in verticale su telefono** (segnalato dall'utente: 'un po' piu' in basso'). Causa: la mano del Bot ha ANCHE la classe .hand, quindi .hand { margin-bottom: box + 60px } le dava ~78px sotto che non voleva (la sua .hand--bot ne ha pochi): il campo si centrava fra 'mano Bot + 78px' e 'mia mano + 12px', cioe' 33px sotto il punto di mezzo (vuoto sopra 142px, sotto 76px su 411x891). Ora .hand--bot riporta il margine sotto a clamp(4px, 1.4vh, 12px) come quello sopra la mia mano: in proporzione (vh), niente pixel fissi. Misurato su 7 schermi (320x568 ... 430x932): i due vuoti differiscono di 6-10px (la mia mano e' piu' alta). Suite completa non eseguita.

1.4.123 (cache v432): **merge in main del branch eature/campo-orizzontale** (1.4.116-1.4.122, branch poi eliminato): campo piu' grande sui telefoni in orizzontale (--card-w in funzione dell'altezza, 35px a 411), pulsante laterale delle fasi con menu di tutte le fasi (fuori dalle caselle), box info carta a sinistra che si ferma prima del campo, ologrammi che restano col box aperto e piu' arretrati sulla carta, icone/numeri delle zone speciali piu' piccoli, campo verticale centrato fra le due mani. Per provare su telefono vero un APK di debug serve C:\AndroidDev\YuGiOhGameAndroid con server.url = http://localhost:8080 (l'ho lasciato cosi' FUORI dal repository: se serve tornare alla LAN va rimesso l'IP del PC). Suite completa NON eseguita sul merge.

1.4.124 (cache v433, branch `feature/multiplayer-specchio-raid`): **Duello a specchio in Multiplayer.** Regola della stanza decisa dall'host (campo `specchio` = packId dentro `room-config`, validato in `protocollo-mp.js`, rinviato ad ogni cambio da `inviaConfigHost`): con la spunta accesa nessuno usa il proprio mazzo e `MpPassoComune.prepara` lo sostituisce con quello del catalogo Starter/Structure (`mazzoSpecchio`, letto da `window.MP_SPECCHIO_ID`); il mazzo personale sparisce dalla sala e l'ospite vede la regola in sola lettura. Con lo specchio il parametro `origin` non si imposta (nessun blocco carte vietate). Nessun kind nuovo sul relay, motore non toccato. Spec `multiplayer-specchio` (due client veri). Suite completa non eseguita (provati `multiplayer-specchio`, `multiplayer-scelta-arena-dopo-ingresso`, `multiplayer-passo-comune`, `guardrail-protocollo-mp`, `guardrail-pagine-con-carte`). Il Raid cooperativo contro un Boss e' ancora da fare su questo branch.

1.4.125 (cache v434, branch `feature/multiplayer-specchio-raid`): **Raid cooperativo in Multiplayer.** Regola della stanza alternativa allo specchio (campo `raid` = id del Boss in `room-config`; Boss e Life Point comuni in `js/data/raid-db.js`). NON e' il duello a passo comune: ognuno gioca il PROPRIO duello contro il Boss (`mode=free`, `character`, `difficulty=Difficile` scritti da `applicaImpostazioniArena`, `MULTIPLAYER_MODE` falso, `MP_RAID` vero) nella stessa pagina della sala, per non perdere il collegamento. `js/multiplayer/mp-raid.js` osserva `gameState.botLP` ogni 400 ms e manda il TOTALE di danno inflitto (`kind: 'raid'`, tipo `colpo`/`fuori`; idempotente, un messaggio perso non sposta nulla); il compagno lo sottrae al proprio Boss, quindi a barra zero il normale controllo vittoria fa vincere entrambi. Il motore non e' toccato. **Il relay ha un tipo nuovo (`raid` in `GAME_ACTION_KINDS`): va ridistribuito su Render** (col merge in main); un relay vecchio scarta i messaggi in silenzio e la barra resta separata. Nel Raid vale ancora il Duello Libero: premi e record come contro quel Duellante. Spec `multiplayer-raid`. Suite completa non eseguita.

1.4.126 (cache v435, branch `feature/multiplayer-specchio-raid`): **Raid: tasto 👁 per guardare il campo del compagno (sola lettura).** Tutto dentro `js/multiplayer/mp-raid.js` + CSS, motore NON toccato: dal `gameState` si LEGGE soltanto e si manda (`kind: 'raid'`, tipo `campo`, solo su cambiamento) una fotografia PUBBLICA — mostri e Magie/Trappole dei due Terreni (il suo e quello del suo Boss), LP, conteggi di mano/Mazzo/Cimitero; le carte coperte viaggiano senza identita' e la mano senza carte. Il pannello disegna carte con uid finti (`raid-...`) con `createCardElement` e viene RIMOSSO dal DOM alla chiusura, cosi' nessun codice del duello (ologrammi, riscontri, ricerche per uid) puo' incontrarle. Forma validata in `protocollo-mp.js` (stesso tipo `raid`, nessun kind nuovo sul relay rispetto a 1.4.125). Spec `multiplayer-raid` esteso (due carte viste, la coperta non rivela il nome, nessun uid del duello, campo dell'host intatto). Suite completa non eseguita.

1.4.127 (cache v436, branch `feature/multiplayer-specchio-raid`): **Raid: visore del campo dei compagni rifatto** (`js/multiplayer/mp-raid-campo.js` + `js/ui/mp-raid-campo.css`, tolto dal file di `mp-raid.js`). Il tasto e' il RITRATTO del compagno (con il simbolo delle carte e, su desktop, il nome), uno per compagno fino a 3 (`id` per compagno, `MAX_COMPAGNI`); in verticale su telefono sta nella fascia fra le Magie/Trappole del giocatore e la sua mano (calcolata sui rettangoli di `#playerHand` e delle `.field-slot` del giocatore a ogni passo), altrimenti a sinistra a meta' altezza. Il pannello mostra il NOME del giocatore, il Boss IN ALTO e le carte del compagno IN BASSO (mostri e Magie/Trappole), la mano di entrambi come dorsi a ventaglio col numero, e un riquadro informazioni NOSTRO (non il box info del duello) al tocco su una carta; le carte COPERTE del compagno viaggiano con l'identita' (alleato) e si aprono con la 'i', quelle coperte del suo Boss no. Stesso principio di prima: dal gameState si legge soltanto, carte con uid finti, pannello tolto dal DOM alla chiusura. Spec `multiplayer-raid` aggiornato. Suite completa non eseguita.

1.4.128 (cache v437, branch `feature/multiplayer-specchio-raid`): **Multiplayer in tre modalita' dal menu.** `Multiplayer` in `index.html` e' ora un sottomenu: Duello, Duello a Specchio, Assalto al Boss (nome del Raid), con la tabella unica `js/multiplayer/mp-modi.js` (id, nome, icona, titolo, descrizione) letta da menu e sala. Ogni voce apre `multiplayer.html?modo=<id>`: la sala cambia titolo/descrizione, nasconde i selettori delle altre regole, e l'host ha la regola della modalita' gia' accesa (spunta nascosta, resta la scelta del mazzo/Boss); un ospite che entra da un'altra modalita' riceve un avviso, non un blocco. Senza `?modo=` la sala e' completa come prima (e' quella usata dai test e dai vecchi collegamenti). Nessun cambio di protocollo: `specchio` e `raid` restano i campi di `room-config`. `multiplayer.html` carica ora anche `card-renderer.js`/`inclinazione.js`/`artwork-alternativi.js` per il visore dei compagni (l'arena salta gli script gia' presenti; lo vuole `guardrail-pagine-con-carte`). Spec `multiplayer-modalita-sala`. Suite completa non eseguita.

1.4.129 (cache v438): **merge in main di `feature/multiplayer-specchio-raid`** (1.4.124-1.4.128, branch poi eliminato): Duello a specchio, Assalto al Boss (Raid cooperativo, barra Life Point comune, visore del campo dei compagni) e sottomenu Multiplayer a tre modalita'. **Il relay (`server/server.js`) ha un tipo nuovo, `raid`: si ridistribuisce da solo su Render col push su `main`; finche' non e' attivo il Raid funziona ma le due barre restano separate** (un relay vecchio scarta i messaggi). Suite completa NON eseguita sul merge (provati gli spec multiplayer, i guardrail del protocollo e delle pagine con carte, il service worker).

1.4.130 (cache v439): **Raid, ritocchi dopo il merge.** La barra del Boss e' su UNA riga (nome e LP a sinistra, 'Tu / Compagno' a destra) e copre meno la mano coperta dell'avversario; a duello finito (schermata di vittoria/sconfitta) i tasti dei compagni e il loro pannello restano sopra di essa (`body:has(#duelOutcomeOverlay)`), cosi' chi e' a terra puo' guardare chi continua. Il sottomenu Multiplayer di `index.html` e' stato provato fino in fondo (voce -> `multiplayer.html?modo=raid` con titolo e regole giuste). **Verificato sul relay pubblico (Render) subito dopo il push di 1.4.129: la regola del Raid arriva all'ospite ma la barra comune NON passa (il relay non e' ancora ridistribuito col tipo `raid`)**: da ricontrollare. Suite completa non eseguita.

1.4.131 (cache v440): **Il Raid funziona SENZA ridistribuire il relay** (Render free: minuti di build esauriti, 'Build canceled'). I messaggi del Raid non hanno piu' un tipo proprio: viaggiano dentro un `ready` con il campo `raid` (`{ tipo: colpo|fuori|ripeti|campo, ... }`), perche' il relay in produzione scarta in silenzio i tipi che non conosceva al suo ultimo deploy, mentre lascia passare un campo in piu' dentro un tipo noto. Forma in `controlloRaid` (`protocollo-mp.js`, chiamata dal controllo di `ready`); la sala smista `ready`+`raid` verso `MpRaid.ricevi` PRIMA di leggerlo come dichiarazione di pronto (`mp-lobby.js`); il tipo `raid` e' tolto da `CONTROLLI` e da `GAME_ACTION_KINDS`, quindi `server/server.js` e' tornato identico a quello gia' in produzione e **non serve alcun redeploy** (le note di 1.4.125/1.4.126/1.4.129 che parlano di un tipo nuovo sul relay non valgono piu'). **Regola per il futuro:** finche' i minuti di build di Render sono un vincolo, un messaggio nuovo si fa viaggiare come campo in piu' di un tipo esistente. Provato sul relay PUBBLICO con due client: barra comune del Boss e visore del campo del compagno funzionano. Suite completa non eseguita.

1.4.132 (cache v441): **Raid su schermi da telefono piccoli.** Misurato su 6 misure (320x568, 360x640, 375x667, 390x844, 412x915, 430x932) con il campo del giocatore pieno: a 375x667 e inferiori il tasto del compagno finiva sopra la colonna Mazzo/Cimitero (e a 320x568 anche sulla mano) perche' la fascia fra Magie/Trappole e mano e' piu' stretta del tasto. Ora la fascia si calcola sulle caselle che cominciano sopra la mano (anche se sconfinano sotto la sua cima) e, se e' piu' stretta del tasto, il tasto va SOTTO la mano, che e' libera: su tutte e sei le misure non tocca piu' nessuna carta o casella. Su schermi stretti (max 600px) la barra del Boss mostra solo i LP (nome e 'Tu/Compagno' sono altrove) e sta spostata per non coprire il nome del Boss ne' il tempo. Resta da provare su un telefono vero (nessuno era collegato via adb). Suite completa non eseguita.

1.4.133 (cache v442): **Pulsante delle fasi anche in VERTICALE su telefono** (richiesta dell'utente: lo stesso tondo dell'orizzontale, 'in mezzo tra le carte in mano e l'inizio del field del giocatore'). Stessa condizione pointer: coarse ma con `max-width: 600px` e `orientation: portrait`: la barra delle fasi diventa invisibile (resta nel layout, come in orizzontale) e il tondo sta al centro della fascia fra la casella piu' bassa del giocatore che parte sopra la mano e la cima della mano (`--psb-cx`/`--psb-cy`, scritti da `posizionaPulsanteFasi`); su schermi bassi la fascia e' piu' stretta del tondo e questo ne copre un po' i bordi. Il menu si apre in COLONNA sopra il tondo, con le stesse sei voci e le stesse regole (passa da `handlePhaseStepperClick`). Spec `pulsante-fasi-laterale` esteso (390x844 e 360x640: centrato, a meta' fascia, menu sopra e dentro lo schermo). Su desktop nulla cambia. Suite completa non eseguita.

1.4.134 (cache v443): **Premi del Raid** (decisione dell'utente: 500 Crediti e 2 Stelle dell'Esagono). `Rewards.forRaid` (`js/economy/rewards.js`, costanti `CREDITI_RAID`/`STELLE_RAID`) paga chi vince il PROPRIO duello contro il Boss con la barra comune (`window.MP_RAID`), e in quel caso SOSTITUISCE il premio di un Duello Libero normale (niente 'Prima vittoria di oggi' ne' crediti di vittoria): la scelta e' in `DuelSession.finish` (`js/duel-session.js`), prima di `Rewards.forDuel`. Le due voci compaiono nella schermata finale con il motivo ('Raid cooperativo vinto: <Boss>'). Una sconfitta o un abbandono restano quelli di sempre (partecipazione di Duello Libero / niente premio); chi era gia' a terra quando il compagno chiude il Boss non prende nulla. Record e Sfide contano come per qualunque vittoria contro quel Duellante. Il testo della modalita' in `mp-modi.js` annuncia il premio. **Nota:** altre cose possono pagare nello stesso istante (Sfide e missioni completate dalla vittoria), per questo il test controlla 'almeno' 500/2 e le voci spiegate. Limite noto: il client del compagno e' fidato per i danni (clamp alla barra, ma un compagno scorretto puo' chiudere il Boss e far pagare l'altro): nessun controllo server possibile senza cambiare il relay. Spec `multiplayer-raid` esteso. Suite completa non eseguita.
