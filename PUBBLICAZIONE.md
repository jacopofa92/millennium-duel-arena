# Yu-Gi-Oh! Millennium Duel Arena — dove gira e come si pubblica

Guida breve per chi lavora al progetto (persone o agenti come Codex e
Claude). Spiega dove vive il gioco online, cosa succede quando si fa un push,
e cosa fare nei casi più comuni. Aggiornata al 2026-10-11.

## In una riga

Si sviluppa sui file normali del repository, senza build; a ogni push su
`main` Cloudflare ricrea da sé una **copia minificata** del gioco e la mette
online. Nessun comando di pubblicazione da lanciare a mano.

## I pezzi

| Cosa | Dove | Note |
|---|---|---|
| Codice sorgente | GitHub, repository **privato** `jacopofa92/millennium-duel-arena` | Prima si chiamava `YuGiOhGame` ed era pubblico |
| Sito del gioco | Cloudflare **Workers** (risorse statiche): `https://millennium-duel-arena.core10games.workers.dev` | Si aggiorna da solo a ogni push su `main` |
| Account e salvataggi | Supabase, progetto «DuelArena» | Registrazione obbligatoria con approvazione dell'amministratore, come prima |
| Server Multiplayer | Render, servizio `millennium-duel-arena-relay` (`wss://millennium-duel-arena-relay.onrender.com`) | Gestito da `render.yaml`; si ridistribuisce a ogni push |
| APK Android di produzione | `C:\AndroidDev\YuGiOhGameAndroidProd` (fuori dal repository) | Apre il sito Cloudflare; si ricompila solo per cambi nativi o di indirizzo |
| GitHub Pages | **non si usa più** | Con il repository privato non è disponibile sul piano Free |

## Cosa succede a ogni push su `main`

1. **GitHub Actions** fa solo il controllo di sintassi (pochi secondi).
   La suite completa NON parte: con il repository privato il piano Free dà
   2.000 minuti al mese e la suite ne usa circa 30. Si lancia a mano
   (Actions › Test suite › Run workflow) o parte su una pull request.
2. **Cloudflare** clona il repository, esegue `npm run pubblica` (crea
   `dist/`) e pubblica `dist/` con
   `npx wrangler deploy --assets=./dist --name=millennium-duel-arena --compatibility-date=2026-10-01`.
   In un paio di minuti il sito è aggiornato. Lo stato dei build è nella
   dashboard di Cloudflare › Workers & Pages › millennium-duel-arena ›
   Deployments.
3. **Render** ridistribuisce il server Multiplayer (`server/server.js`).

Il relay di produzione richiede una sessione Supabase verificata (`RENDER=true`
o `MP_REQUIRE_AUTH=1`). Quando si abilita questa protezione, pubblicare anche
il client aggiornato: i vecchi client che non inviano il token vengono rifiutati.
Lo sviluppo locale può continuare senza autenticazione se non imposta queste
variabili.

## La copia minificata (`npm run pubblica`)

Script: `scripts/pubblica.js`. Crea `dist/` da zero ogni volta (la cartella
è ignorata da git e dal controllo di sintassi: non si modifica mai a mano).

- **Cosa entra**: le pagine `.html` della radice, `manifest.json`, `sw.js` e
  le cartelle `js`, `images`, `audio`, `video`, `assets`. È un elenco di cose
  che ENTRANO: documenti, audit, test, strumenti, server, APK restano fuori da
  soli. **Se il gioco comincia a leggere una cartella nuova, va aggiunta a
  `CARTELLE` in `scripts/pubblica.js`**, altrimenti online mancherebbe.
- **Come si minifica**: esbuild, file per file, senza unirli; i nomi di primo
  livello restano intatti (i file si chiamano fra loro per nome: `initGame`,
  `DuelEngine`...). Spariscono tutti i commenti; nessuna source map. Nelle
  pagine si tolgono i commenti HTML e si minificano script e stili in linea.
- **Controlli**: ogni voce di `APP_SHELL` in `sw.js` deve esistere nella
  copia, o lo script si ferma (un file mancante romperebbe l'installazione
  del Service Worker sui telefoni).

Verifica facoltativa, in locale:

```text
npm run pubblica                 # crea dist/
npm run verifica-pubblicazione   # apre ogni pagina da originale e copia e confronta
YGO_RADICE_GIOCO=dist node tests/run-all.js battle-resolution chain-resolution realistic-bot
                                 # fa giocare spec del motore sulla copia minificata
```

(In PowerShell: `$env:YGO_RADICE_GIOCO='dist'; node tests/run-all.js ...`.)

## Cosa fare quando...

- **Aggiungi un file nuovo usato dal gioco**: se sta in una delle cartelle
  già elencate non serve nulla. Se il Service Worker deve precaricarlo,
  aggiungilo ad `APP_SHELL` in `sw.js` e alza `CACHE_NAME`.
- **Aggiungi una cartella nuova** (es. `fonts/`): aggiungila a `CARTELLE` in
  `scripts/pubblica.js`.
- **Una modifica visibile ai giocatori**: alza `CACHE_NAME` in `sw.js`, così
  i telefoni scaricano la versione nuova invece di quella in cache.
- **Il build su Cloudflare fallisce**: apri il deployment rosso nella
  dashboard, leggi il registro. Di solito è `npm run pubblica` che si ferma
  con un messaggio chiaro (una voce di `APP_SHELL` mancante, un errore di
  sintassi che esbuild non riesce a minificare). Riproducilo in locale con
  `npm run pubblica`.
