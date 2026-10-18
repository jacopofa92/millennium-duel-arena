# Modalità "Forbidden Memories" — documento di progetto

Stato: **proposta, nessun codice scritto**. Scritto il 18 ottobre 2026.

## 1. Obiettivo e vincolo

Una modalità di gioco con le regole del Yu-Gi-Oh! Forbidden Memories (PS1),
scelta dal menu come un interruttore, che convive con il gioco attuale.

**Vincolo non negoziabile** (dall'utente): non toccare NIENTE del motore
attuale — `js/engine/`, `duelMonstersCore.html`, turni, effetti delle carte,
IA, `data/cards.json`. Il motore di Duel Monsters resta riutilizzabile così
com'è.

Questo esclude la strada delle modalità esistenti (Puzzle, Rivincite, Torre):
quelle cambiano solo la *preparazione* del duello e poi giocano col motore
attuale. Forbidden Memories cambia le **regole durante il duello**, quindi
serve un **motore di regole separato** che vive accanto a quello attuale.

## 2. Cosa cambia davvero rispetto a Duel Monsters

Da verificare su una fonte prima di scriverle nel codice (la convenzione del
progetto per le carte è YGOPRODeck, ma per FM serve una fonte dedicata):

- Regole da prototipo: **niente Evocazione con Tributo, niente mostri a
  effetto come oggi**, e la Fusione non passa da "Polimerizzazione" ma da una
  schermata di combinazione. (Confermato da Yugipedia/TV Tropes.)
- **Stelle Guardiane**: ogni mostro ha due stelle, si sceglie quale usare
  all'Evocazione; contro una stella più debole il mostro prende +500 ATK/DEF.
- **Terreno**: le Magie Terreno danno ±500 ATK/DEF per tipo/attributo.
- **Fusione** come sistema centrale; Rituali con tributi precisi.
- Da cercare, non affermate qui: numero di LP iniziali, grandezza di mazzo e
  mano, numero di caselle, come si vince oltre agli LP, come funzionano
  Trappole e Magie, tabella completa delle stelle, tabella delle fusioni.

## 3. Cosa si riusa e cosa no

| Si riusa (senza modificarlo) | Si scrive nuovo |
|---|---|
| Dati e immagini delle carte, `card-renderer` (solo come lettura) | Stato di gioco, regole, turni |
| Salvataggio, account, cloud, Sfide, valute | Risoluzione di fusioni e battaglie |
| Audio, topbar, page-loader, componenti UI | IA dedicata |
| Duellanti e immagini (`characters-db`) | Pagine e interfaccia del duello |
| Mazzi dei duellanti come punto di partenza | Dati FM (stelle, fusioni, terreni) |

Regola: la modalità **legge** i dati del gioco attuale, non li cambia. I dati
che servono solo a FM (stelle, tabella fusioni) stanno in file propri
(`js/fm/data/`), mai in `cards.json`.

## 4. Architettura proposta

```
js/fm/
  regole/       stato, turno, battaglia, fusione, terreno, vittoria (nessun document.)
  dati/         stelle.js, fusioni.js, terreni.js, carte-fm.js
  ia/           scelta delle combinazioni, posizione, attacchi
  ui/           campo, mano, schermata di fusione, scelta della stella
  fm-sessione.js  avvio, ritorno al menu, premi, Sfide
fm-duello.html  pagina del duello (propria lista di <script>)
types/fm.d.ts   le forme di stato, carta, mossa (con // @ts-check nei file)
tests/specs/fm-*.spec.js
```

Principi, gli stessi che hanno funzionato per il "nucleo senza testa":
- **Le regole non toccano la pagina**: nessun `document.` nelle regole. Un
  duello FM deve girare in Node, IA contro IA, come `tools/duello-senza-testa.js`.
  Questo è il test più prezioso che esista: migliaia di partite in secondi.
- **Mosse come comandi**: ogni azione (gioca, fondi, attacca, cambia
  posizione, passa) è un comando con argomenti semplici, registrabile e
  riproducibile. Prepara anche un eventuale Multiplayer, e rende i bug
  riproducibili con un seme.
- **Stato come dato**: un solo oggetto serializzabile, niente funzioni dentro.
- **Punto d'ingresso nel menu**: una voce in `index.html` che porta a
  `fm-duello.html`. È l'unica modifica a un file esistente, e non è motore.

## 5. Le Stelle Guardiane: un'alternativa più memorizzabile

Il problema: dieci nomi planetari con una ruota di vantaggi da imparare a
memoria. Alternative, dalla più alla meno consigliata:

**A) "Affinità": usare gli Attributi che il giocatore già conosce (consigliata).**
Le carte hanno già 6 Attributi: Fuoco, Acqua, Terra, Vento, Luce, Oscurità.
Si usano come "affinità" invece dei pianeti:
- una ruota semplice da leggere con le icone già presenti nel gioco
  (es. Fuoco > Vento > Terra > Acqua > Fuoco, e Luce e Oscurità che si
  battono a vicenda): in tutto due piccoli giri, non dieci nomi;
