# Passaggio di consegne — Millennium Duel Arena

**Aggiornato:** 14 novembre 2026  
**Scopo:** riprendere il progetto su una macchina virtuale Ubuntu senza dipendere dall'ambiente Windows usato in precedenza.

## Stato del repository

- **Branch attivo:** `main`
- **Ultimo commit del repository:** `60ce790` — `docs: aggiunge passaggio di consegne Ubuntu` (questo documento).
- **Ultimo commit applicativo:** `3284b40` — `ui: imposta dettagli video alti di default`.
- **Sincronizzazione:** `main` è allineato a `origin/main` al momento di questo aggiornamento.
- **Modifiche non committate:** nessuna; il working tree era pulito.
- **Versione gioco:** `1.6.86`
- **Cache Service Worker:** `v740`

Gli ultimi cambiamenti visibili sono:

1. `9abb208 ui: rinomina Assalto al Campione`: uniforma il nome della sfida settimanale e del raid multiplayer in **Assalto al Campione**. Gli identificativi interni `caccia` e `raid`, il protocollo multiplayer e il Tag Team locale «Contro un Boss» restano invariati.
2. `3284b40 ui: imposta dettagli video alti di default`: imposta **Alti** come qualità video iniziale su desktop, telefoni e APK. Le preferenze salvate esplicitamente dall'utente continuano a prevalere.

## Che progetto è

Millennium Duel Arena è un gioco di duelli Yu-Gi-Oh! realizzato con HTML, CSS e JavaScript senza framework né bundler applicativo. Le pagine usano script classici (`<script src>`) in un ordine significativo. Il gioco può essere aperto come sito statico; autenticazione, salvataggi sincronizzati e multiplayer richiedono i rispettivi servizi remoti.

Il repository comprende il gioco, test Playwright, strumenti di pubblicazione e un relay multiplayer Node. Non serve compilare il gioco per modificarne il codice sorgente. La cartella `dist/` è una copia generata e non va mantenuta a mano.

### Architettura in breve

- **Regole e stato del duello:** `js/engine/` (motore, fasi, battaglia, evocazioni, comandi, flusso e risoluzione degli effetti).
- **Effetti delle carte:** `js/engine/card-effects*.js`; le carte e le relative definizioni sorgente sono in `data/cards.json`, con dati compilati generati in `js/data/cards-data.generated.js`.
- **IA:** `js/ai/`.
- **Interfaccia e audio:** `js/ui/` e `js/audio/`.
- **Multiplayer:** client in `js/multiplayer/`, protocollo condiviso e relay in `server/server.js`.
- **Pagine:** file HTML alla radice e in cartelle dedicate; la sequenza dei loro script è gestita da `scripts/gruppi-script.js`.
- **Test:** `tests/`, eseguiti con Playwright.
- **Mappa del progetto e decisioni storiche:** `PROJECT_MAP.md` e `CLAUDE.md`.
- **Lavori aperti e verifiche manuali:** `docs/planning/WORK_IN_PROGRESS.md`.

## Decisioni tecniche da preservare

1. **Script classici e ordine esplicito.** Non introdurre bundler o moduli senza una decisione progettuale. Se cambia un gruppo di script, modificare `scripts/gruppi-script.js` e rigenerare le liste con `node scripts/sync-script-groups.js`.
2. **Motore separato dall'interfaccia.** Le regole non devono manipolare direttamente il DOM né chiamare il renderer: usano `PortaUI` ed `EventiDuello`.
3. **Le scelte passano dal sistema condiviso.** Usare `Decisioni.chiedi` e il posto reale del tavolo; evitare identificativi fissi come `player`/`bot` nelle regole.
4. **Le azioni sono comandi.** Le mosse passano da `Comandi.esegui`; il multiplayer e i test a passo comune dipendono dalla riproducibilità dello stato.
5. **Casualità deterministica.** Nelle regole usare `Casuale` o `ctx.random()`, non `Math.random()`.
6. **Avanzamento temporizzato delle regole.** Usare `PassoComune.dopo`/`dopoRegola`, non timer indipendenti che possano divergere tra client.
7. **Dati carte generati.** Non modificare a mano `js/data/cards-data.generated.js`: dopo una modifica a `data/cards.json`, lanciare `node scripts/build-cards-data.js`.
8. **Pubblicazione e cache.** Ogni risorsa statica nuova va inclusa in `CARTELLE` in `scripts/pubblica.js`; se una modifica cambia ciò che vede il giocatore, aggiornare `CACHE_NAME` in `sw.js`.
9. **Graphify.** Il repository contiene `graphify-out/`. Per domande sull'architettura o sul codice, consultare prima il grafo; dopo modifiche al codice eseguire `graphify update .`.
10. **Riferimento effetti carte.** Per verifiche TCG usare YGOPRODeck come riferimento primario e rispettare le decisioni specifiche già documentate per il gioco, ad esempio le regole personalizzate dei Toon.

