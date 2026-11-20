# AGENTS.md — istruzioni per un agente che lavora su Yu-Gi-Oh! Millennium Duel Arena

Duello Yu-Gi-Oh in HTML/CSS/JavaScript puro: nessun framework, nessun
bundler, nessuna build. Ogni pagina `.html` si apre anche da `file://`, con
`<script src>` classici in un ordine che fa parte dell'architettura. Autore
unico (Jacopo, jacopofa92). Repository **privato**
`jacopofa92/millennium-duel-arena` (prima `YuGiOhGame`). Branch di lavoro:
`main`. A ogni push Cloudflare ricrea e pubblica la copia minificata del
gioco (GitHub Pages non si usa più) e Render ridistribuisce il server
Multiplayer: **leggi `PUBBLICAZIONE.md`** per come funziona e per l'elenco
completo di cosa è cambiato il 2026-10-11.

## Prima di toccare qualcosa, leggi nell'ordine

0. `PUBBLICAZIONE.md` — dove gira il gioco, cosa succede a ogni push, cosa
   fare aggiungendo file o cartelle, e i cambiamenti del 2026-10-11.
1. `PROJECT_MAP.md` — la mappa corrente. In cima c'è la sezione
   **«Passaggio di consegne (2026-10-06)»**: cosa è stato rifatto negli
   ultimi giorni, dove sta, cosa resta da fare.
2. `docs/planning/WORK_IN_PROGRESS.md` — il piano di attacco con le voci aperte `[ ]`.
3. `CLAUDE.md` — dal 2026-11-12 è BREVE (regole e convenzioni): la cronologia
   vecchia è in `docs/storia/` (cerca la parola chiave dell'area che tocchi
   con grep invece di leggere tutto). Dove contraddice il codice, ha ragione
   il codice.
4. `docs/architecture/GUIDA_RIUTILIZZO.md` prima di un refactor ampio.
5. `docs/planning/VALUTAZIONE_2026-11-12.md` — stato dei lavori aperti e
   consigli su quale lavoro conviene a quale modello.

## Regole dell'utente (non negoziabili)

- **Rispondi e scrivi in italiano**: chat, commenti nel codice, messaggi di
  commit, documentazione.
- **Non lanciare la suite completa** (`npm test`) di tua iniziativa: la
  decide l'utente. Lancia gli spec toccati o a rischio con
  `node tests/run-all.js <parte-del-nome>` e scrivi nel messaggio di commit
  "Suite completa non eseguita."
- Commit mirati, uno per cambiamento logico, **push subito dopo** su `main`.
  Mai `--no-verify`: se il pre-commit ferma un commit, si corregge la causa.
- I refactor grandi o rischiosi vanno su un branch dedicato, e si uniscono a
  `main` solo quando l'utente lo chiede (dopo la suite completa).
- Non fermarti a chiedere "continuo?" a ogni passo di un lavoro già chiesto.
  Chiedi solo per decisioni che spettano davvero all'utente.
- Effetti delle carte: riferimento primario YGOPRODeck. Le Trappole si
  attivano solo dopo essere state Settate. Carte duplicate o imprecise si
  cancellano, non si segnalano.
- Commenti generosi sul PERCHÉ (vincoli nascosti, bug evitati): il codice
  deve restare modificabile a mano senza un assistente.

## Comandi

```text
node scripts/check-syntax.js          # node --check su tutti i .js, 2 secondi
node tests/run-all.js <nome>          # spec mirati (Playwright)
node scripts/sync-script-groups.js    # riscrive i gruppi di <script> nelle pagine
npm run typecheck                     # tsc sui file con // @ts-check
node scripts/build-cards-data.js      # dopo OGNI modifica a data/cards.json
node tools/duello-senza-testa.js      # duelli IA contro IA in Node (--avversario X --livello hard --partite 12 --seme 100)
node tools/audit-attivazioni-ia.js    # controllo a tappeto delle attivazioni del bot (--reattive, --mostri, --mai)
node tools/duello-gemello.js          # due motori a passo comune in Node
node tools/impronta-partite.js f.txt  # impronta di 60 partite (prima/dopo un refactor)
npm run pubblica                      # copia minificata in dist/ (la fa anche Cloudflare a ogni push)
npm run verifica-pubblicazione        # confronta ogni pagina di dist/ con l'originale
```

- Una cartella nuova letta dal gioco va aggiunta a `CARTELLE` in
  `scripts/pubblica.js`, o online mancherà.
