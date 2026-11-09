# Accesso solo per account approvati, controllato dal SERVER

## Il problema
Il cancello di `js/cloud/auth-gate.js` gira nel browser: chi lo disattiva, o apre i file in locale, giocava senza account.
Il cloud (salvataggi, carte) era già protetto da Supabase; il gioco no.

## Cosa fa ora
Un Cloudflare Worker (`worker/gate.mjs`, configurato da `wrangler.jsonc`) sta DAVANTI ai file del sito e li consegna
solo a chi ha il cookie `ygo_acc`.

- **Pubblico** (serve per fare l'accesso): `index.html`, i file che `index.html` carica (l'elenco lo scrive
  `scripts/pubblica.js` in `dist/_pubblici.json`), `sw.js`, `manifest.json`, `app-status.json`, e le cartelle
  `images/`, `audio/`, `video/`, `assets/`.
- **Riservato**: ogni altra pagina, il motore del duello, l'IA, i dati delle carte, ogni altro script. Senza cookie una
  pagina riporta a `index.html?accesso=1` e un file è un 401.
- **Il cookie** lo emette solo il Worker (`POST /__acc`), dopo aver chiesto a Supabase se l'account è approvato (o
  amministratore). È firmato (HMAC-SHA256), HttpOnly, Secure, SameSite=Lax, dura **6 ore**. Il gioco lo rinnova da solo
  (`aggiornaAccessoServer` in `cloud-sync.js`) a ogni verifica riuscita; un account revocato smette di entrare al più alla
  scadenza del cookie. L'uscita (`signOut`) lo toglie (`DELETE /__acc`).
- Il Service Worker, prima dell'accesso, salta i file che rispondono 401 invece di fallire l'installazione.
- In locale (file://, localhost, test) il Worker non c'è e `/__acc` non viene chiamato: non cambia niente.

## Cosa resta fuori (da sapere)
- Il **relay Multiplayer** su Render non controlla gli account: per usarlo serve però il gioco, che ora è riservato; chi
  scrivesse un proprio client potrebbe comunque collegarsi. Chiuderlo richiede di far verificare un token al relay.
- Chi è approvato può scaricare i file riservati (li deve poter eseguire): la protezione impedisce di GIOCARE senza
  approvazione, non di copiare il codice a chi è approvato.
- Offline (APK già usato): le pagine in cache del Service Worker si aprono anche senza rete, come prima.

## Cosa fare su Cloudflare (UNA volta, prima del merge in `main`)
1. Dashboard Cloudflare → Workers & Pages → `millennium-duel-arena` → **Settings → Variables and Secrets** →
   aggiungi il **Secret** `COOKIE_SECRET` con una stringa casuale lunga (es. 40+ caratteri). Non va messo nel repository.
2. **Settings → Build**: il comando di deploy oggi è
   `npx wrangler deploy --assets=./dist --name=millennium-duel-arena --compatibility-date=2026-10-01`.
   Con `wrangler.jsonc` nel repository basta `npx wrangler deploy` (il resto è nel file). Il comando vecchio funziona
   ancora, ma conviene il nuovo.
3. Fai il merge in `main` solo DOPO il punto 1: senza `COOKIE_SECRET` il Worker tiene chiusi i file riservati (risponde
   503) e nessuno potrebbe giocare, te compreso. La pagina di accesso resta raggiungibile.
4. Prova: finestra anonima → apri `.../duelMonstersCore.html` → deve riportare all'accesso. Accedi con un account
   approvato → il gioco si apre. Con un account in attesa → "in attesa di approvazione".

## Come tornare indietro
Revert del merge e di nuovo il comando di deploy vecchio: il sito torna aperto com'era.

## Per chi tocca il codice
- Un file che `index.html` carica diventa pubblico da solo; per tenerne uno riservato, non farlo caricare a `index.html`.
- `tests/specs/cancello-solo-approvati.spec.js` prova il Worker senza rete (cookie, percorsi, `/__acc` con Supabase finto)
  e che motore, IA e dati restino riservati.