## Ambiente Ubuntu

### Prerequisiti

- Git
- Node.js **24** (è la versione usata dalla CI; verificare con `node --version`)
- npm incluso con Node
- Chromium e dipendenze di sistema per i test Playwright
- Accesso autorizzato al repository privato tramite il normale meccanismo Git configurato sulla VM. Non inserire credenziali nei file del progetto o in questo documento.

### Avvio da una VM pulita

```bash
git clone <URL-del-repository-privato>
cd millennium-duel-arena
git switch main
git pull --ff-only
node --version
npm ci
npx playwright install --with-deps chromium
```

L'URL di clone va ottenuto dall'account Git già autorizzato sulla VM. Non salvare password o token nel repository, nella history dei comandi o in `HANDOFF.md`.

**Controllo da fare al primo `npm ci`:** al momento `package.json` dichiara `millennium-duel-arena` versione `1.6.86`, mentre i metadati radice di `package-lock.json` risultano ancora `yugioh-game` versione `1.6.42`. Questa incoerenza era già presente e non è stata modificata in questo passaggio. Verificare se `npm ci` termina correttamente su Ubuntu; se fallisce, riallineare il lockfile con una versione Node/npm compatibile e committare la correzione separatamente.

### Comandi utili

```bash
# Controllo sintassi JavaScript (rapido)
npm run check

# Un gruppo mirato di test Playwright; usare una parte del nome dello spec
node tests/run-all.js impostazioni-default-alti-e-profondita-menu

# Controllo dei file JavaScript annotati con @ts-check
npm run typecheck

# Rigenerare gli script delle pagine dopo aver cambiato i gruppi
node scripts/sync-script-groups.js

# Rigenerare i dati carte dopo aver cambiato data/cards.json
node scripts/build-cards-data.js

# Generare la copia statica di pubblicazione e confrontarla con le sorgenti
npm run pubblica
npm run verifica-pubblicazione

# Avviare localmente il relay multiplayer, se necessario
node server/server.js
```

Per un'anteprima web locale si può usare, dalla radice del repository:

```bash
python3 -m http.server 8000
```

Poi aprire `http://localhost:8000/`. I flussi che richiedono account o servizi remoti non diventano disponibili per il solo fatto di avviare il server statico.

## Test eseguiti e risultati noti

### Ultimo aggiornamento, commit `3284b40`

- `node --check js/ui/video-quality.js` — **superato**.
- `node --check tests/specs/impostazioni-default-alti-e-profondita-menu.spec.js` — **superato**.
- `git diff --check` — **superato**.
- `npm run pubblica` — **superato**; copia `dist/` generata con 193 file JS, 63 CSS, 27 HTML e 3.314 risorse statiche copiate. I 291 asset previsti dal Service Worker erano presenti.
- Test mirato `node tests/run-all.js impostazioni-default-alti-e-profondita-menu` — **non arrivato alle asserzioni**: mancava il binario Chromium di Playwright nell'ambiente di esecuzione. Installarlo sulla VM con `npx playwright install --with-deps chromium`, poi rilanciare.
- Suite completa — **non eseguita**, in linea con le istruzioni del progetto.

### Commit `9abb208`