- La suite su GitHub parte solo a mano o su pull request (repository privato,
  2.000 minuti al mese): a ogni push gira solo il controllo di sintassi.

## Trappole tecniche già pagate

- **PowerShell 5.1**: `Get-Content -Raw` legge in ANSI e riscrivendo in UTF-8
  distrugge ogni accento ("è" diventa "Ã¨"); `Set-Content -Encoding utf8` <!-- [ok-accenti] -->
  aggiunge un BOM. Modifica i file con gli strumenti di modifica, o leggi/scrivi
  con `[IO.File]::ReadAllText/WriteAllText` e UTF-8 senza BOM. I file del
  progetto sono in CRLF.
- Git su questo PC è portatile: `D:\Programmi\PortableGit\bin\git.exe`.
- `js/data/cards-data.generated.js` non si modifica a mano: si rigenera.
- Un `const` a livello di script NON è una proprietà di `window`: un modulo
  che altri leggono da `globalThis` va pubblicato anche lì.
- Le liste di `<script>` delle pagine si cambiano in `scripts/gruppi-script.js`
  e si riscrivono con `sync-script-groups.js` (il pre-commit lo controlla).
- `sw.js` precarica l'app: un file nuovo va nella sua lista, e dopo una
  modifica visibile ai giocatori si alza `CACHE_NAME`.

## Lezioni dalla verifica del 2026-11-19 (1.9.3-1.9.5)

Un controllo a tappeto dopo ~100 commit ha trovato quasi solo **test rimasti
indietro**, e pochi bug veri. Per non ripeterlo:

- **Cambiando una durata, un testo o un premio, cerca gli spec che li
  assumevano**: `grep -rn "<testo vecchio>" tests/specs`. Erano rossi per
  questo: premi della Settimana (Facile 600), testo «Raid cooperativo vinto»
  (ora «Assalto al Campione vinto»), badge della regola tolto dalla HUD,
  `DuelEngine.specialSummon` (esiste solo `DuelEngine.actions.specialSummon`),
  attese fisse di 400/680 ms.
- **Non usare attese fisse dopo una mossa**: una persona non muove mentre una
  scena è in corso (`Comandi.esegui` rifiuta, di proposito, vedi
  `azioni-bloccate-da-animazione`). Un test che gioca come una persona deve
  aspettare che il duello sia libero e poi riprovare (esempio:
  `fineTurnoQuandoLibero` in `multiplayer-passo-comune.spec.js`).
- **Più scene = più blocco**: ogni Evocazione di Livello 7+ blocca il duello
  per sollevamento + impatto (~1,5 s); tre di fila ~25 s. Gli spec che
  aspettano la Catena devono tenerne conto.
- **Un invio di rete scartato in silenzio**: `net.sendAction` non manda un
  messaggio che `Contenuti.azioneMultiplayer` giudica non consentito
  all'account (carte WW1/WW2/Extra). Una scelta casuale (mazzo, campo) deve
  pescare SOLO fra le opzioni consentite, o l'altro client non riceve nulla.
  Un test Multiplayer instabile (1 volta su 5) va riprodotto in ciclo con i
  fotogrammi WebSocket (`page.on('websocket')`), non rilanciato finché passa.
- **Un test che passava e ora no**: `git bisect run` con uno script che lancia
  lo spec (~1 minuto a passo) trova il commit in pochi minuti. Mai da `main`
  sporco: prima `git stash`.
- **I test non devono dipendere da internet**: «Crea stanza» senza indirizzo
  usa il server di produzione su Render. Negli spec si passa un relay locale
  (`startRoomServer()` in `tests/helpers/local-servers.js`).
- **Un effetto visivo si prova con fotogrammi, non solo col DOM**: si
  mettono in pausa le animazioni (`document.getAnimations()`, `currentTime`)
  e si fotografa. Gli ologrammi WebGL esistono solo da http/https, non da
  `file://`: per provarli serve un piccolo server statico.
- **Tipi**: `// @ts-check` copre ormai tutti i file del motore e degli effetti
  (90 file, il minimo sale solo: `guardrail-tipi`). Un file nuovo del motore
  parte con `// @ts-check`; i globali nuovi si dichiarano in
  `types/motore.d.ts` o `types/globali.d.ts`. `querySelector` restituisce
  `HTMLElement` (dichiarato in `types/motore.d.ts`).
