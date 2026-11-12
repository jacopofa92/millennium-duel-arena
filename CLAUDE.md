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


## Regole per il codice nuovo (sintesi; le motivazioni sono in docs/storia/)

- **Modalita' nuove fuori dal motore**: vivono in `js/modes/` e avvolgono la preparazione del duello (`preparaManiIniziali`); non si toccano `js/engine/`, effetti delle carte, IA, dati carte. Lo sorveglia `guardrail-modalita-fuori-dal-motore`. Un aggancio nuovo nel motore va approvato dall'autore e dichiarato nel guardrail.
- **Regole senza interfaccia**: un file di regola non usa `document.` (si passa da `PortaUI`) e non chiama per nome il disegno: avvisa col canale `EventiDuello` (`emetti`/`attendi`/`chiedi`, elenco chiuso `EVENTI`). Ogni scelta passa da `Decisioni.chiedi`, mai da `DuelEngineUI`.
- **'player' e 'bot' sono solo i nomi dei due posti**: chi li controlla lo dice `Tavolo.controllore(posto)` ('persona'/'ia'/'remoto'); per decidere chi sceglie si chiede a `Tavolo`, mai al nome. Stato e IA si leggono con gli accessori di `Tavolo` (`Tavolo.mano(io)`...).
- **Multiplayer a passo comune**: i due client eseguono tutta la partita e si scambiano comandi (`Comandi.esegui`) e decisioni. Quindi: casualita' di gioco solo da `ctx.random`/`Casuale` (mai `Math.random` nelle regole), timer delle regole da `PassoComune.dopo`, una mossa locale solo a duello fermo, uid deterministici. Un messaggio nuovo sul relay si fa viaggiare come campo in piu' di un tipo esistente.
- **Costi in Life Point si sottraggono direttamente** (`gameState[lpKey] -= n`), mai con `dealDamage` (che e' danno: blocchi, Sosia, posa di danno).
- **Scelte del giocatore**: se il testo dice 'scegli', la scelta e' del giocatore (helper in `card-effects.js`: `chooseFieldCardTarget`, `searchGraveyardWithChoice`, `offerHandDiscardChoice`, `chooseOption`...), non il primo candidato. Un picker asincrono dentro un handler che qualcuno aspetta va chiesto con `attendiScelta`.
- **Una carta nuova**: registrare in `card-effects-N.js` (si trova con `register(<id>`), dichiarare il bersaglio (`dichiara: true`/`declareTarget`), `fromZone` su ogni `specialSummon`, `aiCanActivate` se ha un costo o una scelta che il bot non sa valutare, `graveyardMoveNegated` per spostamenti dal Cimitero scritti a mano. Dopo `cards.json`: `node scripts/build-cards-data.js`.
- **Script nelle pagine**: la lista e' in `scripts/gruppi-script.js`; `npm run sync-scripts` riallinea gli HTML e `sw.js` (non editarli a mano). Ogni pagina che carica `card-renderer.js` carica anche `inclinazione.js` e `artwork-alternativi.js`.
- **UI**: superficie dei riquadri = `--sup-riquadro`/`--sup-bordo`; icone del tema (`icon-library.js`, `EmojiTema`) al posto delle emoji; un effetto visivo si verifica guardando uno screenshot, non solo il DOM; niente rimbalzi negli atterraggi 3D.
- **Versione e cache**: ogni rilascio incrementa la versione e la cache in `sw.js`. In `main` si lavora senza branch solo per modifiche piccole; refactor ampi su branch dedicato, poi merge su richiesta esplicita.

## Insidie frequenti (elenco breve)

- **PowerShell 5.1**: `Get-Content` legge in ANSI e riscrivere in UTF-8 distrugge gli accenti; `Set-Content -Encoding utf8` aggiunge un BOM. Per modificare file del progetto usare gli strumenti di modifica, o `[System.IO.File]::ReadAllText(p, [Text.Encoding]::UTF8)`. Git e' in `D:\Programmi\PortableGit\bin\git.exe` (non e' nel PATH).
- **Test**: `waitForFunction(fn, arg, options)` (le opzioni sono il TERZO argomento); mai `waitForTimeout` fissi per aspettare il motore; la cascata di fasi d'apertura puo' finire dopo `freezeNaturalGameLoop`; `page.evaluate` concede un gesto implicito all'audio (non prova l'autoplay).
- **Service Worker**: va provato contro il comportamento reale del sito (redirect di Cloudflare compresi) e su un dispositivo; un'immagine che cambia contenuto con lo stesso nome richiede di cambiare il suffisso di `MEDIA_CACHE`.
- **Un guardrail statico che boccia** va prima verificato contro il codice: puo' essere il guardrail a essere rimasto indietro (elenco di file scritto a mano).
- **Telefono vero**: `adb reverse tcp:8080`, server statico che inietta `AUTH_GATE_SKIP`, Chrome + `connectOverCDP`; la scheda gia' aperta tiene il JS vecchio.

