# Passaggio di consegne — Millennium Duel Arena

**Aggiornato:** 23 novembre 2026<br>
**Destinazione:** ripresa dello sviluppo su una VM Ubuntu/Linux<br>
**Repository:** privato, `jacopofa92/millennium-duel-arena`

## Stato Git al passaggio

- **Branch:** `main`, tracciato su `origin/main`.
- **Ultimo commit applicativo:** `5f3867d` — `Rende raro Potere del Mago`.
- **Allineamento:** il branch era allineato al remoto; il working tree era pulito prima di aggiornare questo documento.
- **Modifiche applicative non committate:** nessuna. Questo passaggio di consegne è l’unica modifica di documentazione di questa sessione; sarà committata separatamente.
- **Versione gioco:** `1.9.32`.
- **Cache Service Worker:** `ygo-duel-arena-v803`.

Il commit `5f3867d` rende **Potere del Mago (ID 746)** Leggendaria e la esclude da negozio e buste finché non si possiede la prima copia. La prima copia è nello Structure Deck *Spellcaster’s Judgment* (SD6), disponibile dopo Battle City I al costo previsto per gli Structure Deck. Dopo il primo ottenimento può tornare raramente nelle offerte e nelle buste di fascia alta. La fonte è mostrata nella Cartoteca. La modifica è coperta dallo spec `nuove-carte-economia`.

## Ultimi cambiamenti rilevanti

- `5f3867d` — rarità e prima fonte di Potere del Mago; versione `1.9.32`, cache `v803`.
- `1fc1207` — aggiunti cinque puzzle, con duellanti reali come avversari (nei puzzle non va introdotto un bot generico).
- `ef22f30`, `42f39d3` e commit immediatamente precedenti — ordinamento coerente dei duellanti del Mondo Virtuale, collocazione di Tristan posseduto dai Big Five prima di Noah, e di Noah prima di Gozaburo; aggiornate le pedine di Tristan.
- Il recente lavoro scenico include l’impatto delle Evocazioni di Livello 7+, con sollevamento/caduta della carta reale e onda sul campo. Riferimento tecnico in `PROJECT_MAP.md`.

Per ricostruire la cronologia precisa, usare `git log --oneline --decorate` e consultare i commit, non assumere che le vecchie sezioni di `WORK_IN_PROGRESS.md` riflettano il codice attuale.

## Che progetto è

Gioco di duelli Yu-Gi-Oh! in HTML, CSS e JavaScript classico, senza framework e senza bundler applicativo. Le pagine caricano script con `<script src>` in un ordine esplicito e possono essere aperte direttamente; per WebGL, audio/video e flussi autenticati è preferibile un server HTTP locale. La copia `dist/` è generata e ignorata da Git.

Il gioco pubblicato è su Cloudflare Workers (`millennium-duel-arena.core10games.workers.dev`); a ogni push su `main` Cloudflare esegue `npm run pubblica` e pubblica la copia minificata. Il relay multiplayer è su Render. L’APK Android è un contenitore del sito e usa un progetto nativo separato: il normale lavoro web non richiede la build APK.

## Architettura da preservare

- `js/engine/`: stato, regole, azioni, fasi, battaglia, evocazioni, risoluzione e comandi.
- `js/engine/card-effects*.js`: implementazioni degli effetti per carta.
- `js/ai/`: IA Facile/Media/Difficile e criteri condivisi.
- `js/data/`: cataloghi dei personaggi, deck, sfide, rarità e dati generati.
- `data/cards.json`: sorgente delle carte; `js/data/cards-data.generated.js` è generato e **non va modificato a mano**. Dopo una modifica al JSON eseguire `node scripts/build-cards-data.js`.
- `js/ui/` e `js/audio/`: interfaccia, animazioni, WebGL e audio.
- `js/multiplayer/`, `server/`: client, protocollo a passo comune e relay WebSocket.
- `scripts/gruppi-script.js`: fonte dei gruppi/ordine degli script HTML. Dopo averlo cambiato eseguire `node scripts/sync-script-groups.js`.
- `tests/specs/`: test Playwright; `tools/`: simulazioni e audit riproducibili.
- `graphify-out/`: grafo persistente. Per una domanda sul codice consultare prima la skill Graphify e il grafo (`graphify query`, `path` o `explain`); dopo modifiche al codice eseguire `graphify update .`.