- **IA e carte che negano**: `AI_MEDIUM.chooseChainResponse` non deve
  trattare come «rimozione a bersaglio» una carta che nega un'Evocazione
  (Oppressione Reale): il testo dice «distruggerli» ma non è una rimozione.
  `node tools/audit-attivazioni-ia.js --reattive --non-scattate` elenca le
  Trappole che il bot non usa mai e ora distingue `[OFFERTA e scartata dal
  bot]` (veto dell'IA, di solito voluto) da `[mai offerta]` (il motore non la
  propone: qui stanno i bug). Prima di leggere un elenco, controlla quali
  carte stanno davvero in un mazzo di duellante (le altre contano meno).
  Trovate così due carte morte: **Spostamento (622)**, il cui `canActivate`
  guardava solo l'effetto di Magie/Trappole e non rispondeva mai a un
  attacco, e **Ombra degli Occhi (438)**, che aspettava un'Evocazione mentre
  un Set coperto non ne apre la finestra (ora `onOpponentSet`). Lezione:
  `findTriggerCandidates` filtra OGNI candidata con `def.canActivate`: una
  carta con due metà (attacco ed effetto) deve riconoscere entrambi i contesti.
- **Una carta «morta» si riconosce dal testo contro il codice**: un hook
  che nessuna finestra apre (Ombra degli Occhi aspettava un'Evocazione, ma un
  Set non la apre), un `canActivate` che non conta le carte Set (Spolverino
  dell'Arpia, Ritorno Totale, Attacco Magico Oscuro: «tutte le Magie/Trappole»
  includono quelle coperte, serve `includiCoperte: true`), una Trappola
  Continua senza `activate` che nulla può girare (Oppressione Reale da Set),
  un nome rimasto nel testo di un'altra carta dopo una rinomina, una Trappola
  Normale con un'azione di fase che `firePhaseTrigger` (solo carte scoperte) non
  fa scattare da Set: **Eruzione Vulcanica (817)**, risolta con l'opt-in
  `firesFromFaceDown` sulla definizione (+ `includiCoperte` per Uccello Tornado).
  **Rete di sicurezza permanente (1.9.9)**: `tests/data/carte-mai-attivabili.json`
  congela l'elenco `--mai`; lo spec `ia-attivazioni-sensate` fallisce se una carta
  NUOVA ci compare (nessun campo di prova la rende attivabile = sospetta carta morta).
  Dopo averla guardata, `node tools/audit-attivazioni-ia.js --mai --aggiorna-registro`.
- **Accesso e registrazione del dispositivo (1.9.10)**: «accesso da un altro dispositivo» senza un altro dispositivo
  era un ricaricamento di pagina che tagliava `claim_active_device_session` ancora in volo. Dopo «cancella dati» la
  cache dei permessi (`ygoContentAccess:<uid>`) e' vuota, quindi al primo accesso i contenuti risultano cambiati,
  `rememberContents` lancia `contenuti:aggiornati` e `content-access.js` ricarica. Ora `signIn` tiene l'evento fermo
  (`accessoInCorso`, `segnalaContenutiAggiornati`) finche' il chiamante non chiama `CloudSync.concludiAccesso()`, cioe'
  a salvataggio caricato (index.html, dopo `afterGateSignIn`); un timer di 30 s e' solo la rete di sicurezza. Come
  l'abbiamo visto: i log di Supabase
  (`query_logs`, sorgenti `auth_audit_logs` e `edge_logs`) mostravano login e logout dallo STESSO telefono a un
  minuto di distanza e un `OPTIONS claim_active_device_session` senza il `POST` che lo segue. Lezione: **un
  ricaricamento di pagina non deve mai partire dentro un flusso asincrono che deve ancora scrivere sul server**; chi
  ricarica (`location.reload`) va cercato quando una richiesta ha il preflight ma non il corpo.