- `node scripts/check-syntax.js` — **superato** su 717 file JavaScript.
- `npm run pubblica` — **superato**; verifica dei 291 asset del Service Worker completata.
- Test Playwright mirati — **bloccati prima delle asserzioni** dalla stessa assenza del binario Chromium.
- Hook pre-commit — **superato**.
- Suite completa — **non eseguita**.

## Pubblicazione

- Il sito statico viene pubblicato da Cloudflare a seguito del push su `main`; il processo remoto genera la copia minificata. La build locale `npm run pubblica` è utile per controllarla, ma non sostituisce il push.
- Il relay multiplayer è ospitato separatamente su Render. Il deploy del relay dipende dai file server/protocollo indicati in `render.yaml`; una modifica puramente grafica non dovrebbe richiederne il redeploy.
- L'APK Android è un contenitore del sito e il suo flusso nativo dipende da un ambiente Android separato. Non è necessario per il normale lavoro web su Ubuntu; serviranno Android SDK e configurazione dedicata per ricompilarla.
- Consultare `PUBBLICAZIONE.md` prima di cambiare hosting, file pubblicati o processo di release. È stato aggiornato in precedenza e contiene ancora istruzioni specifiche Windows per l'APK, non necessarie alla procedura Ubuntu qui descritta.

## Problemi aperti e verifiche da pianificare

Questi punti sono attività di controllo, non blocchi per avviare il progetto sulla VM:

1. Installare Chromium Playwright e ripetere i due spec mirati all'ultimo cambio UI.
2. Verificare su un dispositivo mobile reale i flicker residui durante sessioni di duello lunghe; i test desktop non sostituiscono questa verifica.
3. Completare la verifica manuale su telefono della risposta e dell'accessibilità dello stepper delle fasi.
4. Eseguire il test multi-dispositivo dell'accesso allo stesso account e della protezione dei salvataggi, descritto in `docs/planning/WORK_IN_PROGRESS.md`.
5. Proseguire gli audit IA/deck e archetipi classici riportati nella sezione dedicata di `docs/planning/WORK_IN_PROGRESS.md`; il benchmark del deck `Custom` è già documentato lì e in `docs/audits/CLASSIC_ARCHETYPES_CUSTOM_BENCHMARK.md`.
6. Verificare il lockfile su Ubuntu con `npm ci` e decidere se riallinearne i metadati in un commit dedicato.

Per aggiornare la lista, leggere `docs/planning/WORK_IN_PROGRESS.md`: è la fonte corrente, mentre `CLAUDE.md` conserva decisioni storiche e può contenere appunti datati.

## Prossimi passi consigliati sulla VM

1. Ottenere accesso al repository privato con il metodo Git già approvato per la VM; clonare `main` e confermare `git status --short --branch` e `git log -1 --oneline`.
2. Installare Node 24 e dipendenze con `npm ci`; risolvere l'eventuale incoerenza del lockfile solo se impedisce l'installazione.
3. Installare Chromium per Playwright e rilanciare il test mirato dell'impostazione grafica predefinita.
4. Eseguire `npm run check`; eseguire i soli test pertinenti al lavoro. **Non lanciare la suite completa (`npm test`) senza richiesta esplicita.**
5. Prima di un intervento, consultare nell'ordine `PUBBLICAZIONE.md`, `PROJECT_MAP.md`, `docs/planning/WORK_IN_PROGRESS.md` e cercare in `CLAUDE.md` la parola chiave dell'area.
6. Per modifiche visibili, aggiornare versione/cache secondo le convenzioni correnti; mantenere i cambi mirati, usare branch dedicati per refactor grandi e seguire la procedura di commit/push descritta in `AGENTS.md`.

## Documenti da tenere come riferimenti

- `AGENTS.md` — istruzioni operative e guardrail.
- `PUBBLICAZIONE.md` — hosting e deploy.
- `PROJECT_MAP.md` — architettura e passaggi di consegne precedenti.
- `docs/planning/WORK_IN_PROGRESS.md` — attività aperte e controlli richiesti.
- `CLAUDE.md` — diario storico, da consultare per argomento.
- `docs/architecture/GUIDA_RIUTILIZZO.md` — da leggere prima di refactor ampi.