Prima di intervenire seguire l’ordine in `AGENTS.md`: `PUBBLICAZIONE.md`, `PROJECT_MAP.md`, `docs/planning/WORK_IN_PROGRESS.md`, quindi cercare per argomento in `CLAUDE.md` e in `docs/storia/`. `docs/architecture/GUIDA_RIUTILIZZO.md` è richiesta prima di refactor ampi. La roadmap sugli archetipi è in `docs/planning/CLASSIC_ARCHETYPES_ROADMAP.md`.

## Decisioni e vincoli importanti

1. **Italiano** per comunicazione, commenti e documentazione.
2. **Non eseguire `npm test` o la suite completa senza richiesta esplicita.** Eseguire solo gli spec coinvolti: `node tests/run-all.js <filtro>`; nel commit scrivere `Suite completa non eseguita.`
3. Commit mirati su `main` e push immediato quando il lavoro è autorizzato. Refactor grandi o rischiosi su branch dedicato; merge in `main` solo quando richiesto.
4. Il motore non manipola il DOM e non chiama il renderer: usare `PortaUI` ed `EventiDuello`. Le decisioni passano da `Decisioni.chiedi` e le mosse da `Comandi.esegui`.
5. Per Multiplayer e riproducibilità: usare `Casuale`/`ctx.random()`, `Tavolo` e `PassoComune`; niente `Math.random()` nelle regole e niente timer indipendenti per avanzare il motore.
6. Le Trappole devono essere Set prima dell’attivazione. Per effetti e rulings TCG il riferimento primario è YGOPRODeck, salvo regole personalizzate già deliberate (per esempio i Toon).
7. Starter e Structure Deck sono riferimenti fissi nei bilanciamenti: non cambiarli durante gli audit difficoltà senza richiesta. I deck degli avversari devono restare coerenti con la lore. Per l’IA, il deck `Custom` è una metrica aggiuntiva, non il solo criterio.
8. Le acquisizioni carta devono rispettare limiti copie e fonti dichiarate. Divinità Egizie, pezzi di Exodia e carte speciali hanno regole dedicate e non vanno reintrodotte nei pool generici.
9. Modifica visibile ai giocatori: aumentare `CACHE_NAME` in `sw.js`. Una risorsa nuova letta dal gioco va inclusa in `CARTELLE` in `scripts/pubblica.js` e, se deve essere precaricata, nell’`APP_SHELL` del service worker.
10. Evitare test con attese fisse dopo mosse: le scene bloccano intenzionalmente i comandi finché terminano. I test di interfaccia devono aspettare lo stato libero reale.

## Ambiente Ubuntu: avvio

Il repository è privato: configurare l’accesso Git sulla VM con il metodo autorizzato (SSH o credential helper già approvato). Non inserire segreti nella repository, nei comandi salvati o in questo documento.

Prerequisiti consigliati: Git, **Node.js 24**, npm, Python 3 e Chromium con le dipendenze di sistema per Playwright.

```bash
git clone <URL-del-repository-privato>
cd millennium-duel-arena
git switch main
git pull --ff-only
git status --short --branch
git log -1 --oneline
node --version
npm ci
npx playwright install --with-deps chromium
npm run hooks
```

**Nota sul lockfile da risolvere/valutare:** al passaggio `package.json` è alla `1.9.32`, mentre i metadati radice in `package-lock.json` risultano `1.6.87`. Le dipendenze dichiarate coincidono, ma non è stato verificato `npm ci` su Ubuntu. Se `npm ci` fallisce, aggiornare il lockfile con Node/npm della VM e committare la correzione; se riesce, decidere comunque se riallineare i metadati in un commit dedicato.

Per anteprima HTTP locale:

```bash
python3 -m http.server 8000
```

Poi aprire `http://localhost:8000/`. Il server statico non fornisce autenticazione Supabase né relay multiplayer.

## Comandi di lavoro e test

```bash
npm run check                         # sintassi di tutti i file JavaScript
node tests/run-all.js <filtro>        # solo gli spec pertinenti (Playwright)
npm run typecheck                     # TypeScript check sui file con @ts-check
node scripts/sync-script-groups.js    # rigenera gli script HTML dai gruppi
node scripts/build-cards-data.js      # rigenera i dati carte dopo cards.json
npm run pubblica                      # genera dist/ per controllo locale
npm run verifica-pubblicazione        # confronta dist/ e sorgenti
node tools/duello-senza-testa.js --avversario <id> --livello hard --partite 12 --seme 100
node tools/audit-attivazioni-ia.js --reattive --non-scattate
node tools/duello-gemello.js
```

`npm run hooks` configura l’hook pre-commit nel clone locale. Non usare `--no-verify`: correggere l’errore segnalato dall’hook.

