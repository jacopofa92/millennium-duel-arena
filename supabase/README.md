# Accesso con approvazione admin + sincronizzazione Cloud (Supabase) — setup

**Un account approvato da un amministratore è OBBLIGATORIO per giocare** (replica dello stesso meccanismo del progetto "Fioxify", stesso autore): senza questi passaggi il gioco non è utilizzabile. Oltre all'accesso, questi passaggi attivano la sincronizzazione cross-device del salvataggio (nome, mazzi, record, valute) e delle carte create con il Card Maker.

## 1) Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com), crea un account (gratuito) e un nuovo progetto.
2. Aspetta che il progetto finisca di provisionarsi (1-2 minuti).

## 2) Crea le tabelle

1. Nella dashboard del progetto, apri **SQL Editor** → **New query**.
2. Incolla tutto il contenuto di [`schema.sql`](schema.sql) (in questa stessa cartella) e premi **Run**.
3. Verifica in **Table Editor** che siano comparse tre tabelle: `saves`, `custom_cards` e `profiles` (quest'ultima con le colonne `status`/`is_admin`), tutte con "RLS enabled".

## 3) Copia le credenziali

1. **Project Settings** (icona ingranaggio) → **API**.
2. Copia **Project URL** e la chiave **anon public** (MAI la `service_role`, che ha accesso pieno a tutto e non deve mai finire nel codice del browser).

## 4) Compila `js/cloud/supabase-config.js`

Apri `js/cloud/supabase-config.js` nel progetto e incolla i due valori:

```js
window.SUPABASE_CONFIG = {
    url: 'https://tuoprogetto.supabase.co',
    anonKey: 'eyJ...'
};
```

Salva. Ricarica il gioco: il gate di accesso (`index.html`) ora mostra il modulo Accedi/Registrati invece del messaggio "non configurato".

## 5) (Facoltativo) Email di conferma

Per default Supabase richiede la conferma email alla registrazione, IN AGGIUNTA all'approvazione admin descritta sotto (le due cose sono indipendenti). Per un progetto personale/di test puoi disattivarla in **Authentication** → **Providers** → **Email** → disattiva "Confirm email".

## 6) Crea il primo account amministratore

Nessun account è admin per default (altrimenti chiunque potrebbe auto-approvarsi). Per il primo:

1. Registrati normalmente dal gate del gioco (o da `admin.html` direttamente, che rimanderà al login) con l'email/password che vuoi usare come amministratore.
2. Nella dashboard Supabase → **SQL Editor** → **New query**, esegui:
   ```sql
   update public.profiles set is_admin = true, status = 'approved'
   where email = 'la-tua-email@esempio.it';
   ```
3. Accedi di nuovo dal gate: ora vedrai la voce **Admin** nel menu principale, che porta ad `admin.html` — da lì puoi approvare/rifiutare ogni futura registrazione senza toccare più l'SQL Editor.

## Come funziona in gioco

- **Registrati**: crea un account, che resta "in attesa di approvazione" finché un admin non lo approva da `admin.html` — **Accedi** rifiuta l'ingresso con un messaggio chiaro finché questo non succede.
- Dopo un accesso approvato, se esiste già un salvataggio sul cloud, il gioco chiede se usare quello (sovrascrive il locale) o mantenere quello locale (lo carica sul cloud, sovrascrivendo quello online) — mai una sovrascrittura silenziosa.
- **⬆️ Carica su Cloud** / **⬇️ Scarica da Cloud** (in Profilo): sincronizzazione manuale in qualunque momento, per tenere allineati due dispositivi.
- **Offline dopo il primo accesso** (rilevante soprattutto per l'APK Android): una volta autenticato online con un account approvato, il gioco resta utilizzabile offline su quello stesso dispositivo finché non viene rifiutato/revocato da un admin — vedi il commento su `CloudSync.ensureApprovedSession()` in `js/cloud/cloud-sync.js` per come funziona (non è una cache HTTP, è un marcatore per-utente scritto solo da una verifica online riuscita).

## Limiti onesti di questa prima versione

- Sincronizzazione a "sostituzione completa", non un vero merge: se giochi su due dispositivi contemporaneamente senza sincronizzare, l'ultimo che carica vince — non c'è unione intelligente dei progressi.
- Le immagini delle carte custom restano incorporate come base64 dentro la riga `custom_cards.card` (stesso formato di oggi in localStorage), non in Supabase Storage — funziona, ma per molte carte con immagini pesanti converrebbe migrare a Storage in futuro.
- Il Multiplayer (`server/server.js`) resta separato, non tocca Supabase — deliberatamente lasciato fuori da questa fase.
- Nessuna notifica automatica (email/push) agli admin quando arriva una nuova registrazione: bisogna aprire `admin.html` per accorgersene (stesso limite del progetto Fioxify, da cui questo meccanismo è replicato).
# Gestione utenze e note amministratore

## Accesso da un solo dispositivo

La migrazione `migrations/20261113120000_accesso_da_un_dispositivo.sql`
registra l'ultima sessione Supabase creata al login. Il database confronta
il `session_id` firmato nel token, quindi il rinnovo automatico del vecchio
dispositivo non gli permette di riprendersi l'accesso. Alla prima scrittura
successiva al nuovo login, salvataggi e carte personalizzate del dispositivo
precedente vengono rifiutati; il client lo riporta al login e mantiene la
copia locale per la riconciliazione futura. Le sessioni già aperte prima
dell'aggiornamento restano compatibili finché l'account non esegue un nuovo
login col client aggiornato.

La tabella delle sessioni ha RLS attiva senza accesso diretto ai client; il
claim passa da una RPC autenticata e i trigger del database proteggono tutte
le scritture su `saves` e `custom_cards`.

## Contenuti opzionali per account

Per un database esistente eseguire `contenuti-per-utente.sql`. La migrazione
è stata applicata al progetto DuelArena l'11 novembre 2026. Per installazioni
nuove, `schema.sql` contiene le stesse colonne e protezioni.

Ogni profilo ha tre permessi indipendenti: `content_ww1`, `content_ww2` e
`content_extra`. Le registrazioni nuove partono con tutti disattivati; la
migrazione mantiene l'accesso dei profili già presenti. Solo gli admin possono
modificarli e gli admin hanno accesso completo in gioco. Disattivare un
contenuto ne blocca cataloghi, uso, ricompense e avvio dei duelli, ma conserva
collezione, deck e progressi.

Il client conserva l'ultima autorizzazione online per uid, così lo stesso
account già verificato può giocare offline. Al cambio account la cache non si
trasferisce. Una revoca mentre il dispositivo è offline non è immediata. Il
relay Render verifica il token e il profilo e controlla i requisiti di tutti i
partecipanti; in produzione l'autenticazione è obbligatoria. Pubblicare il
client aggiornato insieme al relay evita che vecchi client senza token vengano
rifiutati.

Le limitazioni di accesso sul browser non sono DRM: un client modificato può
alterare i controlli locali. I permessi cloud e le azioni multiplayer sono
convalidati dal database/relay.

Per aggiornare un database già esistente, eseguire `admin-utenze.sql`.
L'aggiornamento è già stato applicato al progetto DuelArena il 10 novembre
2026. `schema.sql` include le stesse definizioni per le installazioni nuove.

Lo stato `suspended` nega l'accesso e le operazioni su salvataggi e carte
custom anche con un token ancora valido. La riattivazione riporta lo stato
ad `approved`, senza cancellare progressi. Gli account admin non sono
sospendibili. Il client riconferma lo stato ogni minuto in primo piano e
quando torna visibile; offline conserva il comportamento di accesso già
previsto dal gioco, quindi una revoca remota richiede una connessione.

Le note (massimo 4000 caratteri) sono in `admin_profile_notes`, separata da
`profiles` perché il giocatore può leggere il proprio profilo. Solo gli
admin possono leggere o scrivere le note, tramite RLS. Sono condivise tra
gli amministratori, mai consegnate al giocatore.

Verifica sul database: inserimento temporaneo nota, sospensione,
illeggibilità/riscrittura negata al giocatore, auto-riattivazione negata e
riattivazione da admin; transazione interamente annullata con `ROLLBACK`.

