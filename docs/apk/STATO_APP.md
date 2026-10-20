# Stato dell'app (APK) — `app-status.json`

L'APK (progetto Capacitor in `C:\AndroidDev\YuGiOhGameAndroidProd`) legge all'avvio, in parallelo al caricamento del
gioco, il file `app-status.json` che sta alla radice del sito (stessa origine di `server.url`). Si modifica qui nel
repository e va online col normale push su `main`: **non serve ricompilare l'APK**.

| Campo | Cosa fa |
|---|---|
| `manutenzione` (bool) | `true`: l'app mostra la schermata "Manutenzione in corso" (con il pulsante Riprova) invece del gioco. |
| `messaggio` (testo) | Frase mostrata sotto il titolo di manutenzione (max ~200 caratteri). Vuoto = testo di default. |
| `versioneMinimaApk` (numero) | `versionCode` minimo dell'APK. Chi ha una versione più vecchia vede "Aggiornamento necessario" e non entra. Il `versionCode` attuale è in `android/app/build.gradle` (oggi 26). |
| `versioneConsigliataApk` (numero) | Sopra la versione dell'APK in uso compare solo un avviso (toast) all'avvio, senza bloccare nulla. |
| `messaggioAggiornamento` (testo) | Frase della schermata di aggiornamento. |
| `urlAggiornamento` (https://…) | Dove scaricare il nuovo APK: se presente la schermata mostra il pulsante "Scarica l'aggiornamento". |

Se il file non si legge (rete assente, errore), l'app procede normalmente: un controllo che fallisce non blocca mai il
gioco. La lettura è nativa (`MainActivity.controllaStato`), quindi non passa dal Service Worker né dalla cache.
Le pagine locali dell'APK sono in `www/` (`errore.html`, `manutenzione.html`, `aggiornamento.html`) e il pulsante
Riprova richiama `ApkControlli.riprova()`, che ripete lo stesso controllo.
