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
3. `CLAUDE.md` — la memoria lunga delle decisioni e dei bug passati. È un
   diario: cerca la parola chiave dell'area che tocchi invece di leggerlo
   tutto. Dove contraddice il codice, ha ragione il codice.
4. `docs/architecture/GUIDA_RIUTILIZZO.md` prima di un refactor ampio.

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
node tools/duello-senza-testa.js      # duelli IA contro IA in Node
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
