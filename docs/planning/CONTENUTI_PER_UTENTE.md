# Contenuti opzionali per account

Branch: `codex/contenuti-per-utente`. Richiesta confermata il 10 novembre 2026.

Tre permessi indipendenti, modificabili soltanto dagli admin: WW1, WW2,
Extra (personaggi extra e Freedom). I nuovi utenti partono senza contenuti
opzionali; quelli esistenti conservano tutti gli accessi. Gli admin hanno
sempre accesso completo. Disabilitare non cancella carte, deck o progressi.

## Lavoro implementato

- [x] Colonne profilo e trigger che impedisce ai non-admin di cambiare i flag;
      migrazione `supabase/contenuti-per-utente.sql` applicata al progetto
      DuelArena. I profili già esistenti sono stati inizializzati con tutti i
      contenuti attivi; il default per le nuove registrazioni è disattivato.
- [x] Interruttori WW1/WW2/Extra nel pannello Gestione utenti. Gli admin hanno
      sempre accesso completo; le modifiche approvate aggiornano la pagina.
- [x] Classificazione e filtri condivisi per carte, personaggi, campi e storie;
      shop, ricompense, deck e duelli rifiutano gli usi non autorizzati senza
      cancellare dati salvati.
- [x] Relay Multiplayer: verifica token Supabase e profilo approvato; controlla
      i contenuti richiesti da tutti i partecipanti e protegge configurazione,
      deck, pedine, tag, raid, specchio e riconnessioni.
- [x] Copertura mirata per cache offline e cambio account, tentativi diretti,
      privilegi profilo, azioni Multiplayer e regressioni. Typecheck e gruppi
      script verificati; suite completa tentata ma non completata. I test
      Multiplayer che avviano server locali hanno avuto errori di avvio/timeout;
      gli altri problemi rilevati sono annotati nell'esito dei controlli.
- [x] Cambio account: ricarica la pagina solo se i permessi effettivi dei
      pacchetti differiscono, evitando reload superflui tra account equivalenti.

## Falle da evitare

- Filtrare distruttivamente `cardDatabase` può fare sparire carte dai deck:
  i cataloghi del motore restano completi, i controlli agiscono sugli utilizzi.
- I permessi non fanno parte del salvataggio importabile e non sono modificabili
  con `profiles_update_own` o con un JWT valido di un giocatore normale.
- La cache deve appartenere al singolo uid; nessun accesso ereditato da un altro
  account sullo stesso dispositivo. Offline vale l'ultima conferma ricevuta.
- Il relay in produzione richiede un token Supabase verificato e un profilo
  approvato; il client locale di sviluppo può ancora usare il protocollo senza
  login. I flag client non sono mai prova di autorizzazione.
- Un gioco che esegue le regole sul client, e ammette l'offline, non offre DRM:
  un browser modificato può aggirare controlli locali. Distinguere questo limite
  dal blocco effettivo dei privilegi cloud e dei messaggi multiplayer.

La cache offline usa l'ultima autorizzazione verificata per lo stesso uid: una
revoca o sospensione remota non può essere conosciuta senza rete. Il browser
può essere modificato localmente, quindi il blocco offline non è DRM; i dati
cloud e le operazioni Multiplayer sono invece controllati lato server.

Rilasciato in `main` con la versione 1.6.34. Il relay richiede autenticazione
in produzione; l'attivazione della protezione va distribuita insieme al client.