- **Leggere perché la suite su GitHub è rossa**: ogni test fallito diventa
  un'annotazione del job, visibile in cima alla pagina del run senza aprire
  il log. Col repository privato servono login o un token: con la GitHub CLI
  (`gh run view <id>`) o l'API
  (`/repos/jacopofa92/millennium-duel-arena/check-runs/<id-job>/annotations`
  con un token) un agente la legge da solo. Un test fallito si ripete una
  volta: se passa al secondo colpo esce come «Test instabile» (avviso), se
  fallisce di nuovo la suite è rossa.
- **Cambia l'indirizzo del sito** (es. un dominio personalizzato): aggiorna
  `server.url` in `C:\AndroidDev\YuGiOhGameAndroidProd\capacitor.config.json`
  e in `android\app\src\main\assets\capacitor.config.json`, alza
  `versionCode`/`versionName` in `android\app\build.gradle`, ricompila
  (`.\gradlew.bat assembleDebug` con `JAVA_HOME=C:\AndroidDev\jdk21` e
  `ANDROID_HOME=C:\AndroidDev\Sdk`) e copia l'APK nella cartella del
  progetto (git la ignora).
- **Cambia il server Multiplayer**: il nome in `render.yaml` decide
  l'indirizzo, e cambiarlo crea un servizio NUOVO su Render (il vecchio va
  eliminato a mano). Poi aggiorna l'indirizzo predefinito in
  `multiplayer.html` (`#mpServerUrl`).

## Cosa NON è protetto (onestamente)

- Giocare richiede un account approvato (Supabase), ma il browser scarica i
  file del gioco PRIMA della schermata d'accesso: chi ha il link può salvarli.
  Sono minificati e senza commenti, quindi difficili da capire e riusare, ma
  non segreti. Il passo che chiuderebbe questo spiraglio è un controllo lato
  server (una funzione su Cloudflare che consegna i file solo a una sessione
  Supabase approvata): discusso, **non ancora fatto**.
- Il logo e i contenuti restano Yu-Gi-Oh!: il nuovo nome evita i marchi
  nell'indirizzo e nel nome del progetto, non rende il gioco privo di
  materiale protetto.

## Cosa è cambiato il 2026-10-11

Gioco
- **Menu Tutorial** (`tutorial.html`, voce Duelli › Tutorial): la lezione col
  nonno più tre lezioni brevi (Catena, Fusione, mostri Flip), tutte in
  `js/tutorial/tutorial-duel.js` con `?lezione=`; campo «La Città»; nessun
  file del motore le conosce.
- **Storia anime riallineata all'anime**: duelli e scene mancanti (Kaiba
  contro Gozaburo, i Cinque uniti, battaglia a quattro, terzo posto Kaiba
  contro Joey, Kisara, epiloghi), i laterali in cui il personaggio noto perde
  si giocano dalla parte del vincitore, i duelli persi da Yugi si vincono e una
  scena racconta la svolta vera. Migrazione dei salvataggi con `separazioni`
  `ids: [...]`.
- **Memorie Proibite riallineata al gioco PS1**: Seto tradisce solo alla fine,
  Heishin vuole gli Oggetti per sé, Shadi ha due Oggetti, ritorno in Egitto con
  Sadin, **Mage Soldier** (personaggio nuovo), rivincite di Jono e Teana; la
  Sacerdotessa Isis non è più nel passato.
- **Duello Sandbox solo per l'amministratore** (voce di menu e pagina).
- **Battaglia**: prima del calcolo dei danni il campo si rilegge invece di
  usare quello ricordato (errore reale `Cannot read properties of null`).

Test
- Su GitHub i test falliti diventano annotazioni `::error`, e un test fallito
  si ripete una volta (`::warning` «Test instabile» se passa al secondo).
- Sistemati diversi spec che fallivano solo su Linux (tempi, sessionStorage
  su file://, test rimasti indietro rispetto alla Storia).

Nome, pubblicazione e hosting
- Nuovo nome: **Yu-Gi-Oh! Millennium Duel Arena** (logo su tre righe
  YU-GI-OH! / MILLENNIUM / DUEL ARENA; tolto il sottotitolo «Battle for the
  Millennium», che era il titolo di un brano). Titoli delle pagine, manifest,
  `package.json`.
- Repository rinominato in `millennium-duel-arena` e reso **privato**.
- Sito spostato da GitHub Pages a **Cloudflare Workers**, con la copia
  minificata (`scripts/pubblica.js`, `scripts/verifica-pubblicazione.js`,
  esbuild come dipendenza di sviluppo).
- Server Multiplayer spostato su `millennium-duel-arena-relay` (Render);
  eliminati i servizi vecchi.
- APK di produzione ripuntata al sito Cloudflare, nome «Millennium Duel
  Arena», versione 1.2.0 (`MillenniumDuelArena-1.2.0.apk`).
- Suite completa su GitHub solo a mano o su pull request.

Ancora da fare
- Facoltativo: controllo Supabase lato server sui file (vedi sopra).

La cartella locale è già stata rinominata in
`...\Sviluppo\millennium-duel-arena`; i nomi `YuGiOhGameAndroid*` delle shell
native restano invece intenzionalmente invariati perché sono percorsi tecnici
esterni al repository.
