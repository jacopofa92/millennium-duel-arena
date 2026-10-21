# Guida al riutilizzo del motore — è "sandbox"?

## Risposta breve

**Sì, ma con un distinguo preciso.** Il motore (`js/engine/`: `duel-engine.js` più i file del nucleo — `stato.js`, `fasi.js`, `evocazioni.js`, `battaglia.js` — e il registro `CardEffects` in `card-effects.js`) è ben organizzato, coerente e commentato in modo insolitamente accurato per un progetto senza build/framework — ma NON è una libreria "npm install e via": è un insieme di script globali che condividono uno scope, con un ordine di caricamento preciso da rispettare, e uno stato di gioco (`gameState`) modellato esplicitamente sulle regole di Yu-Gi-Oh (5 zone mostro, 5 zone Magia/Trappola, Life Points, Evocazione Tributo, Fusione/Rituale...).

Da quando esiste il **nucleo senza testa** le regole girano anche in Node, senza browser (`tools/duello-senza-testa.js`): è la parte più facile da riusare, perché non tocca mai la pagina.

## Come è organizzata `js/` oggi

```
js/
├── engine/     motore di gioco — QUESTO è "il gioco"
│               Regole (non toccano la pagina, girano anche in Node):
│                 stato.js (gameState e costanti), fasi.js (turno, fasi,
│                 pescata, fine duello), evocazioni.js (Evocare, Settare,
│                 Sacrifici), battaglia.js (attacco e danno, compresa la
│                 regola unica dell'attacco diretto), duel-engine.js
│                 (Catena, finestre di risposta, ACTIONS per le carte),
│                 card-effects.js (helper condivisi) + card-effects-1..8.js
│                 (le carte), effect-templates.js
│               Il confine con l'interfaccia:
│                 porta-ui.js (l'unico punto da cui le regole cercano
│                 elementi della pagina), eventi-duello.js (le regole
│                 avvisano, l'interfaccia ascolta), canale-partita.js
│                 (addToLog/updateUI/endDuel & co.: la parte di regola),
│                 decisioni.js (ogni scelta: chi risponde)
│               Posti e Multiplayer:
│                 tavolo.js (chi controlla ciascun posto: persona, IA o
│                 remoto), comandi.js (ogni mossa come comando),
│                 casuale.js (casualità con seme condiviso),
│                 passo-comune.js (Multiplayer a passo comune)
│               Il disegno: game-flow.js e actions.js (render del campo,
│                 click, trascinamenti, modali), duel-sandbox.js (stato
│                 iniziale del "Duello Demo")
├── data/       dati carte/mazzi/contenuti: cards-db.js,
│               cards-data.generated.js e card-origins.generated.js
│               (GENERATI, non si editano), card-rarity.js,
│               custom-cards.js, custom-taxonomy.js, characters-db.js,
│               character-decks.js, character-unlocks.js,
│               starter-structure-decks.js, deck-legality.js,
│               challenges-db.js, missions-db.js, story-campaigns.js,
│               arena-options.js, tournament-dialogues.js
├── ai/         IA a livelli: ai-controller.js (facciata), ai-medium.js,
│               ai-hard.js, ai-shared.js, bot.js (esecutore). Gioca da
│               qualunque posto: riceve sempre il posto da cui gioca
├── story/      story-progress.js — avanzamento delle campagne, livelli,
│               migrazioni dei salvataggi vecchi
├── audio/      audio-manager.js (musica), audio-library.js (Howler),
│               sfx.js (effetti sintetizzati)
├── ui/         presentazione. Componenti condivisi da PIÙ pagine:
│               card-renderer.js + card.css (la carta, vedi più sotto),
│               card-detail.js (scheda carta unica), topbar.js,
│               page-loader.js, game-logo.js, node-map.js (sentiero di
│               nodi su mappa esplorabile), sfide-view.js,
│               profile-stats.js, board-pieces.js (pedine SVG dei
│               tornei), error-recovery.js, icon-library.js,
│               onboarding.js, deck-box.js, deck-switcher.js.
│               Il duello: effects.js (facciata FX a BACKEND) +
│               fx-gsap.js, visual-effects-library.js,
│               duel-cinematics.js, duel-dialogues.js, field-ambience.js,
│               duel-rps.js, duel-setup.js, monster-hologram.js +
│               hologram-setting.js, challenge-banner.js,
│               story-cutscene.js, video-quality.js, bot-speed.js
│               (+ il .css di ciascuno)
├── economy/    valute, ricompense e Negozio: rewards.js, shop-catalog.js,
│               shop-ui.js, card-acquisition.js (acquisizioni speciali:
│               Carte Dio, Exodia...), pack-opening.js,
│               card-drop-animation.js
├── challenges/ challenge-tracker.js — tracking generico delle Sfide e
│               delle missioni a rotazione
├── multiplayer/ network.js, mp-lobby.js, multiplayer.js (protocollo di
│               prima), mp-passo-comune.js (collegamento della pagina al
│               passo comune)
├── cloud/      account e salvataggio online (vedi "Cloud" più sotto):
│               cloud-sync.js, auto-sync.js, auth-gate.js, server-date.js,
│               supabase-config.js
├── dev/        strumenti di collaudo, solo per l'amministratore:
│               test-shortcuts.js, story-map-editor.js,
│               story-admin-tools.js
├── native/     ponti per l'APK Capacitor, tutti no-op sul web:
│               app-back-button.js, haptics.js, keep-awake.js,
│               native-save-backup.js
├── vendor/     librerie di terze parti vendorizzate (gsap, howler, pixi,
│               supabase-js) — mai da CDN, vedi il gotcha file:// più sotto
└── save-manager.js, duel-session.js, pwa-register.js, version.js
    (collante di pagina, non parte di un sottosistema — restano qui)
```

