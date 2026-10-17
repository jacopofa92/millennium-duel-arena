# TODO

Lista di lavoro aggiornata al 9 ottobre 2026. Codex riprende il 14 ottobre.

## 1. Liberare spazio sul disco C: — subito

Il 9 ottobre il disco era a 0 GB liberi (poi circa 0,9 GB). Con così poco spazio
possono fallire git, i test, OneDrive e il lavoro di Codex.

- [ ] Pulizia disco di Windows, con "Pulisci file di sistema".
- [ ] Svuotare la cartella Download e il Cestino.
- [ ] OneDrive: impostare "File su richiesta" sulle cartelle che non servono offline.
- [ ] Obiettivo: almeno 15-20 GB liberi.

## 2. Test rossi su `main` — prima che riprenda l'audit dei duellanti

Falliscono su `main` anche senza il lavoro grafico e di sync del 9 ottobre
(verificato). Gli unici cambiamenti di quel giorno a carte, motore e IA sono i
commit dell'audit dei duellanti (Toon, Pegasus, Yami Yugi, audit della serie
principale).

- [x] `duello-gemello` — sistemato: Controllore del Nemico (oggi ID 226; il vecchio doppione 845 è stato rimosso) usava una
      variabile inesistente nella modalità "cambia Posizione"; a passo comune
      gli uid dei Token dipendevano dal generatore di tutta la partita.
- [x] `duello-senza-testa` — sistemato: la partita d'esempio (seme 473) non
      passava più dal caso dopo il ribilanciamento dei mazzi; ora Pegasus
      contro Joey, seme 466.
- [x] `guardrail-bersagli-dichiarati` — sistemato: il guardrail non conosceva
      `declareTargetWaiting`; le 16 carte erano già a posto.
- [ ] Quel controllo di `duello-senza-testa` resta fragile: un altro cambio di
      mazzi può far sparire di nuovo il caso. Meglio un test che costruisce la
      situazione a mano invece di cercarla in una partita simulata.

## 3. Prove a mano sul telefono (APK) e sul PC

I test automatici coprono queste cose, ma alcune si giudicano solo dal vero.

- [ ] **Sync**: giocare sul desktop, aprire l'APK e controllare che arrivino i
      progressi (e viceversa).
- [ ] **Storie azzerate**: riaprendo il gioco le storie devono essere ripartite
      da zero, su entrambi i dispositivi. Carte, crediti, mazzi e Sfide restano.
- [ ] **Carte vive**: nell'APK aprire la scheda di una carta Super o Segreta e
      inclinare il telefono. Se l'effetto è troppo forte o debole, si regola con
      `GRADI_MASSIMI` in `js/ui/card-renderer.js`.
- [ ] **Profondità del menu**: provarla e spegnerla dalle Impostazioni.
- [ ] **Effetti del duello**: due duelli veri — scoprire un mostro coperto,
      metterne uno in Difesa, guardare ATK/DEF che cambiano, i Life Point sotto
      1000.
- [ ] **Editor Mappa**: "📂 Collega file" su `js/data/story-ritocchi.js` e
      modificare un nodo; poi commit e push del file.

## 4. Suite completa

- [ ] Lanciarla quando i test del punto 2 sono verdi e Codex ha chiuso il suo
      giro. Il 9 ottobre sono entrate molte modifiche ed è stata eseguita solo
      una parte mirata dei test.

## 5. Aperti, non urgenti

- [x] `modalita-storia` e `storia-livelli`: la carta in premio "Spirit Message"
      e la schermata di caricamento coprivano il clic del test. Chiuso con
      `liberaLaPagina` in `tests/helpers/harness.js` (10 ottobre).
- [ ] Strumenti di simulazione della Storia (`tools/simula-storia-deck.js`,
      `tools/audit-fattoriale-storia.js`): non leggono i ritocchi dell'Editor
      Mappa. Se si cambia un avversario dall'editor, le simulazioni non lo sanno.
- [ ] Azzeramento del profilo da un dispositivo: verificare dal vero che gli
      altri dispositivi non lo riportino in vita.
- [ ] Idea grafica rimasta fuori: le pile del Deck e del Cimitero con uno
      spessore vero.
- [ ] Cartelle rimaste in `.git/worktrees` bloccate dai permessi della sandbox
      di Codex: `git worktree prune` quando Codex non lavora.