- **Meno distruzione nei mazzi Difficile + regia della mano (1.9.11)**: segnalazione «in difficile ogni avversario ha
  sempre Armatura Sakuretsu, Cilindro Magico...: frustrante e ripetitivo». In 51 mazzi Difficile Sakuretsu e/o Cilindro sono
  sostituiti da carte che non distruggono (tabella `RITOCCHI_MENO_DISTRUZIONE` in `character-decks.js`, applicata dopo
  `CORREZIONI_LIMITI`). **Vincolo dell'utente: il Difficile non deve diventare piu' facile.** Le sole sostituzioni lo rendevano
  piu' facile di ~2,6 punti; per 34 duellanti lo rimette la REGIA DELLA MANO (`js/modes/regia-mano.js`, lista in
  `js/data/regia-mano-db.js`, stessa logica e stessi agganci dell'Incubo: `partita-azzerata` + `inizio-turno`, nessun
  aggancio nuovo nel motore). Attiva solo in Difficile, in Duello Libero/Storia/Torneo, mai in Multiplayer (i due client devono
  riordinare il Mazzo allo stesso modo: servirebbe il seme di `Casuale` e un test a due client), Tag (anche `mode=story&tag=1`),
  Torre, Caccia, Puzzle, Rivincite, Settimana, Tutorial, Incubo. **Misura** (strumento: copia di `tools/audit-matrice-completa.js`
  solo Difficile, 17 deck giocatore x 61 duellanti x 50 duelli, semi nuovi 770000, codice vero): vittorie del giocatore
  30,8% -> 30,2%; trappole che distruggono o rimandano il danno attivate per duello 0,74 -> 0,42; nessun duellante piu' facile
  di 4 punti (Odion -8,0, Rex -5,6, Alto Mago Martis -4,4 diventano piu' duri: accettato dall'utente). Cosa NON va toccato:
  **Forza Riflessa (+11 punti se tolta) e Buco Trappola (+8) reggono la difficolta'**, Annulla Attacco, Sakuretsu e Cilindro
  valgono 1-3 punti. Non ritoccati: Gansley (Cilindro e' il suo Deck Master), Yami Yugi (Cilindro a Battle City, ep. 66),
  Bandit Keith, Dark Nite, Gozaburo, Alto Mago Anubisius (+4 o piu' con la sostituzione), Tristan, Esparoba, Desert Mage,
  Crump (nessuna alternativa a parita'). **Metodo che ha funzionato** (riusabile per ogni ritocco ai mazzi): misurare prima
  carta per carta cosa vale ogni carta toccata; scegliere le alternative su un giro di semi e CONVALIDARE su semi nuovi (la
  scelta sullo stesso giro sovrastima: alcuni duellanti «a posto» risultavano +4/+6); riportare al mazzo attuale chi resta
  fuori; i numeri per singolo duellante hanno un rumore di 2-3 punti a 850 duelli per lato. **Bug trovato per caso e NON
  corretto**: Macchina del Tempo (478) fa rientrare «Roccaforte della Fortezza Movente» (849, Trappola-mostro) e la lascia
  nella zona Mostri come carta non-mostro (invariante del duello senza testa: mazzo di Odion contro lo Starter di Yugi, ~4-8
  duelli su 51.000).
- **Chi chiede l'attesa deve poterla chiudere su OGNI strada**
  (`attendiScelta`): `chooseFieldCardTarget` può rifiutare in silenzio (il bot
  non distrugge una sua carta) e allora senza `onNessunaScelta` la Catena resta
  «in risoluzione» per sempre. Uno stallo si cerca con
  `node tools/duello-senza-testa.js --avversario X --livello hard --partite 12
  --seme S` (ora stampa Catena, decisioni in sospeso, retrocampo e mani) e,
  con `--traccia`, ogni decisione e risposta del bot.
- **Impatto delle Evocazioni 7+**: blocco `IMPATTO_EPICO` in `js/ui/effects.js`
  (sollevamento, caduta senza rimbalzo, onda sulle carte dei due lati);
  la descrizione è in `PROJECT_MAP.md`. Spec `impatto-evocazione-epica`.

## Regole del motore che i guardrail fanno rispettare

Un guardrail rosso dopo una tua modifica di solito ha ragione: leggilo prima
di cambiarlo.

- Un file di regola non tocca la pagina (`document.`): usa `PortaUI`.
- Un file di regola non chiama per nome il disegno: avvisa con `EventiDuello`.
- Ogni scelta del duello passa da `Decisioni.chiedi`, con `chi` = il posto
  vero (mai `'player'` scritto a mano).
- Chi controlla un posto si chiede a `Tavolo` (`persona`/`ia`/`remoto`); lo
  stato di un posto si legge con gli accessori `Tavolo.mano(posto)`...
- Ogni mossa di un giocatore (persona o IA) è un comando: `Comandi.esegui`.
- Niente `Math.random()` nelle regole: `Casuale` (o `ctx.random()` nelle carte).
- Niente cicli `['player','bot']` scritti a mano nelle regole: `Tavolo.ordine()`.
- Un timer che fa avanzare le regole: `PassoComune.dopo` (`dopoRegola` nel
  motore), non `setTimeout`.
- `ctx.specialSummon` vuole sempre `fromZone`; un bersaglio su un mostro passa
  dal checkpoint di targeting (`ctx.declareTarget` o simili).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