Fuori da `js/`:
- `scripts/` — `gruppi-script.js` (l'UNICA lista dei gruppi di `<script>`, vedi i gotcha), `sync-script-groups.js`, `build-cards-data.js`, `check-syntax.js`, `pre-commit.js`.
- `tools/` — strumenti da riga di comando: `duello-senza-testa.js` (duelli interi IA contro IA in Node), `duello-gemello.js` (due client a passo comune che devono arrivare allo stesso stato), `impronta-partite.js`, `impronta-funzioni.js` + `sposta-funzioni.js` (spostare codice fra file dimostrando che non è cambiato), gli `audit-*.js` e le `simula-*.js` di bilanciamento.
- `server/server.js` — relay WebSocket del Multiplayer, nessuna logica di gioco.
- `supabase/schema.sql` — tabelle, policy e funzioni del cloud.

Per riusare DAVVERO il motore (Caso A più sotto), le cartelle che contano sono `engine/`, `ai/`, `save-manager.js` e `ui/card-renderer.js` — `data/`, `story/`, `audio/`, `multiplayer/`, `cloud/`, `economy/`, `challenges/`, `dev/`, `native/` sono contenuto/features specifiche di QUESTO gioco, non della macchina.

**Pagine HTML**, per orientarsi: `duelMonstersCore.html` è l'arena (l'unica che carica il motore); `index.html` contiene il gate di accesso, il menu e diverse viste fuse come SPA (Profilo, Duello Libero, Sfide, Cartoteca...); poi le pagine autonome `storia.html`, `negozio.html`, `impostazioni.html`, `regole.html`, `cartoteca.html`, `creazione-deck.html`, `crea-carta.html`, `sfide.html`, `multiplayer.html`, `tornei.html` con i tre tornei (`torneo-regno-duellanti.html`, `torneo-battle-city.html`, `torneo-kaiba.html`), `admin.html` (approvazione account e strumenti di collaudo) e `duello-sandbox.html`. Alcune viste fuse esistono anche come pagina autonoma (`profilo.html`, `sfide.html`, `duello-libero.html`): dove la schermata è un componente condiviso (`SfideView`, `ProfileStats`) le due copie non possono divergere, altrove sì — prima di modificare una pagina autonoma, controllare se ne esiste una copia in `index.html`. `duello-libero.html` NON va rimossa: è il bersaglio di ritorno cablato in `js/duel-session.js`.