## Test: ultimo stato noto

Sul commit applicativo `5f3867d`:

- `node --check js/data/card-rarity.js`, `js/economy/card-acquisition.js` e `tests/specs/nuove-carte-economia.spec.js` — **superati**.
- `node scripts/check-syntax.js` — **superato**, 733 file JavaScript controllati.
- Smoke test Node isolato per rarità e blocco/sblocco della prima copia di Potere del Mago — **superato**.
- `graphify update .` — **completato**; avvisi non bloccanti per parser SQL mancante e file non classificati.
- Hook pre-commit — **superato** sul commit.
- `node tests/run-all.js nuove-carte-economia` — **non ha raggiunto le asserzioni**: Playwright non trovava l’eseguibile Chromium (`chrome-headless-shell`). Installare Chromium nella VM e rilanciare questo spec.
- Suite completa — **non eseguita**, come richiesto dalle regole.

Il check automatico su push esegue la sintassi; la suite completa è configurata per avvio manuale o pull request. Consultare `.github/workflows/test.yml` se la configurazione cambia.

## Problemi aperti e attività da riprendere

Priorità pratiche per la VM:

1. Installare Chromium e rilanciare `node tests/run-all.js nuove-carte-economia`; è la verifica Playwright sospesa dall’ambiente precedente.
2. Verificare `npm ci` su Ubuntu e sistemare, se necessario, i metadati obsoleti del lockfile (`1.6.87` contro `1.9.32`).
3. Fare la prova manuale richiesta con due dispositivi sul controllo della sessione: accesso del dispositivo B, poi tentativo di salvataggio dal dispositivo A; verificare logout/avviso e conservazione della copia locale.
4. Indagare i flicker residui su un telefono reale durante un duello prolungato, distinguendo morra/animazioni, cambio orientamento, laminati e video. I test desktop non chiudono questo punto.
5. Proseguire gli audit di bilanciamento e ottenibilità, tracciati in `docs/planning/WORK_IN_PROGRESS.md`: audit economico globale di carte precedenti; bilanciamento post-aggiunte dei deck avversari lasciando invariati Starter/Structure; confronto deck avversari da 40/45/50 carte; audit Strings per i supporti; misurare Custom come metrica aggiuntiva.
6. Il piano carte pre-GX di Yugi/Yami Yugi rimanda a una decisione successiva Gandora, Maghi Silenti, Spadaccini Silenti, Marshmallon e Sarcofago d’Oro; leggere la roadmap prima di riprenderlo.
7. Restano richieste di verifica manuale su telefono per ingresso VS/morra/apertura campo e feedback al tocco dello stepper.

`WORK_IN_PROGRESS.md` conserva molta cronologia, anche pregressa. Alcune sue checkbox non sono più allineate alle versioni recenti: verificare codice e log Git prima di riaprire un punto. Per lo stato degli archetipi usare anche `CLASSIC_ARCHETYPES_ROADMAP.md` e i report citati lì; per l’economia usare `docs/economy/` e `docs/audits/`.

## Pubblicazione e Android

- Push su `main` → Actions esegue il check di sintassi; Cloudflare genera `dist/` e pubblica il sito; Render ridistribuisce il relay.
- Per controllare una build locale: `npm run pubblica` seguito da `npm run verifica-pubblicazione`.
- Una modifica solo web non richiede normalmente una nuova APK: l’APK di produzione carica il sito remoto. Serve il progetto Android separato solo per cambiare configurazione nativa, indirizzo o risorse native.
- Per dettagli aggiornati su hosting, file statici, service worker e relay leggere `PUBBLICAZIONE.md`; alcune sue istruzioni APK sono specifiche Windows e non sono requisiti per lo sviluppo Ubuntu.

## Riferimenti da tenere aperti

- `AGENTS.md` — procedure e vincoli per agenti.
- `PUBBLICAZIONE.md` — deploy Cloudflare/Render e cache.
- `PROJECT_MAP.md` — architettura e decisioni tecniche.
- `docs/planning/WORK_IN_PROGRESS.md` — backlog storico e stato dei lavori.
- `docs/planning/CLASSIC_ARCHETYPES_ROADMAP.md` — roadmap supporti e benchmark.
- `docs/planning/VALUTAZIONE_2026-11-12.md` — valutazione generale, da leggere tenendo conto che alcune sezioni sono datate.
- `CLAUDE.md` e `docs/storia/` — memoria storica da consultare per parola chiave.
- `docs/architecture/GUIDA_RIUTILIZZO.md` — prima di refactor ampi.