## Archivio storico (docs/storia/)

La cronologia dettagliata di decisioni, fix e versioni NON si carica a ogni sessione: si cerca con grep quando serve capire il perche' di una scelta.

- `docs/storia/INFRASTRUTTURA_E_DECISIONI.md`: audit di sessione, meccanismi generici del motore, Multiplayer, Sfide, Storia, cloud, IA (fino alla 1.4.143).
- `docs/storia/VERSIONI_1.4.md` (da 1.4.144), `VERSIONI_1.5.md`: registro versione per versione, con cache e spec toccati.
- `docs/storia/AUDIT_E_INSIDIE_TEST.md`: insidie dei test, audit dei duellanti, e le voci 1.4.68 - 1.6.x (cercare `^1\.`).
- `docs/storia/CARTE_CON_LIMITI_NOTI.md`: meccanismi generici per le carte con limiti, checkpoint di targeting, finestra di priorita'.
- Piani aperti e lavori da fare: `docs/planning/WORK_IN_PROGRESS.md`, `docs/planning/VALUTAZIONE_2026-11-12.md`.


## Git

Autore singolo, storia pulita. Pattern osservato in sessione: commit
mirati per singolo cambiamento logico, push subito dopo ogni commit
(non accumulare commit locali non pushati) — a meno di istruzione
esplicita diversa dell'utente.

1.6.24 (cache v673, su `main`): **primo avvio (bottega del nonno).** Dietro tutte le scene c'e' uno sfondo FISSO (`.ob-fondo-fisso`, z-index 20030): fra una scena e l'altra riaffiorava la schermata di accesso. Durante la bottega suona la musica del Negozio (`16. Duel Ground.mp3`, poi si rimette quella di prima). Se l'app si riapre prima di aver concluso il primo avvio (`tutorial.daFare` senza `completata` e nessun segno di sessione `ygoIntroInCorso`, che `Onboarding.avvia` scrive a fine bottega) la bottega riparte DA ZERO invece di saltare alla lezione (`obbligaLezioneSeDaFare` in index.html): rifare la bottega riscrive nome e mazzo. Spec `primo-avvio-bottega-del-nonno`. Suite completa non eseguita.

1.6.25 (cache v674, su `main`): **icone a tema al posto delle emoji di sistema.** `js/ui/icon-library.js` ha 19 icone di interfaccia nuove (warning, info, lock, hourglass, heart, fist/hand/scissors per la morra, key, flag, plug, cart, list, tag, users, clock, minus, undo, ban) e `js/ui/emoji-tema.js` le mappa (`MAPPA`) e ha la nuova modalita' `EmojiTema.automatico({ solo?, escludi?, fallback? })`: idrata la pagina e poi solo i nodi aggiunti o cambiati (il testo scritto dopo da JS si converte da solo; `escludi` lascia com'e' un sottoalbero, `solo` limita a certi contenitori). Attivata (script + chiamata dopo `icon-library.js`) su index, profilo, crea-carta, regole, admin, creazione-deck, storia, tag, caccia-boss, rivincite, impostazioni, multiplayer, tutorial-tag, duello-libero e, con `solo` sui riquadri e prompt, nel duello. La morra (`duel-rps.js`) e il riquadro del Tag (`tag-mode.js`) usano le icone direttamente. **Lasciati apposta come emoji**: il registro del duello (`card-effects-*.js`, motore: circa 1.500 righe di cronaca) e le carte. Un'emoji nuova si mappa in `GRUPPI` di emoji-tema.js, non nell'HTML. I test che leggevano il glifo (`storia-livelli`, `storia-scene-cinematiche`) ora accettano anche l'icona. Spec `emoji-a-tema`. Nello stesso giro: la bottega del nonno tiene lo sfondo fisso fino al cambio pagina (non riaffiora il login prima della lezione) e il duello Tutorial (`mode=tutorial`) suona `07. Preliminary Face-Off` (musica dei duelli del primo arco anime).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.