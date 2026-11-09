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

## Cosa fare su Cloudflare (in tre tempi)

Cloudflare permette di aggiungere un Secret solo a un Worker che ha gia' del codice, quindi:

1. **Merge in main con il cancello in transizione** (CANCELLO_MODO = transizione in wrangler.jsonc): il Worker parte, il sito resta aperto com'era.
2. Dashboard Cloudflare -> Workers & Pages -> millennium-duel-arena -> **Settings -> Variables and secrets -> Add**: Secret COOKIE_SECRET, valore casuale lungo (40+ caratteri). Appena c'e', il cancello si chiude da solo.
3. Portare CANCELLO_MODO a attivo (commit): da li' senza segreto i file riservati restano chiusi (503) invece di aprirsi.

Prova: finestra anonima -> .../duelMonstersCore.html deve riportare all'accesso; con un account approvato il gioco si apre.

## Come tornare indietro
Revert del merge e di nuovo il comando di deploy vecchio: il sito torna aperto com'era.

## Per chi tocca il codice
- Un file che `index.html` carica diventa pubblico da solo; per tenerne uno riservato, non farlo caricare a `index.html`.
- `tests/specs/cancello-solo-approvati.spec.js` prova il Worker senza rete (cookie, percorsi, `/__acc` con Supabase finto)
  e che motore, IA e dati restino riservati.