- l'affinità principale di un mostro è il suo Attributo, **senza dati da
  scrivere per ~1000 carte**; la seconda affinità si ricava dal Tipo con una
  tabella breve (Drago → Fuoco, Pesce → Acqua, ecc.);
- il giocatore sceglie quale usare all'Evocazione, come in FM, e l'interfaccia
  mostra **subito** "▲ vantaggio / ▼ svantaggio" contro il mostro di
  fronte: non serve ricordare la ruota, la ruota si vede.

**B) Pochi Sigilli astratti (5) con ciclo a pentagono**: ognuno batte i due
successivi e perde con i due precedenti, nomi a tema egizio. Facile da
ricordare come "sasso-carta-forbici", ma richiede di assegnare i sigilli a
mano a ogni carta.

**C) Tenere le dieci stelle ma con aiuti visivi**: icona e colore per stella,
ruota sempre visibile, anteprima del bonus. Fedele all'originale ma resta la
curva di apprendimento ripida.

Nome della meccanica: **"Affinità"** (non "Stella Guardiana"). Alternative:
"Presagio", "Sigillo".

Decisione da prendere: fedeltà all'originale (C) o chiarezza (A). Consiglio A:
in un gioco con ~1000 carte, un sistema che si ricava dai dati esistenti e
si legge a colpo d'occhio vale più della fedeltà ai pianeti.

## 6. La parte difficile: la Fusione

In FM la fusione è il cuore del gioco, ed è la parte con più dati. Due
approcci, da scegliere dopo aver letto una fonte:
1. **Tabella esplicita** delle combinazioni di FM: fedele, ma enorme e da
   inserire/verificare a mano.
2. **Regole per categoria** (Tipo + Attributo → risultato) più una tabella
   breve di eccezioni famose: molto meno dati, più veloce da fare, meno
   fedele.
Consiglio: iniziare con (2) per avere un gioco funzionante, e aggiungere
eccezioni a (1) per le fusioni più famose. Questo è il punto che decide
quanto la modalità "assomiglia" a FM: va deciso con l'utente.

## 7. Ordine dei lavori

1. **Fondamenta (solo regole, in Node)**: stato, turno, mano e mazzo,
   battaglia base, vittoria. Primo traguardo: una partita IA contro IA che
   finisce sempre, con un seme riproducibile. *Nessuna interfaccia.*
2. **Affinità e Terreno** nelle battaglie, con test sulla ruota completa.
3. **Fusione** (approccio 2 sopra), con test per ogni categoria.
4. **IA**: scelta della combinazione migliore, posizione, attacchi; due livelli.
5. **Interfaccia**: campo, mano, schermata di fusione, scelta dell'affinità;
   responsive (telefono in verticale e orizzontale) fin dall'inizio.
6. **Integrazione**: voce nel menu, premi in crediti, Sfide, salvataggio
   (`save.fm`), duellanti avversari dal roster.
7. **Rifinitura**: audio, animazioni, tutorial della modalità.

Ogni passo si chiude con test e un commit; il passo 1 da solo vale già come
verifica dell'idea.

## 8. Rischi

- **Portata**: è un secondo gioco. Senza un primo traguardo piccolo e
  giocabile, il lavoro non finisce.
- **Dati di fusione**: la fonte da cui prenderli va scelta e verificata prima.
- **Deriva dal gioco attuale**: se le carte cambiano nel gioco principale, la
  modalità deve continuare a funzionare; per questo legge e non modifica.
- **Tentazione di toccare il motore** "solo un po'": va rifiutata, anche per
  una carta sola. Se serve qualcosa che il motore non offre, si copia o si
  riscrive in `js/fm/`.

## 9. Scelta degli strumenti

- **Linguaggio**: JS con `// @ts-check` e tipi in `types/fm.d.ts`, come
  le modalità esistenti. Controllo dei tipi senza passaggio di build, e il
  progetto resta apribile con un doppio click. TypeScript con compilazione
  solo se un giorno si cambia l'intero progetto.
- **Modello**: *Opus 5.5* per il progetto delle regole (modello di stato,
  fusione, IA): sono le decisioni che costano di più se sbagliate. *Sonnet
  5.5* per l'implementazione a pezzi, i dati, l'interfaccia e i test. Parere,
  non una misura.

## 10. Decisioni aperte (servono all'utente)

1. Affinità (A), Sigilli (B) o le dieci stelle con aiuti (C)?
2. Fusione: per categoria con eccezioni, o tabella completa?
3. Si usano le carte attuali (con ATK/DEF che hanno già) o un set dedicato?
4. Quanto fedele alle regole originali, e dove invece semplificare?
5. Solo contro l'IA, o anche Multiplayer? (Il progetto a comandi lo permette.)