Il valore di riuso vero cambia molto in base a COSA vuoi costruire:

| Cosa vuoi fare | Valore di riuso |
|---|---|
| Un altro gioco di carte duale a turni con carte "attivabili" e priorità di risposta (stile Yu-Gi-Oh/Magic/Hearthstone) | **Alto** — riusi il 70-80% della macchina (fasi, Chain, registro effetti, decisioni, IA) cambiando solo dati e implementazioni carta |
| Un gioco di carte con meccaniche/tabellone radicalmente diversi | **Medio** — riusi i PATTERN (registro per-carta, sistema di priorità, ctx come API effetti, regole separate dal disegno, IA a livelli), non il codice così com'è |
| "Voglio prendere questo file ed embeddarlo in un altro progetto" | **Basso** — non è pensato per l'import: è pensato per essere LETTO e ADATTATO |

## Cosa è genuinamente riutilizzabile (i pattern, non solo il codice)

1. **`CardEffects.register(id, {...})` — registro di comportamento per-carta.**
   Ogni carta dichiara solo gli handler che le servono (`activate`, `canActivate`, `static`, `onSummon`, `onAttackDeclare`, `onOpponentSummon`, ecc. — vedi il commento in testa a `js/engine/card-effects.js` per l'elenco completo e per le convenzioni; le carte vere stanno nelle parti `card-effects-1..8.js`, e per trovarne una si cerca `register(<id>` in `js/engine/`). Il motore non sa nulla del contenuto di ogni carta: chiede solo "hai questo handler?" e lo chiama. Questo pattern è game-agnostico: funzionerebbe identico per qualunque gioco a carte con "effetti quando succede X".

2. **Il sistema di Chain/priorità (`openTriggerWindow`/`openActivationWindow`/`openPriorityWindow` in `js/engine/duel-engine.js`).**
   Un evento (Evocazione, Attacco, attivazione manuale) apre una finestra in cui l'avversario (e poi via via chi ha priorità) può incatenare le proprie carte di risposta, una alla volta, finché entrambi passano — poi si risolve in LIFO. È lo stesso principio dello "stack" di Magic: the Gathering o dei trigger di Hearthstone: riusabile per qualunque gioco con carte "istantanee"/di risposta, cambiando solo i nomi dei TRIGGER (oggi molto specifici di Yu-Gi-Oh: `ON_NORMAL_SUMMON`, `ON_ATTACK_DECLARE`...).

3. **`ctx` — l'API che un effetto vede.**
   Ogni handler riceve un contesto con `ctx.owner/opponent`, `ctx.field()/hand()/graveyard()/stField()`, più `ACTIONS` (in `js/engine/duel-engine.js`: `destroyMonster`, `dealDamage`, `drawCards`, `specialSummon`, `declareTarget`, `random`...). È la vera "API pubblica" del motore per chi scrive effetti. Il proprietario dell'effetto lo decide sempre il chiamante: i dati passati come `extra` non possono sovrascrivere `owner`/`opponent` né gli helper.

4. **Regole separate dal disegno (il nucleo senza testa).**
   Tre regole, sorvegliate da guardrail, per qualunque codice nuovo nei file di regola:
   - **non si tocca la pagina**: niente `document.`, si chiede a `PortaUI`;
   - **non si chiama per nome il disegno**: si avvisa con `EventiDuello.emetti` (un avviso), `attendi` (un'animazione con un "fatto": senza ascoltatori parte subito) o `chiedi` (una domanda); i nomi degli eventi sono un elenco chiuso (`EVENTI`);
   - **ogni scelta passa da `Decisioni.chiedi`**: la carta descrive la scelta (chi, tipo, candidati, scelta automatica per l'IA) e il modulo decide chi risponde — la persona, l'IA o l'avversario remoto.
   È il pattern più riusabile del progetto: la stessa partita gira nel browser, in Node (`tools/duello-senza-testa.js`) e su due client in Multiplayer, senza una riga di regola diversa.

5. **Posti al tavolo (`js/engine/tavolo.js`).**
   `'player'` e `'bot'` sono solo i nomi dei due posti; chi li controlla (`'persona'`, `'ia'`, `'remoto'`) è un dato, chiesto a `Tavolo.controllore(posto)`. Per decidere "chi sceglie" o "chi guida il turno" si chiede a Tavolo, mai al nome del posto. Così l'IA gioca da entrambi i lati e un duello IA contro IA si misura senza codice speciale.

6. **Mosse come comandi + casualità con seme (`comandi.js`, `casuale.js`, `passo-comune.js`).**
   Ogni mossa è un oggetto con tutte le scelte dentro (`{ tipo: 'evoca', carta, casella, posizione }`), eseguito da una funzione sola con il posto come parametro. Con lo stesso seme per la casualità, due client che eseguono la stessa sequenza di comandi e decisioni arrivano allo stesso stato: è il Multiplayer "a passo comune", e lo verifica `tools/duello-gemello.js`. Riusabile per qualunque gioco a turni deterministico in rete.

7. **`js/ai/ai-controller.js` (facciata) + `ai-medium.js`/`ai-hard.js` (livelli intercambiabili).**
   `js/ai/bot.js` (l'esecutore) parla SOLO con `BotAI.*`, mai con un livello specifico — aggiungere/cambiare un livello di difficoltà non tocca mai l'esecutore. Pattern da strategy/facade, riusabile per qualunque IA a livelli.

8. **`effectTemplate`/`cloneEffectOf` (`js/engine/effect-templates.js`, `js/data/custom-cards.js`) — contenuto "low-code".**
   Una carta può dichiarare un effetto parametrico riusabile o clonare l'effetto di un'altra carta già scritta, invece di richiedere codice nuovo — la base tecnica dietro il Card Maker (`crea-carta.html`). Pattern riusabile per qualunque registro di contenuti espandibile dall'utente.

9. **Persistenza offline-first (`js/save-manager.js`) con sync opzionale (`js/cloud/`).**
   Un solo blob JSON per il salvataggio in `localStorage`, funzioni `load()/touch()` con retrocompatibilità automatica (un salvataggio vecchio senza un campo nuovo viene "riparato" al volo), e un gancio generico `SaveManager.onSaved` a cui si aggancia chi deve reagire alle scritture senza che il salvataggio sappia chi è. La sincronizzazione col cloud sta sopra, separata (vedi "Cloud").

10. **La carta come componente con una scala di misure (`js/ui/card-renderer.js` + `js/ui/card.css`).**
    `createCardElement` costruisce la carta; il CSS decide lo stile in base alla MISURA, non alla pagina: sotto una certa larghezza (`@container`, misurata sulla larghezza interna della carta) passa da sola allo stile compatto, ingrandita torna classica. Le misure fuori dal duello sono token con nome (`--carta-griglia`, `--carta-anteprima`, `--carta-premio`...) invece di formule ripetute in ogni pagina. Il dettaglio di una carta si apre ovunque con la stessa scheda, `CardDetail.open(card, { riepilogo, azioni })`.

## Struttura delle pagine: menu = solo link

Dalla 1.4.47 `index.html` è **solo il menu** (con accesso e primo avvio): ogni schermata (Cartoteca, Profilo, Impostazioni, Regole, Negozio, Sfide, Duello Libero...) è una **pagina dedicata** raggiunta da un link, con **una sola copia**. Niente viste SPA, router o id prefissati dentro `index.html`: musica e caricamento restano coerenti e il menu resta leggero. La logica condivisa di una schermata vive in un componente (`js/ui/*-view.js`, `SfideView`, `CartotecaView`, `ShopUI`, `SceltaDuellante`, `SfidaLibera`...) montato dalla sua pagina; il CSS in un file a parte (non inline) così il Service Worker lo mette in cache. Una schermata nuova = una pagina nuova + il suo componente, mai una copia dentro il menu. Le pagine di prova locali iniziano per `_` (ignorate da git e dalla pubblicazione).

## Cloud: account e salvataggio online

Specifico di questo gioco, ma con regole che chi tocca `js/cloud/` deve conoscere:

- **L'accesso è obbligatorio.** `auth-gate.js` va incluso come PRIMO script di ogni pagina di gioco e rimanda a `index.html` se l'account non è approvato da un amministratore (`admin.html`). Gli spec Playwright lo saltano con `window.AUTH_GATE_SKIP = true`.
- **Vince il salvataggio MODIFICATO per ultimo**, mai quello caricato per ultimo: la data è `player.lastSaved`, dentro il salvataggio (`CloudSync.dataModifica`/`confrontaSalvataggi`). Un dispositivo non scrive mai sul cloud sopra un salvataggio più recente (`pushSave` rifiuta con `CLOUD_PIU_RECENTE`).
- **La riconciliazione** (`CloudSync.riconcilia`) tiene il più recente: la chiama il menu all'avvio prima di aprirsi, e `auto-sync.js` quando l'app torna in primo piano. Esiti: `scaricato`, `caricato`, `uguale`, `nessuno`, `offline`, `azzerato`.
- **Un solo caricamento automatico**: `auto-sync.js` ascolta `SaveManager.onSaved` e le carte personalizzate (`AutoSync.cartePersonalizzateCambiate`, chiamata dai `saveAll` di `custom-cards.js` e `custom-taxonomy.js`), aspetta qualche secondo per raccogliere la raffica di scritture, e forza il caricamento quando la pagina viene nascosta. Ciò che non arriva resta segnato in `localStorage` e si riprova al prossimo avvio.
- **L'azzeramento del profilo vale ovunque**: sul cloud resta un segno `{ azzeratoIl }` (una nuova "generazione" del profilo), e ogni lettura del cloud passa da `leggiCloud`, che toglie i dati di un dispositivo nati prima di quel segno. Non cancellare mai la riga del cloud per "azzerare": un altro dispositivo ci rimetterebbe sopra i dati vecchi.
- **Ogni modifica al database** si scrive anche in `supabase/schema.sql`, che resta la fonte per ricostruire il progetto da zero.

## Cosa NON è generico — va riscritto per un gioco diverso

- **`gameState`** (`js/engine/stato.js`) è un oggetto piatto con campi Yu-Gi-Oh-specifici cablati ovunque (`playerMonsterField`/`botMonsterField`, 5 slot fissi, `playerSTField`, `playerFieldSpell`, `playerLP`, `phase` con i nomi esatti `draw`/`standby`/`main1`/`battle`/`main2`/`end`). Un gioco con un tabellone diverso richiede toccare praticamente ogni file che legge questi campi.
- **Le regole di Evocazione** (Tributo in base al Livello, Set coperto, Fusione da Extra Deck, Rituale via Magia dedicata) sono scritte a mano in `js/engine/evocazioni.js` e `duel-engine.js`, non parametrizzate.
- **Le ~800 implementazioni carta** in `js/engine/card-effects-1..8.js` (gli helper che condividono stanno in `js/engine/card-effects.js`, che va caricato prima) sono ovviamente specifiche di queste carte — zero valore fuori da un progetto Yu-Gi-Oh (attenzione anche ai diritti: sono nomi/testi di carte reali Konami, tenerli fuori da qualunque progetto non-fan/commerciale).
- **Il rendering** (`js/ui/card-renderer.js`, `js/ui/card.css`) replica il layout grafico di una vera carta Yu-Gi-Oh — riusabile come RIFERIMENTO per "come strutturare un renderer di carte con una scala di misure", non copiabile direttamente per un altro gioco con un layout diverso.

## Se vuoi DAVVERO riusarlo: percorso consigliato

**Caso A — un altro gioco di carte simile (2 giocatori, zone, fasi, effetti attivabili):**
1. Copia le cartelle `js/engine/`, `js/ai/` (incluso `bot.js`), `js/ui/card-renderer.js` + `js/ui/card.css`, il file `js/save-manager.js` e `scripts/gruppi-script.js` + `scripts/sync-script-groups.js` in un nuovo progetto.
2. Svuota le parti `card-effects-1..8.js` e tieni in `card-effects.js` solo l'impianto e il commento con l'elenco degli handler supportati.
3. Ridisegna `gameState` in `stato.js` per il TUO tabellone (numero di zone, nomi di fase) — è l'unico vero refactor strutturale, tutto il resto segue.
4. Ridefinisci `TRIGGER` in `duel-engine.js` e l'elenco `EVENTI` in `eventi-duello.js` con gli eventi del tuo gioco.
5. Scrivi le tue carte con lo stesso schema `{ id, name, type, ... }` + `CardEffects.register`, e verifica le regole in Node con un equivalente di `tools/duello-senza-testa.js` prima di disegnare qualunque cosa.

**Caso B — un gioco diverso, vuoi solo "ispirarti":**
Leggi (non copiare) `js/engine/duel-engine.js` per il sistema di Chain e il pattern `ctx`, `eventi-duello.js` + `decisioni.js` + `tavolo.js` per la separazione regole/disegno/giocatori, `js/ai/ai-controller.js` per la facciata IA a livelli, `js/data/custom-cards.js`/`js/engine/effect-templates.js` per il pattern "contenuto utente senza codice". Riscrivi da zero il resto sul tuo dominio.

## Gotcha da non riscoprire da capo

- **Nessun bundler, ma le liste di script sono generate**: l'ordine dei `<script>` nell'HTML è l'unica cosa che garantisce che una variabile globale esista quando serve, e cambiarlo rompe silenziosamente qualcosa a runtime. I gruppi caricati da più pagine (il motore, la partita...) stanno in UNA lista, `scripts/gruppi-script.js`: si modifica lì e si lancia `node scripts/sync-script-groups.js`, che riscrive ogni pagina fra i marcatori `<!-- gruppo-script:NOME -->` (e `APP_SHELL` di `sw.js`). Pre-commit e `guardrail-gruppi-script.spec.js` fermano una pagina non allineata. Uno script FUORI dai gruppi (es. quelli di `js/cloud/`) va invece ancora aggiunto o tolto a mano in ogni pagina e nella precache di `sw.js`, altrimenti fallisce silenziosamente (404).
- **`file://` vs `http(s)://`**: `fetch()` e i Service Worker non funzionano aperti come file locale a doppio click — da cui l'uso di `<script>` invece di `import`/`fetch` per i dati (`cards-data.generated.js` invece di leggere `cards.json` via fetch) e `html5: true` su Howler (`audio-library.js`).
- **Un `const` a livello di script NON è `window.X`**: un modulo che altri leggono da `globalThis`/`window` va pubblicato anche lì esplicitamente.
- **Ogni modifica servita all'APK richiede di cambiare `CACHE_NAME` in `sw.js`**, altrimenti il telefono continua a usare i file vecchi dalla cache.
- **`ctx.card` cambia significato in base al trigger**: per un'auto-attivazione (`onSummon`) è RISERVATO alla carta di chi RISPONDE, non alla carta evocata (quella è `ctx.summonedCard`) — un bug reale caduto in questa trappola (Tsukuyomi, id 739).
- **Le Trappole non si attivano mai dalla mano**: un invariante di regole che va difeso esplicitamente in ogni nuovo punto che tocca l'attivazione manuale o le finestre di risposta (vedi il commento su `findTriggerCandidates` in `duel-engine.js`) — non è garantito automaticamente dall'architettura, va controllato a mano.
- **In Multiplayer niente `Math.random()` nelle regole**: monete, dadi e uid dei Token passano da `ctx.random`/`ctx.randomPick`/`ctx.newTokenUid` (e `Casuale`), che escono uguali sui due client.
- **Per la storia completa delle decisioni** e dei bug già incontrati, `CLAUDE.md` (memoria dettagliata) e `PROJECT_MAP.md` (mappa corrente breve).
