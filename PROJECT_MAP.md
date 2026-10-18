# Yu-Gi-Oh! Millennium Duel Arena — mappa tecnica persistente

Ultimo aggiornamento verificato: 2026-10-18.

## Duellanti Extra storici (2026-10-18)

Alberto Angela e Alessandro Barbero sono duellanti completi della sezione
Extra, subito disponibili perché non appartengono a un percorso di sblocco in
Storia o Torneo. Ognuno dispone di ritratto, avatar trasparente e pedina, tre
mazzi da 40 carte e battute contestuali complete. Alberto usa una legione di
Guerrieri, comandanti e difese imperiali guidata da Gilford la Leggenda;
Barbero usa una corte cavalleresca Re/Regina/Jack che nei livelli superiori
converge nel Cavaliere Joker Arcano. Tutte le carte provengono dal database
Yu-Gi-Oh già implementato.

Il guardrail `duellanti-extra-storici` verifica risorse, collocazione nel
roster, disponibilità, tre livelli, origine delle carte, Extra Deck e dialoghi.
Il controllo globale `mazzi-livello-facile` resta verde. Una matrice mirata di
30 duelli Hard per personaggio non ha rilevato stalli o invarianti rotte e ha
osservato realmente sia i comandanti di Alberto sia la fusione Joker di
Barbero.

## Pausa lifecycle dei duelli offline (2026-10-17)

`js/engine/pausa-duello.js` e' l'arbitro centrale dei timer sospendibili. Nei
duelli offline, `visibilitychange`, `pagehide` e il lifecycle Capacitor
congelano IA, transizioni, filmati, musica, ambiente e cronometro; al ritorno
serve un tocco esplicito su `Riprendi il duello`, dopo il quale le callback
scadute vengono liberate una sola volta. Il ripristino delle decisioni gia'
esistente resta attivo. Il Multiplayer non entra mai in questa pausa locale,
per non separare i due motori a passo comune.

## Nuclei Yugi: Magnetici e Cavalieri delle Figure (2026-10-16)

Sei carte TCG pre-GX completano i due nuclei: Gamma/Valkyrion e Regina/Re/
Jack/Cavaliere Joker Arcano (ID 1277-1282). Gli effetti riusano le primitive
condivise di Evocazione Speciale, Fusione e dichiarazione del bersaglio; il
test dedicato copre campo pieno, costi misti mano/Terreno, separazione di
Valkyrion, chiamata dal Deck del Re e negazione una volta per turno del Joker.
La IA Difficile può ora avviare le procedure proprie di Evocazione Speciale
dalla mano; Media e Facile restano invariate.

L'audit riproducibile `tools/audit-yami-magnetici-cavalieri.js` confronta sei
varianti su 50 duelli per ciascuno di cinque avversari Hard, più il deck
personale Custom come metrica separata. Nessuna variante supera stabilmente
la baseline, quindi i deck pubblicati di Yugi Muto e Yami Yugi non sono stati
alterati. Risultati in
`reports/archetypes/YAMI_MAGNETICI_CAVALIERI_AUDIT.json`.

## Mano stabile e fronte carte ripristinato (2026-10-14)

Il bordo scuro sperimentale sul fronte delle carte è stato rimosso: resta la
cornice colorata precedente, sia nelle carte normali sia nelle miniature. Un
ulteriore audit del flicker ha trovato che `reconcileHandCards` conservava
l'identità dei nodi ma li spostava tutti in un `DocumentFragment` a ogni
`updateUI`, staccandoli temporaneamente dal documento e costringendo alcune
WebView a ridipingerli. La mano ora lascia completamente intatte le carte già
nella posizione corretta e muove soltanto quelle davvero nuove o riordinate.
Il test prolungato verifica anche che 80 ridisegni invariati producano zero
rimozioni dalla mano, oltre a zero nuove decodifiche e zero nodi FX residui.

## Mondo dei Ricordi e Duello Cerimoniale completi (2026-10-14)

L'ultima area della Storia anime percorre ora entrambi gli archi conclusivi
senza condensarli in tre scene: sfida di Bakura e duello con Kaiba, arrivo al
Cairo e cartiglio di Téa, Labirinto del Puzzle, incoronazione e sacerdoti,
primo scontro con Diabound, sacrificio di Mahad, caccia ai Ka, caduta di
Slifer, tempo riavvolto, Kul Elna, Kisara e Aknadin, ricerca del nome, Yugi
contro Bakura, battaglia completa contro Zorc, Horakhty e ritorno dai ricordi.
Il raccordo verso il rito comprende la tempesta e il jet di Kaiba; l'epilogo
termina in Giappone con Rebecca e Arthur. Il vecchio laterale inventato
«Seto contro il Re dei Ladri» conserva il proprio id di salvataggio, ma ora
rappresenta correttamente Atem contro Seto posseduto da Aknadin.

I nodi seguono le zone illustrate dalla mappa (presente, Puzzle, palazzo,
oscurità centrale, tempio e aeroporto), con rami laterali che non avanzano la
linea principale. Undici migrazioni puntuali mantengono stabile il progresso
dei salvataggi già esistenti; il guardrail narrativo controlla cronologia,
distanze, avversari e contenuto dell'epilogo.

## Retro carta, flicker residuo ed epilogo anime (2026-10-13)

Il retro Duel Monsters usa lo stesso raggio sia sul bordo esterno sia sulla
cornice marrone interna. Il flicker residuo non dipendeva più dalla sostituzione
dei nodi visibili: a ogni `updateUI` venivano comunque creati nodi provvisori con
un `src`, poi scartati dalla riconciliazione. Chromium ne accodava ugualmente la
decodifica e il compositing. `CardRenderer` ora differisce le sorgenti durante i
render di campo e mani e le assegna soltanto ai nodi effettivamente entrati nel
documento; `flicker-duello-prolungato` verifica anche zero assegnazioni inutili
in 80 ridisegni invariati. La campagna anime termina infine con una scena
discorsiva all'aeroporto del Cairo, nella parte bassa della mappa finale, con
migrazione dedicata dei salvataggi.

## Flicker progressivo del duello (2026-10-13)

La riconciliazione di campo e mani usa una firma immutabile dello stato al
momento del render. Non confronta piu' l'`outerHTML` vivo: caricamento delle
immagini, compressione dei titoli e classi temporanee degli FX lo modificano
dopo il render e facevano quindi distruggere e ricreare carte ancora identiche.
Il costo visivo cresceva insieme alle carte presenti e diventava evidente anche
all'avvio dei video. Lo spec `flicker-duello-prolungato` riempie campo e mano e
verifica che tutti i nodi sopravvivano a 80 ridisegni consecutivi.

## Dettagli bustine e filmati di Evocazione (2026-10-13)

- Il carosello dello sbustamento cattura il puntatore soltanto dopo un vero
  trascinamento: un click breve resta sulla carta e apre `CardDetail`. Anche la
  variante con movimento ridotto collega ora ogni carta alla scheda dettagli.
- La nuova impostazione `summonVideos` e' accesa di default, vive nel salvataggio
  e nella cache locale ed e' disponibile sia nella pagina Impostazioni sia nella
  vista integrata del menu. Se spenta, il motore non cerca il filmato dedicato e
  passa subito all'effetto di Evocazione normale; fusioni ed effetti restano.

## Ordinamento stabile della Cartoteca (2026-10-13)

Gli ID delle carte non vengono modificati. L'ordine predefinito delle due viste
Cartoteca e' ora esplicito: tutte le carte Yu-Gi-Oh in ordine di ID crescente,
poi tutte le carte della Grande Guerra. Filtri e ordinamenti alternativi non
cambiano; la voce predefinita del selettore si chiama `Catalogo originale`.

## Login e paginazione Cartoteca (2026-10-12)

- Il gate iniziale conserva lo stesso flusso cloud, ma presenta una card piu'
  leggibile e coerente con l'arena: introduzione, etichette persistenti,
  focus evidente, gerarchia visiva e variante compatta per schermi bassi.
- `cartoteca.html` mostra al massimo 300 carte per pagina; filtri e ordinamento
  continuano a riportare alla prima pagina, mentre i pager mantengono la pagina
  scelta dall'utente.
- Correzione del 2026-10-13: lo stesso limite e' applicato anche alla vista
  Cartoteca integrata in `index.html`, che era rimasta separatamente a 400.
- Nelle griglie, foil e glitter si attivano ancora sulla carta puntata, ma la
  sorgente luminosa resta stabile mentre soltanto l'inclinazione viene composta
  dalla GPU. La scheda grande conserva invece la luce dinamica completa.
- Le stelle Livello sono leggermente piu' piccole e non vanno a capo: i mostri
  Livello 12, incluso Drago Bianco Occhi Blu Finale, restano dentro la cornice.
  Il 2026-10-13 dimensione e spaziatura sono state ridotte ancora di un margine
  minimo per evitare lo sforamento visivo residuo del Drago Bianco Definitivo.

## Revamp Forza dello Specchio (2026-10-12)

`FX.playMirrorForce` colloca la barriera davanti al lato difensore e usa
quella stessa coordinata come origine reale dei raggi. Il disco e' piu' ampio;
ogni mostro in Attacco riceve fascio e impatto dedicati, con aura, flare e
frammenti prospettici. La scena dura 2200 ms senza cambiare la regola TCG.

## Revamp Cilindro Magico (2026-10-12)

`FX.playMagicCylinder` usa come destinazione `#playerHand`/`#botHand` del
duellante che riceve il danno, mai l'avatar. La scena comprende due portali
piu' grandi, tre segmenti di energia, sigillo prospettico, impatto, onde e
particelle; durata e test sono stati riallineati a 2200 ms.

## Seconda correzione flicker e consultazione carte (2026-10-12)

- Nessun pulsante informativo permanente: sul Terreno una pressione di
  520 ms (oppure il clic destro) apre il dettaglio senza eseguire il comando
  di gioco; il tap breve continua a scegliere, attaccare o sacrificare.
- `renderPlayerHand` e `renderBotHand` riconciliano i nodi per uid/posizione:
  una carta immutata conserva immagine decodificata e layer fra due `updateUI`.
- Il player video non usa piu' transizioni di opacita': backdrop e primo
  frame diventano visibili insieme con un cambio atomico di `visibility`.
- Rimosso dal template del popover Attacco/Difesa un commento JavaScript che
  veniva erroneamente mostrato come testo, come documentato dalla foto mobile.

## Filmati del duello senza flicker (2026-10-12)

- `js/ui/effects.js` prepara il video con `preload=auto` e mostra player e
  fondale soltanto sul primo frame consegnato dal decoder
  (`requestVideoFrameCallback`, con fallback a doppio RAF).
- `js/ui/effects.css` evita blur, maschere, ombre e cambi di overflow su
  superfici grandi quanto lo schermo; la transizione usa solo l'opacita'.
- Durante il video `FieldAmbience` sospende timer e timeline GSAP, mentre
  `MonsterHolograms` esclude il proprio layer dal rendering. Entrambi
  riprendono dopo la chiusura completa dell'ultimo video attivo.
- Verifiche mirate: priorita' video, cinematica Exodia, ambienti field e
  ologrammi.

## Progressione delle modalità e consultazione sul Terreno (2026-10-12)

Le Regole si aprono dal menu Tutorial. La Torre dei Duellanti richiede il
completamento del capitolo Regno dei Duellanti nella Storia anime; le
Rivincite richiedono l'intera campagna anime conclusa in almeno una delle tre
difficoltà. `js/modes/mode-unlocks.js` è la fonte unica usata sia dal menu sia
dalle pagine dirette, così l'URL non aggira il blocco.

Durante il duello il tap sulla carta resta dedicato all'azione corrente. Ogni
carta sul Terreno ha però un piccolo comando `i` che forza volontariamente il
dettaglio anche durante Tributi, bersagli o Battle Phase, senza consumare la
scelta. Le scelte obbligatorie di casella e Posizione restano non annullabili,
ma non mostrano più frasi sovrapposte al campo.

## Consultazione carte durante il duello (2026-10-12)

Il pannello informazioni ora distingue centralmente la consultazione da un
comando di gioco. Tap e hover normali continuano a mostrare la carta, anche
fuori dalla Main Phase; durante attacchi, Tributi, scarti, piazzamenti e
decisioni obbligatorie il click raggiunge invece soltanto l'azione richiesta.
L'inizio di una scelta chiude un eventuale dettaglio rimasto aperto e una
breve memoria del pointerup impedisce al click sintetico successivo a un
attacco di riaprirlo. Regressione: `card-info-solo-consultazione`.

## Tutorial specifici e nuovi Puzzle (2026-10-14)

Il menu Tutorial comprende ora sette lezioni: oltre al duello col nonno e a
Catena, Fusione e Flip, ci sono Equipaggiamenti, Evocazione Rituale e Magie
Rapide. Restano sandbox guidate isolate in `js/tutorial/tutorial-duel.js`:
preparano uno stato controllato, ma fanno eseguire le azioni al motore reale.

I Puzzle "vinci in questo turno" sono dodici. I quattro nuovi scenari
insegnano l'ordine corretto con Buco Nero, il costo di Tributo ai Dannati, il
cambio ATK/DEF con Libro della Luna e la somma dei Livelli per il Rito del
Fulgore Nero. Ogni soluzione viene giocata realmente dallo spec
`modalita-puzzle`; i traguardi delle Sfide sono stati riallineati a 12.

## Completamento carte TCG prima serie (2026-10-12)

Il perimetro LOB/MRD/SRL/PSV/LON/LOD/PGD è stato completato sul branch
`feature/carte-prima-serie-tcg`: alle 26 carte mancanti si sono aggiunti i
quattro Mostri Normali richiesti come Materiali dalle nuove Fusioni, per un
totale reale di 30 carte (id 1131-1160), tutte con artwork ufficiale locale.
Le 16 Fusioni usano il percorso condiviso dell'Extra Deck; le dieci carte
Effetto hanno introdotto agganci generici per pescata sostituita, ritorno nel
Deck, numero reale di Tributi, Materiali da Fusione, Special Summon sul
Terreno avversario e scelta difensiva del bersaglio d'attacco. Guardrail:
`prima-serie-fusioni-mancanti` e `prima-serie-effetti-mancanti`.

Il seguito è già segnato in `docs/planning/WORK_IN_PROGRESS.md`: prima un
nuovo audit di Negozio/Cartoteca/ottenibilità e farming delle carte, poi la
simulazione dei deck avversari Facile/Medio/Difficile e dell'IA. Starter e
Structure restano invariati; ogni eventuale modifica ai deck avversari deve
restare coerente con la lore e partire da misure riproducibili.

## Nuovo nome, repository privato, sito su Cloudflare (2026-10-11)

Il gioco si chiama **Yu-Gi-Oh! Millennium Duel Arena**. Il repository è ora
privato (`jacopofa92/millennium-duel-arena`); il sito non sta più su GitHub
Pages ma su Cloudflare Workers, che a ogni push su `main` esegue
`npm run pubblica` e pubblica la copia minificata in `dist/`. Server
Multiplayer: `millennium-duel-arena-relay` su Render. Suite completa su GitHub
solo a mano o su pull request. Tutto il dettaglio (come funziona, cosa fare
aggiungendo file o cartelle, cosa è cambiato oggi in Tutorial, Storia anime,
Memorie Proibite, test e hosting) sta in **`PUBBLICAZIONE.md`**.

## Mage Soldier: identita' visiva e deck (2026-10-11)

Il placeholder di Mage Soldier e' stato sostituito da un ritratto definitivo
coerente con il personaggio di Forbidden Memories. Le tre risorse condividono
la stessa figura: `images/characters/mageSoldier.jpg` per le schede del Duello
Libero, l'originale scontornato in `avatarTrasparenza/mageSoldier.png` e la
pedina ottimizzata 320x320 in `pedine/mageSoldier.png`.

L'audit del deck ha chiuso tre linee che esistevano soltanto sulla carta:
Evocatore di Illusioni ora trova Re dei Musicisti nell'Extra Deck Facile e
Medio; Distruttore accetta i Segnalini Magia esterni; IA Media (e quindi anche
Hard) usa le rimozioni di Distruttore e Mago dell'Esplosione solo quando hanno
un bersaglio nemico utile. Nel Difficile, i due Abili Maghi Oscuri privi di
Mago Nero sono stati sostituiti da Bestia Mitica Cerbero, coerente col piano a
Segnalini e Magie. Guardrail: `mage-soldier-deck-ai`.

Misura riproducibile, 50 duelli per livello contro Yugi Muto Medio, stessi
semi: Mage Soldier vince 11/50 Facile, 32/50 Medio e 41/50 Difficile; nessun
errore, invariante o duello al limite. La curva e' quindi netta senza cambiare
Starter o Structure Deck.

## Apertura immediata del Duello Libero (2026-10-10)

Nella vista SPA di `index.html` la topbar viene disegnata nello stesso turno
del click, prima dei moduli lazy della configurazione del duello. Prima la
vista appariva subito ma la barra aspettava tre file, creando un vuoto visibile
al primo accesso soprattutto su mobile. CSS e JavaScript lazy ora partono in
parallelo, l'initializer restituisce la propria Promise e un tocco anticipato
su un Duellante aspetta quella stessa Promise invece di andare in errore.
Non e' stato allungato il loader: il difetto era nell'ordine di inizializzazione.

### Miniature dei selettori (2026-10-17)

La griglia dei Duellanti non decodifica piu' i ritratti originali da
1024/1254 px dentro tessere da circa 150-190 px: usa i WebP 512x512 sotto
`images/characters/thumbs/`, caricando con priorita' soltanto i primi otto.
Il selettore Arena condiviso fra Duello Libero e Multiplayer usa invece
`images/fields/thumbs/` (480x300) e assegna lo sfondo tramite
`IntersectionObserver`, quindi i field fuori dallo strip orizzontale non
partono tutti insieme. Gli originali restano invariati e sono ancora usati
nel duello e nelle scene. Le due serie di asset si rigenerano con
`npm run build-ui-thumbnails`; il guardrail e' nello spec
`duello-libero-config-responsive`.
Guardrail: `duello-libero-topbar-immediata`.

Lo strumento `tools/simula-economia.js` misura il farming leggendo direttamente
le tabelle pubblicate da `Rewards` e `ShopCatalog`; lo scenario e i risultati
di riferimento sono conservati in `docs/economy/FARMING_REPORT.md`.

## Economia graduata per difficolta' (2026-10-10)

Il ritmo del farming non e' piu' quasi uniforme: una vittoria libera paga
30/50/80 crediti e la Stella casuale ha probabilita' 2%/5%/9% rispettivamente
a Facile/Normale/Difficile. Perdere paga 15 crediti, la prima vittoria del
giorno 100; i rendimenti dimezzati dopo la quinta vittoria restano il freno
alle maratone di crediti.

Anche il completamento dei tornei usa tabelle esplicite per difficolta':
650/825/1000 crediti; il Regno paga 14/19/24 Stelle, mentre Battle City e
Kaiba ne pagano 3/5/8 in aggiunta rispettivamente a 1/2/3 Carte Locazione e
1/1/2 Carte del Millennio. La prima vittoria
assoluta non raddoppia piu' il premio (che favoriva troppo il Difficile):
aggiunge 500 crediti e 4 Stelle / 1 Locazione / 1 Millennio secondo il torneo.

Nel Negozio lo Starter Yugi gratuito del profilo non conta piu' come acquisto:
il primo Starter realmente scelto costa quindi le 18 Stelle dichiarate. Una
carta Leggendaria in rotazione richiede 2 Carte del Millennio. La regressione
e' in `tests/specs/economia-difficolta.spec.js`; ogni numero mostrato al
giocatore continua a nascere dalle stesse tabelle applicate dalla logica.

Ogni 10 vittorie libere allo stesso livello si ricevono inoltre 1/2/3 Stelle;
i tre contatori sono persistenti e separati per impedire di preparare nove
vittorie Facili e riscuotere con una Difficile. Le missioni settimanali
sorteggiate valgono in media 6,67 Stelle se completate tutte. La crescita dei
mazzi ha ora un tetto: Starter 18→54 (+6) e Structure 35→75 (+8), per 957
Stelle complessive invece di 1.643. Lo scenario intensivo aggiornato e' in
`docs/economy/FARMING_REPORT.md` ed e' riproducibile con `node tools/simula-economia.js`.

## Audio web e APK

`js/audio/audio-manager.js` espone sempre la stessa facciata `DuelMusic`, ma
usa due backend distinti. Nel browser resta un elemento HTML Audio: traccia e
posizione vengono salvate in `sessionStorage` a ogni aggiornamento, cambio
pagina e passaggio in background; se la policy di autoplay blocca la ripresa,
il primo gesto reale dell'utente la sblocca. Nell'APK la sola soundtrack passa
invece al plugin Capacitor `NativeMusic`, basato su `MediaPlayer`: vive nel
Bridge Android e quindi continua senza interruzioni quando la WebView cambia
documento. Effetti, voci e jingle rimangono nella WebView e non si mescolano al
player persistente.

Le sorgenti native sono esterne a questo repository, nelle due shell storiche
`C:\AndroidDev\YuGiOhGameAndroid` e `C:\AndroidDev\YuGiOhGameAndroidProd`.
In entrambe il plugin è `android/app/src/main/java/com/jacopofa92/
yugiohduelarena/NativeMusicPlugin.java`, registrato da `MainActivity.java`.
La build di produzione verificata è `1.3.2` (`versionCode 25`), si chiama
«Millennium Duel Arena» e carica il sito Cloudflare indicato in
`PUBBLICAZIONE.md`. I nomi delle cartelle native non sono stati rinominati e
non coincidono più col nome pubblico del gioco.

La correzione introdotta con la cache `v173` impedisce al Service Worker di
salvare richieste con header `Range` o risposte HTTP 206: Cache Storage non
supporta risposte parziali e il vecchio tentativo faceva fallire soundtrack
perfettamente valide con `ERR_FAILED`. Anche un errore di `cache.put` non
annulla più la risposta di rete. La cache corrente è indicata in «Stato
rapido». Guardrail: `service-worker-cache` e `audio-nativo-persistente`.

## Rework acquisizione carte

La fonte di verità di requisiti, probabilità e prezzi è
`docs/economy/CARD_ACQUISITION.md`. La logica speciale è in
`js/economy/card-acquisition.js`; rarità, commercio e accrediti restano
separati rispettivamente in `card-rarity.js`, `shop-catalog.js` e
`rewards.js`. Pity e traguardi sono persistiti nel campo `cardAcquisition`
del salvataggio.
Il costo in vittorie è misurato in modo riproducibile da
`tools/simula-farming-carte.js`; risultati e giudizio sono in
`docs/economy/FARMING_REPORT.md`.

La cerimonia di una carta premio vive in `card-drop-animation.js`: la
rivelazione dura circa 2,5 secondi e non può essere chiusa a metà. Usa uno
sfondo opaco senza griglia, poche particelle e trasformazioni separate per
restare fluida anche nella WebView Android. Il riepilogo
dello sbustamento in `pack-opening.js` è un carosello orizzontale: pan nativo
su touch, trascinamento e rotellina su desktop; uno swipe non apre il dettaglio.

Le carte vive (`card-renderer.js` + `card.css`) mantengono laminatura e
glitter completi nella scheda grande, ma nelle griglie/file dipingono i layer
con maschere e blend mode soltanto sulla carta sotto il mouse; su touch il
dettaglio completo si vede aprendo la scheda. Gli aggiornamenti del puntatore
sono limitati a uno per frame, l'ondeggiamento a riposo anima solo il transform
composito e si sospende quando la carta grande non è visibile. Questa è una
scelta di prestazioni deliberata: non riattivare gradienti animati su tutte le
miniature contemporaneamente. Guardrail: `carte-vive-e-parallasse`.

Questo file è la memoria breve e stabile del progetto. Va letto all'inizio di
una nuova sessione prima di scandire di nuovo l'intero repository. Per la
cronologia dettagliata delle decisioni e delle correzioni precedenti resta
valido `CLAUDE.md`; per la separazione e il possibile riuso del motore vedere
`docs/architecture/GUIDA_RIUTILIZZO.md`. Le regole operative per un agente sono in `AGENTS.md`.

## Bilanciamento deck nella Storia

L'audit esteso degli altri 31 duellanti anime è documentato in
`docs/audits/MAIN_DUELISTS_AUDIT.md` e nei report `reports/main-duellists/MAIN_DUELISTS_AUDIT_*.json`: cinque
deck campione, 50 semi e 250 duelli per livello, per un totale di 23.250
duelli. Dopo le correzioni 30/31 curve sono monotone; Umbra ha soltanto uno
scarto di −0,8 punti Facile→Medio, trattato come rumore e non come permesso
per aggiungere carte fuori lore. Corretti i piani identitari di Strings
(Slifer e Fusione), Gozaburo (pezzi di Exodia nel Cimitero per Necross) e
Odion (1/2/3 Trappole Set per difficoltà). L'audit ha inoltre trovato due
bug reali ora coperti da regressioni: slot di transito per Il Guardiano
Affidabile e fonte sparita per Ninja d'Assalto. Starter e Structure Deck
sono rimasti invariati.

`tools/simula-storia-deck.js` esegue con il motore senza testa tutti i duelli
del percorso principale della campagna anime, per ogni Starter/Structure Deck
Yu-Gi-Oh e per Facile, Normale e Difficile. I rami paralleli non bloccano il
percorso; i deck WW1 sono esclusi perché appartengono a un'origine non ammessa.
Il report misura completamento, tentativi, turni, tempo virtuale e tempo reale,
e conserva il dettaglio di ogni nodo non superato. La matrice completa
si lancia con `node tools/simula-storia-deck.js --tentativi 50 --output reports/story/report.json`;
lo spec `simulazione-storia-deck` ne esegue soltanto uno smoke test ridotto.
La matrice completa del 2026-10-07 è conservata in
`reports/story/STORY_DECK_SIMULATION_REPORT.json`: 16 deck, 3 difficoltà, 48 percorsi e 26
duelli principali per percorso, con un tetto di 50 tentativi per scontro.
L'IA del giocatore resta fissa a Difficile; 46 percorsi hanno concluso la
storia. I soli due percorsi incompleti appartengono a Pegasus Starter
(debolezza Toon già nota e rinviata), a Normale e Difficile.
L'esecuzione successiva, a semi accoppiati e completa anche dopo un eventuale
blocco, è interpretata in `docs/audits/STORY_DIFFICULTY_AUDIT.md`: soltanto 9 incontri su
26 hanno una crescita strettamente coerente, con Medio spesso più duro di
Difficile. Nessun deck o IA è stato modificato sulla sola base dell'audit.
Il successivo audit fattoriale (`reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT.json`,
interpretato in fondo a `docs/audits/STORY_DIFFICULTY_AUDIT.md`) ha separato IA e lista:
con deck Hard fisso, `AI_HARD` è più efficace di `AI_MEDIUM` soltanto in 2
incontri anomali su 16 e rende mediamente l'avversario più facile di 2,06
tentativi; con IA Hard fissa, le liste Hard sono invece mediamente più forti
delle Easy di 2,27 tentativi. La priorità è quindi correggere l'IA Hard prima
di ritoccare le liste dei personaggi.

La correzione è misurata in
`reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT_AFTER_AI_FIX_V2.json`: `AI_HARD` non usa
più una seconda strategia completa che rompeva le combo del deck, ma eredita
la linea stabile della Media e aggiunge la lettura dei mostri coperti per
evitare scontri certamente persi. A parità di deck Hard passa da 2/16 a
10/16 incontri pari o più difficili della Media; il divario medio scende da
−2,48 a −0,25 tentativi. Non è ancora monotonia perfetta: Mako e Noah sono i
primi casi da studiare nelle liste avversarie; Pegasus/Toon resta rinviato.

Sul branch `feature/ia-hard-tattica` il passo successivo è misurato in
`reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT_HARD_TACTICS.json`. Hard usa le pescate e
ricerche pure prima dell'Evocazione Normale, ordina gli attaccanti conservando
il più forte, riconosce le linee letali e soprattutto rimette legalmente in
Attacco i mostri difensivi dei turni precedenti quando possono colpire. Con
deck invariati arriva a **13/16** incontri pari o più difficili della Media e
a **+0,75 tentativi medi**. Restano sotto il riferimento Kaiba del prologo,
Joey al Castello (−0,13) e Noah; gli Ignition generici sono stati provati e
scartati perché peggioravano i dati anche con un filtro prudente.

Sul branch `feature/ia-posizioni-strategie` anche Media gestisce i cambi di
Posizione in entrambi i versi: torna in Attacco con campo libero/bersaglio
battibile e si ripara in Difesa sotto una minaccia superiore. Hard applica
la stessa regola conoscendo anche le statistiche dei coperti. Il nuovo
riferimento è `reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT_POSITIONS.json`: avendo
potenziato anche Media, Hard resta mediamente più difficile di **+0,54
tentativi**, ma è pari o superiore in 10/16 incontri. Questo comportamento
di Media è un requisito esplicito e non va rimosso per gonfiare il divario;
la separazione successiva dovrà arrivare dalle strategie Hard specifiche.

L'identità IA è ora proprietà del posto (`gameState.personaggioPerPosto`),
inizializzata sia dal duello browser sia dal motore senza testa. Questo evita
che in IA contro IA entrambi i lati ereditino la personalità dell'avversario
della sessione. I profili restano opzionali: un personaggio WW1/custom senza
voce usa la strategia neutra e non richiede metadati carta-per-carta. Il
report `reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT_PLAYBOOKS.json`, 50 tentativi per
scontro su 15 deck campione, porta Hard a **+0,57 tentativi medi** e a
**11/16** incontri pari o superiori alla Media. Restano sotto Kaiba nel
prologo, Joey al Castello, Seeker, Gansley e Noah. Un playbook che forzava i
personaggi aggressivi contro i coperti non modificava alcun risultato ed è
stato scartato.

Il passaggio successivo è conservato in
`reports/story/STORY_DIFFICULTY_FACTORIAL_REPORT_BALANCED.json`. Hard rimuove il freno extra
della Media nella scelta pesata di Magie/Trappole, prepara prima
dell'Evocazione le Magie Terreno e quelle utilizzabili solo a inizio Main
Phase, e dà a Seeker un playbook semantico per i mostri che cercano dal Deck.
Gansley e Noah seguono le informazioni visibili del proprio piano di campo.
Nessuna di queste regole richiede metadati per WW1 o carte custom. Con 50
tentativi per incontro Hard arriva a **+0,82 tentativi medi** sulla Media e
a **12/16** incontri pari o superiori; Joey è recuperato, mentre Seeker,
Gansley e Noah restano sotto soltanto di 0,13–0,53 tentativi nei singoli
campioni.

Nell'asse deck l'unica anomalia sistematica era Kaiba Hard, appesantito da
troppi mostri da Tributo/Rituale. Senza cambiare tema o boss, una copia di
Kaiser Glider e Uomo Giudice sono state sostituite da Saggi il Pagliaccio
Oscuro e Carità Aggraziata, tutte carte del repertorio anime di Kaiba. Le
liste Hard salgono a **+0,81 tentativi medi** sulle Medium e **13/16**
incontri pari o superiori. Starter e Structure Deck restano invariati;
Pegasus/Toon è escluso da questo ciclo per richiesta dell'utente.

La verifica end-to-end successiva, ripetuta dopo l'audit mirato di Invincible
Fortress, è in
`reports/story/STORY_DECK_SIMULATION_REPORT_AFTER_BALANCE.json`: 16 Starter/Structure × 3
difficoltà × 26 duelli, con tetto di 50 tentativi. La scala aggregata passa
da **1,60** tentativi medi a Facile a **3,38** a Normale e **4,03** a
Difficile; 20/26 incontri sono monotoni (erano 9/26). Completano 45 percorsi
su 48: i due Pegasus già noti e Invincible Fortress a Difficile restano
incompleti. L'audit mirato ha però separato i due vecchi sospetti: Marik viene
superato al secondo tentativo, mentre Mako resta l'unico blocco (0 vittorie
nei 50 semi reali della matrice). Le sconfitte arrivano per azzeramento LP,
non per stallo o limite turni: è un matchup estremamente sfavorevole fra il
deck Roccia lento e il campo ACQUA aggressivo, non un'autorizzazione a
modificare lo Structure Deck, che resta un campione immutabile per decisione
dell'utente.

Durante l'audit sono emersi due difetti generali dell'IA, corretti senza
ritoccare alcuna lista: Hard ora riattiva i mostri scoperti che, per testo,
possono rimettersi coperti (Guardian Sphinx, Golem Sentry e carte equivalenti),
così i loro Flip possono essere preparati di nuovo; la scelta pesata di
Magie/Trappole usa `Casuale` anziché `Math.random`, quindi semi uguali danno
risultati riproducibili e restano compatibili con il passo comune Multiplayer.

**Criterio di bilanciamento deciso dall'utente.** Starter e Structure Deck
sono campioni immutabili: non vanno corretti per farli convergere e ci si
aspetta che gli Starter siano più deboli. L'audit serve a valutare se IA
Facile/Media/Difficile sono distinguibili e verosimili e se i tre deck di
ogni avversario hanno una progressione di forza sufficiente, senza perdere
la coerenza con la lore. Pegasus/Toon è una debolezza già nota e verrà
valutata per ultima separatamente, cercando una mediazione tra la forza
mostrata nell'anime e la debolezza concreta delle meccaniche Toon. Per isolare la variabile, dalla matrice
con tetto 50 il giocatore è sempre pilotato dall'IA Difficile; cambia solo
l'IA/deck dell'avversario.

### Deroga Toon e Pegasus

Il rework Toon, ora unito in `main`, conserva nello Starter Pegasus
esattamente le proprie 40 carte, ma l'archetipo usa una deroga dichiarata
alle regole ufficiali per mediare fra resa dell'anime e giocabilità reale.
Ogni carta il cui testo è stato sostituito conserva il vecchio testo nel
campo dati `legacyOfficialEffect`, volutamente ignorato dalla UI.

`Mondo dei Toon` non costa più 1000 LP: concede ai Toon attacco diretto e
immediato e, una volta per turno, previene una loro distruzione pagando 500
LP. Se lascia il Terreno, i Toon perdono questi vantaggi ma non si
autodistruggono. I Toon possono inoltre essere Evocati normalmente secondo
il proprio Livello; con Mondo attivo conservano scorciatoie tematiche: Sirena
apre un campo vuoto, Teschio e Drago Toon usano un Toon come Sacrificio.
Manga Ryu-Ran conserva i due Sacrifici e l'obbligo di affrontare prima un
Toon avversario. Stregone Mascherato pesca al massimo una volta per turno.

Abbandonato e Restrizione dai Mille Occhi restano il secondo piano di
Pegasus: Media (e quindi Facile) non li lascia più inattivi quando possono
assorbire; Hard ordina i bersagli dal più pericoloso. Mille Occhi ora libera
correttamente il mostro assorbito anche su bando, Sacrificio e ritorno in
mano, non soltanto su distruzione.

La lista dello Starter non è stata toccata e ora completa 26/26 duelli a
tutte le difficoltà nel report `reports/story/STORY_PEGASUS_TOON_REWORK_REPORT.json`, con
medie corrette **2,62 / 6,23 / 8,12** tentativi. Il primo report era stato
generato mentre a `Mondo dei Toon` mancava l'handler vuoto `activate()`: il
motore lo lasciava quindi in mano e quei numeri sono stati sostituiti, non
conservati come riferimento. Lo stesso audit ha corretto `Maschera Toon`, che
cercava erroneamente Mondo nella zona Magia Terreno, e ha ristretto
`Riavvolgimento Toon` ai veri Toon. Le liste avversarie Pegasus restano
ripulite dalle mani troppo cariche di Toon alti mantenendo soltanto carte
della sua lore. Il ricalcolo successivo al fix è ora in
`docs/audits/PEGASUS_OPPONENT_AUDIT.md`: su 1.500 duelli la curva è **35,8% / 54,2% /
58,6%**. A Difficile il nucleo Fusione usa due copie di Fusione, Abbandonato
e Idolo dai Mille Occhi: Restrizione compare nel 4% dei duelli misurati,
abbastanza da essere un secondo piano riconoscibile ma non dominante sui
Toon.

Il Pannello Admin può segnare al 100% tutte le campagne attualmente giocabili,
in ogni difficoltà. `js/dev/story-admin-tools.js` scrive solo il progresso:
marca i premi finali come già gestiti e non chiama né Rewards né
CardAcquisition. Le campagne future prive di nodi restano bloccate. I premi
unici reali restano protetti dalle chiavi persistenti di CardAcquisition anche
dopo `StoryProgress.ricomincia`; lo spec `storie-admin-premi-unici` copre
esplicitamente il doppio completamento di Obelisco.

## Passaggio di consegne (2026-10-06)

Fra il 4 e il 6 ottobre il motore è stato rifatto in profondità seguendo il
"piano di attacco" di `docs/planning/WORK_IN_PROGRESS.md` (Priorità 0-3). Tutto è in `main`;
suite completa 204/204 prima dell'ultima unione (`0a21581`), poi due correzioni
Multiplayer con spec mirati verdi (`d46d30a`). Il gioco offline si comporta
come prima: lo prova `tools/impronta-partite.js` (60 partite IA contro IA a seme
fisso, identiche prima e dopo ogni refactor, a parte le correzioni dichiarate).

**Perché.** Obiettivo dell'utente: un motore scalabile e "plug in", in
prospettiva Forbidden Memories come secondo set di regole sullo stesso nucleo,
e un Multiplayer che non diverga. TypeScript solo come tipi (`// @ts-check` +
JSDoc), niente build, `file://` resta.

**Cosa è cambiato, per priorità** (commit fra parentesi):

- **P0 — messa in sicurezza** (`3e8d145`): suite completa, spec instabile
  corretto, stack degli errori di pagina nel runner dei test.
- **P1 — terreno** (`340e03a`, `05b48e3`): una sola lista dei gruppi di
  `<script>` (`scripts/gruppi-script.js` + `sync-script-groups.js`, pre-commit
  e guardrail); tipi del motore in `types/motore.d.ts` (`npm run typecheck`).
- **P2 — nucleo senza testa** (`65dd90c`…`634368a`, unito in `7fe9b5c`):
  - `game-flow.js` e `actions.js` divisi per competenza con spostamento
    parola per parola (`tools/sposta-funzioni.js`/`impronta-funzioni.js`):
    `stato.js` (gameState), `fasi.js` (turno e fasi), `battaglia.js`,
    `evocazioni.js`;
  - le regole toccano la pagina solo da `porta-ui.js` e avvisano
    l'interfaccia dal canale `eventi-duello.js` (`emetti`/`attendi`/`chiedi`,
    elenco chiuso di eventi); `addToLog`/`updateUI`/`endDuel` & co. vivono in
    `canale-partita.js` con la sola parte di regola;
  - ogni scelta passa da `decisioni.js` (`Decisioni.chiedi`): decide chi
    risponde (avversario remoto, persona, scelta automatica);
    `Decisioni.inSospeso`/`rispondi` per rispondere senza interfaccia;
  - risultato: duelli interi in Node, senza browser
    (`tools/duello-senza-testa.js`, orologio virtuale): hanno trovato 5
    difetti veri di carte.
- **P3 — posti al tavolo e Multiplayer a passo comune** (`3364519`…`4f546aa`,
  unito in `0a21581`):
  - `tavolo.js`: chi controlla un posto ('persona', 'ia', 'remoto') è un dato;
    'player'/'bot' sono solo i NOMI dei due posti. L'IA gioca da entrambi
    (`turnoIA(io)`, parametro `io` in tutta l'IA): il duello senza testa è IA
    contro IA vera;
  - `casuale.js`: casualità di gioco con seme condiviso in Multiplayer,
    `Math.random` offline; `Tavolo.ordine()` al posto dei cicli
    "prima player poi bot"; uid deterministici;
  - `comandi.js`: ogni mossa (evoca, tributa, settaMT, terreno, posizione,
    attacca, attiva, specialeDaMano, fusioneBandendo, fase, scartaFineTurno,
    usaTerrenoAltrui) è un comando eseguito dalla stessa funzione col posto
    come parametro, per persona, IA e avversario remoto;
  - `passo-comune.js`: i due client eseguono TUTTA la partita (stessi mazzi,
    stesso seme) e si scambiano solo comandi e decisioni; regole di tempo
    (comandi solo a duello fermo, scelte istantanee differite, timer delle
    regole in pausa con una scelta aperta) spiegate in cima al file;
  - `tools/duello-gemello.js`: due motori sullo stesso orologio, JSON fra i
    due, impronta dello stato confrontata prima di ogni comando. 240 partite
    allineate su 8 coppie e 3 livelli;
  - pagina: `js/multiplayer/mp-passo-comune.js` (scambio mazzi e seme dentro
    `initGame`, invio a lotti, ripresa dopo una caduta di linea); il server
    accetta 'mazzo', 'passo', 'passo-riprendi'. Il protocollo versione 2 è
    obbligatorio: un client o relay precedente produce un errore esplicito.
- **Dopo, su segnalazione dell'utente** (`d46d30a`): la morra cinese del
  Multiplayer fa scegliere al vincitore chi comincia e si chiude su entrambi
  (messaggio 'rps' con `iniziaChiManda`); il campo del Multiplayer non sborda
  più (`#arenaMount` colonna flessibile, `multiplayer.html`).

**Difetti veri chiusi lungo la strada** (oltre ai 5 del nucleo senza testa):
bersaglio sparito prima del calcolo dei danni (`851ffa4`); Gran Scudo Gardna
(`24ac498`); l'IA che continuava a giocare dopo una vittoria (Exodia alla
pescata, LP a 0 in Standby); lo stato di Ra (id 472) che non viaggiava; 63
scelte scritte `chi: 'player'`; un errore JavaScript della sala d'attesa
quando il relay rifiutava un messaggio a duello avviato.

**Dove guardare per capire il nuovo nucleo**: i commenti in cima a
`tavolo.js`, `decisioni.js`, `comandi.js`, `passo-comune.js`,
`eventi-duello.js`; in `CLAUDE.md` i bullet «Nucleo senza testa», «Posti al
tavolo» e «Multiplayer a passo comune» (con le regole per il codice nuovo).

**Chiuso dopo il passaggio di consegne:** l'attesa di una decisione remota
ora emette `attesa-decisione-remota` da `PassoComune`; la pagina mostra vicino
all'avversario «L'avversario sta scegliendo…» finché la risposta non viene
consumata, senza polling.

Il protocollo Multiplayer legacy è stato rimosso e il branch dedicato unito
in `main` dopo la suite completa 202/202: nessuna replica di mosse, mano a
segnaposto, fotografia di stato o coda di scelte per uid. `multiplayer.js`
gestisce solo connessione, abbandono, rientro e `game-over`; un guardrail
impedisce il ritorno delle API eliminate. Compilata anche la shell Android di
produzione beta.22 (`versionCode 22`) e ristretto il relay ai soli messaggi
del protocollo corrente.

**Cosa resta** (dettagli in `docs/planning/WORK_IN_PROGRESS.md`):

1. Bilanciamento delle difficoltà con dati veri: ora si può, il duello senza
   testa gioca IA contro IA in ~0,1 s a partita (`--giocatore`,
   `--livello-giocatore`).
2. Verificare nella scheda *Events* di Render la ridistribuzione automatica
   del relay dopo il push su `main`.
3. I ternari di stato "player ? … : bot …" sono stati portati sugli accessori
   di `Tavolo`; rimangono solo quelli di testo/UI legati al punto di vista.
4. Più grandi: tutorial; Forbidden Memories come secondo set di regole.
   I suoi 21 deck avversari nell'attuale Duel Monsters sono già stati
   misurati e corretti: vedere `docs/audits/FORBIDDEN_MEMORIES_AUDIT.md`. L'audit dei
   deck non equivale all'implementazione delle regole PS1 dedicate.
5. Decisioni aperte dell'utente: i 6 avatar PNG non usati; eliminare il branch
   `refactor/posti-al-tavolo` (già unito).

## Stato rapido

- Versione dichiarata: `1.3.1` (`package.json` e `js/version.js`).
- Applicazione HTML/CSS/JavaScript puro: nessun framework, bundler o build del
  frontend. Gli script globali devono essere caricati nell'ordine giusto.
- 19 pagine HTML, 104 file JS applicativi sotto `js/` (esclusi i vendor),
  1.129 carte, 205 spec Playwright (2026-10-06). I numeri invecchiano:
  contarli quando contano.
- 0 `missingEffectNote` in `data/cards.json`: le ultime tre limitazioni del
  motore (192, 235, 622) sono state chiuse sul branch
  `refactor/chiudi-ultime-carte`.
- PWA tramite `manifest.json`, `sw.js` e `js/pwa-register.js`.
- App Android/Capacitor: le shell dev e produzione includono `NativeMusic`;
  la produzione nativa è `1.3.2` (`versionCode 25`) e punta al sito
  Cloudflare. Il contenuto web espone `GAME_VERSION` `1.3.1`. Gli APK sono
  ignorati da Git e restano artefatti locali rigenerabili. La cache
  WebView/PWA corrente è `ygo-duel-arena-v235`.
- Cloud tramite Supabase; multiplayer tramite relay WebSocket Node nativo.
- Le preferenze utente (`save.settings`: dettagli video, ologrammi, aptica,
  volume e mute musica/SFX) fanno parte del salvataggio unificato e quindi di
  export/import e cloud; le vecchie chiavi locali restano cache e migrazione.
- L'autowin di collaudo dell'admin (`StoryAutowin`) viene applicato sia ai
  duelli della Storia sia a Regno dei Duellanti, Battle City e Torneo Kaiba;
  richiede sempre interruttore locale acceso e `CloudSync.isAdmin()` vero.
- Alla conclusione di un duello `sealDuelModalsForOutcome()` chiude e rende
  inerti tutti i modali; `body.duel-outcome-active` impedisce a callback
  tardivi di riaprire la conferma Abbandona sotto la schermata Vittoria.
- `tornei.html` permette di abbandonare direttamente una scalata in corso;
  azzera solo `save.tournaments[id]`, conservando storico e premi.
- Nel Regno dei Duellanti le Stelle correnti vivono esclusivamente in
  `save.tournaments.duelistKingdom.stars`: partono da 2 e bonus, malus,
  puntate, soglia del Castello e riepilogo leggono lo stesso contatore.
- Il Castello di Pegasus usa una seconda history lineare: all'ingresso azzera
  la sola history grafica dell'isola; il nuovo sfidante compare soltanto dopo
  la vittoria sul precedente, mentre i nodi già battuti nel Castello restano
  visibili. Le tre tappe avanzano da sinistra a destra sul tappeto rosso.
- I duelli del Regno dei Duellanti usano `arenaRegnoDeiDuellanti.jpg`
  sull'isola e `arenaCastelloPegasus.jpg` dal Cancello in avanti.
- Ogni nuova scalata nel Regno apre il momento `prologue` di
  `TournamentDialogues` prima di renderizzare la mappa; viene registrato in
  `intermezziVisti` per non ripetersi dopo un reload.
- Battle City apre il proprio `prologue` su
  `images/maps/storia_anime_battlecity1.jpg`; la fase `city` usa una main
  full-viewport e il fondale `images/fields/citta.jpg` (con variante mobile).
  Le 25 celle logiche non disegnano alcun pannello o reticolo: solo i punti
  d'interesse, leggermente sfalsati, galleggiano sul fondale. I nodi DOM
  restano persistenti durante gli spostamenti e un unico segnalino animato
  scorre fra gli isolati; su movimento ridotto la transizione viene rimossa.
- Le campagne narrative non belliche hanno ulteriori raccordi: 2 scene in
  `anime`, 3 in `forbiddenMemories` e 4 in `freedom`. Le separazioni
  `dalla: 'tappe'` migrano i vecchi contatori lineari senza spostare il punto
  narrativo; WW1 resta deliberatamente esclusa.
- Nel tabellone di Battle City `resolvePendingEncounterIfDone()` tratta anche
  `r32` e `r16` come turni a eliminazione: una vittoria, compreso l'autowin,
  scrive `player` nel relativo array dei vincitori e apre il turno successivo.
- Il roster della prima serie include anche i Rare Hunter Seeker, Strings,
  Lumis e Umbra. Hanno tre mazzi ciascuno, battute personali e iconiche e
  partecipano agli incontri `hunter` di Battle City, quindi una vittoria nel
  torneo li sblocca nel Duello Libero. Finché mancano i relativi JPG sotto
  `images/characters/`, il renderer usa automaticamente il proprio fallback.
  I nodi `hunter` della città restano anonimi: l'avversario viene estratto
  entrando nel nodo, senza ripetizioni finché il pool Rare Hunter non è stato
  esaurito; l'estrazione viene poi conservata nel `pendingEncounter`.
- Nella campagna anime i quattro Rare Hunter compaiono in Battle City Parte 1
  nell'ordine Seeker, Strings, Lumis e Umbra, con dialoghi introduttivi. Tre
  migrazioni `inserite` mantengono allineati i progressi salvati prima della
  loro aggiunta.
- La campagna `anime`/“Il Regno delle Ombre” include raccordi narrativi sulla
  notte dell'isola, le dieci Stelle, i finalisti di Battle City, le anime
  prigioniere di Noah, la promessa di Joey, i tre Dei e il vero nome Atem.
  Battle City Parte 1 distribuisce ora i nodi lungo città, parco, porto e
  dirigibile invece di comprimerli a sinistra; ogni nuova scena ha una
  migrazione `inserite` per non arretrare i salvataggi precedenti.
- Controllo sintattico del 2026-09-29: 212 file JS, tutti validi.

## Ordine di lettura consigliato

1. Questo file.
2. Le prime sezioni di `CLAUDE.md`: avvio, struttura, convenzioni e rischi.
3. La sezione pertinente di `CLAUDE.md` cercando la funzionalità interessata.
4. I file sorgente della sola area coinvolta.
5. Gli spec con nome correlato sotto `tests/specs/`.

Non fidarsi dei conteggi scritti nella documentazione storica: contare i file
quando il numero è importante. Alcune sezioni di `CLAUDE.md` descrivono lavori
passati e possono essere state superate dal codice.

## Architettura

```text
Pagine/modalità HTML
        |
        +-- save-manager.js / cloud/* / data/*
        |
        +-- duel-session.js
                |
                |   gruppo "motore" (scripts/gruppi-script.js)
                +-- engine/casuale.js        (casualità di gioco, seme condiviso)
                +-- engine/porta-ui.js       (unico accesso delle regole alla pagina)
                +-- engine/eventi-duello.js  (le regole avvisano l'interfaccia)
                +-- engine/tavolo.js         (posti e controllori)
                +-- engine/duel-engine.js    (chain, trigger, regole, ctx delle carte)
                +-- engine/decisioni.js      (ogni scelta del duello)
                +-- engine/card-effects.js + card-effects-1..8.js (carte)
                |
                |   gruppo "partita"
                +-- engine/stato.js / canale-partita.js
                +-- engine/comandi.js        (le mosse come comandi)
                +-- engine/passo-comune.js   (Multiplayer a passo comune)
                +-- engine/fasi.js / battaglia.js / evocazioni.js (regole)
                +-- engine/game-flow.js / actions.js (disegno e click)
                |
                +-- ai/* (turnoIA dal posto 'player' o 'bot') oppure multiplayer/*
                |
                +-- ui/* + audio/* + native/*
```

Il centro del duello è `gameState`, un grande oggetto globale. Molte funzioni
leggono e modificano direttamente questo stato. `duel-session.js` prepara il
contesto della modalità e collega il risultato del duello alle pagine Storia o
Torneo. Le pagine non usano moduli ES: dipendono dai global creati dagli script
precedenti, nell'ordine di `scripts/gruppi-script.js`.

Divisione di fondo dal 2026-10-05: i file di REGOLA (gruppo motore più
`stato`, `canale-partita`, `comandi`, `passo-comune`, `fasi`, `battaglia`,
`evocazioni`) girano anche in Node senza DOM (`tools/duello-senza-testa.js`);
`game-flow.js` e `actions.js` sono la parte di pagina (disegno, click, modali)
e ascoltano gli eventi del canale.

## Mappa delle aree

### Motore di duello

- `js/engine/duel-engine.js`: chain, trigger, risoluzioni, `makeContext`
  (il `ctx` delle carte), finestre di risposta e di priorità.
- `js/engine/stato.js`: `gameState` e `resetGameState`.
- `js/engine/fasi.js`: pescata, fasi, cambio turno, scarto di fine turno,
  fine duello automatica.
- `js/engine/battaglia.js`: dichiarazione e risoluzione degli attacchi.
- `js/engine/evocazioni.js`: Evocazioni, Tributi, Set, cambi di Posizione
  (gli esecutori dei rispettivi comandi).
- `js/engine/comandi.js`: `Comandi.esegui(posto, comando, extra)`, un
  esecutore per mossa; un comando porta la carta per uid.
- `js/engine/tavolo.js`: `Tavolo.controllore/eIA/ePersona/eRemoto/
  giocaUnaPersona`, accessori per posto, `Tavolo.ordine()`.
- `js/engine/decisioni.js`: `Decisioni.chiedi(richiesta, onDeciso)`.
- `js/engine/eventi-duello.js`, `porta-ui.js`, `canale-partita.js`: confine
  fra regole e pagina.
- `js/engine/casuale.js`: `Casuale.random/intero/mescola/semina`.
- `js/engine/passo-comune.js`: vedi «Multiplayer».
- `js/engine/actions.js`, `game-flow.js`: interfaccia del duello (click,
  trascinamenti, modali, disegno del campo).
- `js/engine/effect-templates.js`: pattern condivisi per gli effetti.
- `js/engine/card-effects.js`: helper e contratto degli handler.
- `js/engine/card-effects-1.js` … `card-effects-8.js`: effetti delle carte.
- `js/engine/duel-sandbox.js`: configurazione particolare della pagina demo.
- `types/motore.d.ts`: contratto del `ctx` delle carte, `CardDefinition`,
  `gameState` (letto da `npm run typecheck` per i file con `// @ts-check`).

### Box delle Catene

- `renderChainStack()` mantiene ordine di attivazione e risoluzione LIFO,
  ma assegna a ogni Link una lieve inclinazione alternata e un piano di
  energia dietro la miniatura;
- `#chainStack` e' un espositore semi-3D stratificato: cornice interna,
  base prospettica, carte sollevate e riflesso sulla superficie. Il Link
  in risoluzione avanza, si raddrizza e riceve anello/luce animati, come
  una versione compatta dell'attivazione carta a centro schermo;
- posizione e dimensioni storiche restano invariate; movimento disattivato
  con `prefers-reduced-motion`. Guardrail:
  `tests/specs/chain-stack-semi-3d.spec.js`.
- il contenitore grafico è stato rimosso: intestazione e carte fluttuano
  direttamente sul campo, con overflow visibile per non troncare ombre,
  inclinazioni o il Link che avanza durante la risoluzione.
- su desktop le carte arrivano a 104px; nome e proprietario vivono in una
  targhetta separata davanti al piano animato, con spaziatura verificata per
  non essere coperti dai Link vicini o da quello in risoluzione.

### Priorità cinematiche e distruzione Magie/Trappole

- i video di evocazione usano il livello UI massimo, intercettano ogni input
  e tengono `DUEL_CINEMATIC_LOCK` attivo fino alla fine della dissolvenza;
- Magie, Trappole e Magie Terreno distrutte ricevono una scossa con perdita
  di segnale e smaterializzazione olografica, distinta dalle esplosioni dei
  mostri. Guardrail: `tests/specs/distruzione-magie-trappole.spec.js` e
  `tests/specs/video-evocazione-priorita.spec.js`.

### Audio contestuale Grande Guerra

- nei duelli con `mode=story&campaign=ww1`, `js/audio/audio-library.js`
  cerca prima `audio/standard/ww1/<effetto>`; soltanto dopo un esito
  mancante usa `audio/standard/<effetto>` e infine il fallback sintetico;
- la priorità vale per ogni chiamata `SFX.*`, non solo per gli effetti oggi
  già presenti nella cartella WW1. Guardrail:
  `tests/specs/audio-ww1-priorita.spec.js`.

### Preparazione Duello Libero e morra cinese

- la modale di `duello-libero.html` separa la scheda dell'avversario dalla
  configurazione di arena, musica, carte ammesse e livello; la difficoltà è
  mostrata con tre scelte descrittive;
- desktop, telefono verticale e telefono landscape hanno composizioni
  dedicate. La morra usa una piccola arena rituale e in landscape divide
  confronto e comandi in due colonne. Guardrail:
  `tests/specs/duello-libero-config-responsive.spec.js` e
  `tests/specs/morra-cinese-responsive.spec.js`.

### Battute contestuali dei Duellanti

- `js/ui/duel-dialogues.js` contiene personalità, tre varianti per ciascuno
  dei sei contesti e le evocazioni iconiche obbligatorie. Il motore invia
  soltanto gli eventi, senza conoscere i testi;
- le battute normali hanno probabilità e cooldown, quelle speciali partono
  sempre. `js/ui/duel-dialogues.css` disegna i balloon accanto agli avatar
  di giocatore e avversario, anche su mobile;
- il giocatore personale usa il profilo eroico; nella Storia eredita invece
  identità e personalità del protagonista. Guardrail:
  `tests/specs/duel-dialogues.spec.js`.

### Carte e dati

- Fonte di verità: `data/cards.json`.
- File generato caricato dal gioco: `js/data/cards-data.generated.js`.
- Dopo una modifica ai dati: `node scripts/build-cards-data.js`.
- Non modificare manualmente `cards-data.generated.js`.
- `js/data/cards-db.js` espone/normalizza il catalogo.
- `character-decks.js`, `characters-db.js`, `story-campaigns.js` e gli altri
  file sotto `js/data/` contengono i grandi cataloghi di gioco.

### AI

- `ai-controller.js`: facciata.
- `ai-shared.js`: valutazioni comuni.
- `ai-medium.js`, `ai-hard.js`: strategie per difficoltà.
- `bot.js`: esecuzione del turno e orchestrazione.
- `AI_SHARED.shouldHoldForExodia()` esclude sempre i cinque pezzi dalle
  Evocazioni e dai Set del bot: vale per Facile/Normale tramite `AI_MEDIUM` e
  per Difficile tramite `AI_HARD`. Se la mano contiene solo quei pezzi, il bot
  rinuncia all'Evocazione e li conserva per la vittoria automatica.

### Modalità e progressione

- `index.html`: menu e viste principali.
- `duelMonstersCore.html`: arena comune dei duelli.
- `duello-libero.html`: setup del duello libero.
- `storia.html` + `js/story/story-progress.js`: campagne e nodi.
- `tornei.html`: unica pagina canonica per selezione, abbandono e avanzamento
  dei tornei. Il menu di `index.html` la apre come pagina autonoma; non esiste
  più una seconda vista Tornei incorporata nell'index.
- `torneo-regno-duellanti.html`, `torneo-battle-city.html`,
  `torneo-kaiba.html`: stati e flussi autonomi dei tre tornei.
- `js/data/tournament-dialogues.js`: intermezzi narrativi condivisi.
- `js/ui/story-cutscene.js` + `.css`: regia visual-novel condivisa. Durante
  i dialoghi assegna stabilmente gli interlocutori a sinistra/destra,
  collega il bordo del box al lato di chi parla e mostra il progresso della
  conversazione; narratore e layout mobile/orizzontale restano dedicati.
- `sfide.html` + `js/challenges/challenge-tracker.js`: sfide e progressi.
  Il catalogo `js/data/challenges-db.js` contiene 128 sfide persistenti:
  l'ultima espansione ne aggiunge 44 per duellanti dell'anime (inclusi Rare
  Hunters e Mondo Virtuale), mostri iconici, Magie/Trappole e traguardi di
  lungo periodo. Le voci usano soltanto i tipi generici già agganciati al
  motore (`defeatCharacter`, `summonMonster`, `activateCard`, `perfectWin`,
  `winInstantly`, `completeTournament`, `winDuels`).

### Economia e collezione

- `cartoteca.html`, `creazione-deck.html`, `crea-carta.html`.
- `js/economy/rewards.js`: assegnazione premi.
- `shop-catalog.js`, `shop-ui.js`, `pack-opening.js`: negozio e pacchetti.
  Nel Negozio un account admin può riacquistare senza limiti gli
  Starter/Structure Deck già posseduti: il pack resta registrato una sola
  volta, mentre ogni nuovo acquisto paga il prezzo e aggiunge nuovamente le
  carte alla collezione (fino al limite copie globale). Per gli altri account
  resta valido il singolo acquisto.
- `save-manager.js`: salvataggio locale e forma dei dati persistiti.

### Cloud

- `js/cloud/supabase-config.js`: configurazione client.
- `cloud-sync.js`: account, salvataggi e carte personalizzate.
- `auth-gate.js`: accesso obbligatorio alle pagine protette.
- `auto-sync.js`: sincronizzazione durante l'uso.
- `server-date.js`: data autorevole per negozio/bonus.
- `supabase/schema.sql`: tabelle `saves`, `custom_cards`, `profiles`, RLS,
  policy, funzioni account/admin e ora server.

### Multiplayer

- Client: `js/multiplayer/network.js`, `mp-passo-comune.js`, `mp-lobby.js`,
  `multiplayer.js`. Il duello si carica dentro `multiplayer.html`
  (`loadDuelArena` esegue gli script di `duelMonstersCore.html`).
- Server: `server/server.js`, solo moduli Node nativi, su Render
  (`render.yaml`, servizio `millennium-duel-arena-relay`): si ridistribuisce da
  solo col push su `main`.
- Messaggi di stanza: `create-room`, `join-room`, `rejoin-room`,
  `game-action`, `leave-room`. Dentro `game-action` un elenco CHIUSO di tipi
  (`GAME_ACTION_KINDS`): un tipo nuovo va aggiunto lì, o il relay lo scarta.
- Stanze da due giocatori, TTL 30 minuti, grazia riconnessione 45 secondi,
  20 messaggi/s (oltre: scartati in silenzio) e messaggi massimi da 64 KiB.
- **Passo comune (protocollo attuale, dal 2026-10-06)**: i due client
  eseguono la stessa partita; viaggiano solo i comandi di chi è di turno e le
  decisioni (posizione nell'elenco dei candidati), numerati, a lotti, con
  ripresa dopo una caduta di linea. Ogni comando porta un riassunto dello
  stato di chi lo manda, confrontato da chi lo riceve. Stato SPECCHIATO: ogni
  client chiama 'player' sé stesso. Costo dichiarato: ogni client ha in
  memoria mazzo e mano dell'altro.
- **Protocollo vecchio**: rimosso dal client e dal relay. Non esistono
  più mosse raccontate, segnaposto, fotografie di stato, resync o dispatcher
  `applyRemote*`; il guardrail `guardrail-protocollo-multiplayer-unico` lo
  sorveglia. Anche `GAME_ACTION_KINDS` accetta soltanto lobby, mazzo, passo,
  ripresa ed esito. La beta.22 è pronta e la suite completa è passata 202/202.
- La morra cinese: il vincitore sceglie chi comincia, e la scelta viaggia
  ('rps' con `iniziaChiManda`).
- Il server inoltra le azioni ma non è un motore autorevole: la logica resta
  sui client. Questo è il limite principale per anti-cheat/competitivo (il
  passo comune permetterebbe un giorno di far girare il motore anche sul
  server, perché gira già in Node).

### UI, asset e piattaforme

- `js/ui/`: rendering carte, topbar, deck switcher, cinematiche, mappe,
  onboarding, effetti visivi e recupero errori.
- `js/ui/page-loader.js` + `js/ui/page-loader.css`: overlay comune durante i
  cambi pagina. Mostra una carta a due facce che ruota in prospettiva 3D, con
  retro a vortice, fronte con sigillo, rune orbitali, scintille e ombra
  dinamica. È interamente CSS (nessun asset da attendere), è adattato al
  landscape mobile e rispetta `prefers-reduced-motion`. API pubblica:
  `PageLoader.show()` / `PageLoader.hide()` / `PageLoader.hideWhenReady()`;
  Negozio e Cartoteca lo riattivano dal router SPA mentre attendono gli asset
  lazy. Opzioni globali:
  `PAGE_LOADER_SKIP` / `PAGE_LOADER_MANUAL_HIDE`.
- `js/ui/game-logo.js` + `js/ui/game-logo.css`: logo condiviso di splash,
  accesso e menu. Il titolo usa Cinzel in forma monumentale e geometrica,
  incluso localmente in `assets/fonts/cinzel/` con licenza OFL e
  inserito nell'app shell del service worker: funziona offline e nell'APK.
  Il trattamento è volutamente sobrio: oro caldo opaco e ombra morbida,
  senza cornici, fregi o rilievi metallici stratificati.
- `js/ui/board-pieces.js`: pedine "3D" in SVG per le mappe dei tornei
  (duellante, Rare Hunter incappucciato, Carta Locazione, evento, negozio,
  decollo, casella ignota, casella risolta, puntina del giocatore).
  `BoardPieces.markup(kind)` torna l'SVG; i gradienti stanno in un solo
  `<svg>` condiviso iniettato una volta (mai in un contenitore
  `display:none`, o non si dipingono). Le usa la città di Battle City al
  posto delle emoji; un tipo sconosciuto torna stringa vuota, mai errore.
  Nella città le caselle raggiungibili sono accese, con percorso+freccia
  dal segnalino (`layoutCityOverlay`, ricalcolato anche al resize) e uniche
  ad avere la targhetta; le altre restano visibili ma attenuate. I Rare
  Hunter restano anonimi anche nella pedina (si estraggono entrando). I
  Duellanti della città mostrano il personaggio RITAGLIATO senza sfondo
  (PNG trasparenti forniti a mano; la rimozione automatica dello sfondo non
  dava risultati puliti). Il PNG ha lo stesso NOME del file avatar del
  personaggio, non il suo id: `joeyWheeler.jpg` → `images/characters/pedine/
  joeyWheeler.png`, `maximillionPegasus.jpg` → `maximillionPegasus.png`. Gli originali a piena risoluzione stanno in `images/characters/avatarTrasparenza/` (non caricati dal gioco); `pedine/` contiene le copie ridimensionate a max 320 px.
  Nessun elenco da tenere: ogni Duellante prova il suo file e, se non c'è,
  `BoardPieces` ripiega da solo sulla pedina standard (`onerror`, con
  memoria dei mancanti). Per aggiungerne uno basta mettere il PNG. Restano
  nella cartella alcune varianti senza avatar corrispondente (Kaiba in vari
  costumi, `yamiYugiV2`, un secondo soldato della Grande Guerra).
- `js/audio/`: musica ed effetti; vendor Howler incluso localmente.
- `js/native/`: back button, aptica, keep-awake e backup Android.
- Asset: `images/`, `audio/`, `video/`.
- Librerie vendorizzate: GSAP, Howler, Pixi e Supabase sotto `js/vendor/`.

## Test e comandi

```text
node scripts/check-syntax.js
node tests/run-all.js <parte-del-nome-spec>
npm test
npm run typecheck
node scripts/sync-script-groups.js
node tools/duello-senza-testa.js [--avversario kaiba] [--livello hard]
     [--giocatore yamiYugi] [--livello-giocatore hard] [--seme 42]
     [--partite 10] [--diagnosi] [--log]
node tools/duello-gemello.js [--host yamiYugi] [--ospite kaiba]
     [--livello-host hard] [--livello-ospite hard] [--seme 42]
     [--partite 10] [--traccia]
node tools/impronta-partite.js prima.txt   # poi dopo.txt, e confrontare
```

`npm test` esegue l'intera suite. Regola esplicita del progetto: non avviarla
di propria iniziativa; usare gli spec mirati e lasciare all'utente la decisione
di eseguire tutto. La CI è in `.github/workflows/test.yml`.

Strumenti in Node (nessun browser):
- `duello-senza-testa`: duelli interi IA contro IA con l'orologio virtuale;
  `--diagnosi` segnala la carta che rompe un invariante. Spec omonimo.
- `duello-gemello`: due motori a passo comune; `--traccia` mostra ogni
  scelta chiesta, decisione e comando, e la prima divergenza dice quale pezzo
  dello stato si è separato. Spec `duello-gemello`.
- `impronta-partite`: 60 partite a seme fisso in un file; per i refactor che
  non devono cambiare il gioco, le due impronte devono coincidere.
- `impronta-funzioni`/`sposta-funzioni`: spostare funzioni fra file
  provando che il testo è identico.

Spec Multiplayer: richiedono un server HTTP e il relay veri
(`tests/helpers/local-servers.js`) e sono `standalone: true`. Quello del
protocollo attuale è `multiplayer-passo-comune` (turni veri con carte vere
della mano: sostituirne una per comodità separerebbe davvero le due partite).

La fase di risveglio del relay resta dentro `#mpStatus`, senza modali, ma la
vecchia riga terminale è ora una console KaibaCorp semi-3D: emblema tecnico,
stato uplink, circuiti, cronometro, cinque nodi di handshake e telemetria.
I nodi avanzano con le frasi di attesa già prodotte dal client e non fingono
eventi ricevuti dal server. Layout dedicato per telefono verticale e
orizzontale, più variante `prefers-reduced-motion`. Cache PWA `v203`;
guardrail `multiplayer-kaibacorp-connection-ui` e `multiplayer-end-to-end`.

## Rischi e debito tecnico noti

1. `gameState` è un God Object globale, senza schema o validazione centrale
   (i tipi in `types/motore.d.ts` lo descrivono, non lo proteggono).
2. L'ordine dei tag `<script>` è parte dell'architettura. Le liste sono
   generate da `scripts/gruppi-script.js` e controllate da pre-commit e
   guardrail, ma restano scritte in ogni pagina.
3. `actions.js` e `game-flow.js` espongono molte funzioni globali.
4. File molto grandi (`duel-engine.js`, `card-effects-*.js`) rendono i
   refactor trasversali rischiosi: usare `tools/impronta-partite.js`.
5. Nessun lint o formatter; `@ts-check` acceso solo su pochi file nuovi
   (accenderlo sulle carte dà ~100 errori per parte).
6. Il server multiplayer non convalida semanticamente le mosse.
7. Persistenza locale/cloud e vecchi salvataggi richiedono modifiche additive
   e valori di default; evitare migrazioni distruttive.
8. A passo comune ogni divergenza fra i due client è definitiva (non c'è più
   la fotografia di stato a riparare): una regola nuova che usa `setTimeout`,
   `Math.random`, cicli `['player','bot']` o una scelta fuori da
   `Decisioni` può separare le due partite. I guardrail ne coprono una parte;
   il controllo vero è `tools/duello-gemello.js`.

## Stato lavori: Torneo Kaiba

Richiesta attiva del 2026-09-29: «non partire dai quarti, parti da 2
preliminari prima».

Implementazione presente:

- un nuovo torneo parte da `preliminary1`;
- dopo la vittoria passa a `preliminary2`, poi a `quarter`;
- il tabellone ha 32 partecipanti ed e' completamente ramificato: 16 incontri
  nel primo preliminare, 8 nel secondo, 4 quarti, 2 semifinali e 1 finale;
- tutti gli incontri non disputati dal giocatore vengono simulati e i relativi
  vincitori alimentano davvero il turno successivo;
- Yugi Muto e Yami Yugi sono mutuamente esclusivi nello stesso sorteggio;
- probabilita' di avanzamento: Kaiba favorito, poi Yugi/Yami, Marik, Pegasus e
  Bakura; il resto del roster e' graduato per forza narrativa in anime e gioco;
- i due avversari preliminari sono distinti tra loro e dai cinque sfidanti
  casuali del tabellone;
- Pegasus rimane nella metà del giocatore e Kaiba nella metà opposta;
- salvataggi vecchi già in `quarter`, `semi` o `final` restano validi;
- `tornei.html` mostra una progressione di cinque duelli;
- `tournament-dialogues.js` ha apertura delle qualificazioni e intermezzo di
  accesso ai quarti;
- test mirato: `tests/specs/torneo-kaiba-preliminari.spec.js`.

Verifica eseguita il 2026-09-29:

- controllo sintattico: superato;
- test `torneo-kaiba-preliminari`: superato;
- suite completa: non eseguita, secondo la regola del progetto.

## Stato lavori: effetto Spade Rivelatrici

Revamp grafico eseguito il 2026-09-29 senza modificare la logica della carta:

- `js/ui/effects.css`: la barra piatta e' diventata una spada luminosa
  composta da lama sfaccettata, costola, guardia, impugnatura e gemma;
- `js/ui/effects.js`: anche il fallback CSS costruisce la nuova spada;
- `js/ui/fx-gsap.js`: raggi dall'alto, caduta dal centro verso l'esterno,
  convergenza prospettica, rotazioni 3D, profondita', impatti e scossa finale;
- resta invariata la sincronizzazione con `.field-sword-mark`, che sostituisce
  le lame volanti dopo l'aggiornamento del campo;
- controllo sintattico e spec `swords-of-revealing-light-flip`: superati.

Secondo passaggio dello stesso giorno:

- palette definitiva verde e bianca, coerente con l'illustrazione della carta;
- anche le cinque lame persistenti usano lama, guardia, impugnatura e gemma,
  con un movimento luminoso lento per i turni in cui restano attive;
- alone della fila, carta attiva e contatore turni coordinati sulla palette oro;
- `recomputeStaticEffects()` azzera le lame persistenti appena la carta non e'
  piu' scoperta sul Terreno, sia per scadenza sia per distruzione/rimozione;
- lo spec della carta verifica ora anche presenza e rimozione anticipata dello
  stato persistente.

Rifinitura successiva:

- tutte le spade hanno manico luminoso in alto e punta rivolta verso il basso;
- il manico e' luce piena, senza fasciatura/impugnatura disegnata;
- `playMonsterSummonEffect()` risolve sempre tramite uid il vero elemento della
  carta sul Terreno: la convergenza dei mostri Livello 7+ del bot non puo' piu'
  ancorarsi al suo avatar o a un nodo DOM obsoleto;
- guardrail: `tests/specs/summon-effect-card-anchor.spec.js`.

## Effetto Raigeki

- Raigeki (id 409) usa `FX.playRaigeki(owner, onImpact)` prima di risolvere
  la distruzione: i mostri restano visibili fino al lampo finale;
- il VFX colpisce tutti e cinque gli slot Mostro avversari, anche se vuoti,
  dal centro verso l'esterno, con cielo temporalesco, fulmini ramificati,
  impatti, particelle, scossa del campo e suono sintetizzato dedicato;
- esistono sia fallback CSS sia implementazione GSAP; la facciata ha una
  rete di sicurezza idempotente per non bloccare la risoluzione della carta;
- guardrail: `tests/specs/raigeki-lightning-effect.spec.js`.

## Effetto Buco Nero

- Buco Nero (id 7) conserva la regola esistente: fotografa posizione e carta
  dei mostri, li distrugge e risucchia duplicati grafici senza ritardare la
  risoluzione del duello;
- il vortice GSAP e' una singolarita' 3D stratificata: oscuramento e lente
  gravitazionale, disco di accrescimento, orizzonte degli eventi, tre orbite,
  materia luminosa, carte in spirale inclinate e collasso con onda e scossa;
- il fallback CSS replica lente, disco, nucleo e orbite, mentre il suono ha
  risucchio piu' lungo, frequenze discendenti e impatto finale;
- guardrail: `tests/specs/dark-hole-vortex-revamp.spec.js`.

## Cinematiche delle carte iconiche

- Forza dello Specchio (`382`) innalza uno specchio in prospettiva e riflette
  raggi esclusivamente verso gli slot dei mostri in Attacco che la regola
  distrugge; la distruzione resta sincrona per fermare subito la battaglia;
- Cilindro Magico (`10`) apre due cilindri viola, assorbe il colpo e lo devia
  verso i Life Point dell'attaccante mostrando il danno restituito;
- Rinascita del Mostro (`35`) è sincronizzata alla regola: il mostro rimane
  davvero nel Cimitero mentre emerge dal portale sotto un Ankh verde e viene
  Special Summonato soltanto alla callback d'impatto;
- Buco Trappola (`40`) apre una voragine prospettica nello slot bersaglio e
  vi lascia cadere una copia grafica del mostro; Tributo Torrenziale (`490`)
  attraversa entrambi i Terreni con due fronti d'acqua e schiuma;
- tutte le scene sono puramente DOM/CSS, bloccano transizioni e bot tramite
  `FX.isCinematicPlaying()`, rispettano `prefers-reduced-motion` e liberano
  sempre il contatore al termine. La cache visibile è `v198`;
- guardrail: `tests/specs/cinematiche-carte-iconiche.spec.js`.

Secondo gruppo:

- Anello della Distruzione (`419`) serra un collare a sei cariche sul
  bersaglio e mostra il danno realmente inflitto a entrambi i lati;
- Tempesta Pesante (`646`) oscura l'arena e investe entrambe le file M/T con
  due fronti di vento; Tifone dello Spazio Mistico (`607`) genera invece un
  imbuto verticale blu-viola che solleva, inclina e strappa la carta dal suo
  slot, distinto sia dal Tornado di Polvere sia dalla singolarità di Buco Nero;
- entrambe risolvono la distruzione alla callback d'impatto, lasciando le
  carte visibili fino al passaggio del fenomeno;
- Cambio di Cuore (`147`) e Controllo Mentale (`130`) condividono
  `FX.playMindControl`, ma usano rispettivamente il cuore chiaro/scuro e
  l'occhio psichico; il normale `takeControl` continua a mostrare il viaggio
  della carta e conserva le differenti regole temporanea/permanente;
- Richiamo degli Infestati (`136`) fa emergere il mostro dal Cimitero prima
  della vera Special Summon. `renderFields()` ricrea poi una catena inclinata
  fra il mostro e lo slot della Trappola finché il suo `targetUid` è valido;
- cache PWA `v199`; guardrail:
  `tests/specs/cinematiche-carte-iconiche-secondo-gruppo.spec.js`.

Movimento Terreno → mano: lo annuncia l'evento `transizione-carta` (emesso da
`ACTIONS.returnMonsterToHand`, `returnSpellTrapToHand` e Turbine Gigante
`262`) e lo disegna `FX.playZoneTransition`. Il `FX.playCardToHand` del branch
`feature/vfx-tifone-cilindro-ritorno-mano` NON è stato integrato (doppione di
questo meccanismo); del branch è entrato solo il Tifone. Guardrail:
`tests/specs/return-to-hand-mechanism.spec.js` (ascolta l'evento); cache PWA
`v263`.

Terzo gruppo:

- Buco Trappola senza Fondo (`128`) usa un portale viola dimensionale e
  una copia grafica risucchiata, distinto dalla voragine fisica del normale
  Buco Trappola; la regola continua a distruggere e poi bandire;
- Armatura Sakuretsu (`793`) chiude quattro piastre prospettiche sul mostro
  attaccante, mentre Giudizio Solenne (`448`) apre un tribunale celeste con
  sigillo di annullamento e mostra il costo LP realmente pagato;
- Libro della Luna (`875`) accompagna il ribaltamento con un'eclissi
  localizzata; Virus Distruggi-Carte (`165`) marca soltanto gli slot che la
  regola ha individuato con almeno 1500 ATK;
- queste cinque scene fotografano il DOM prima della mutazione ma non
  ritardano la regola: attacchi, annullamenti e Chain conservano così il
  proprio ordine sincrono;
- cache PWA `v200`; guardrail:
  `tests/specs/cinematiche-carte-iconiche-terzo-gruppo.spec.js`.

Quarto gruppo:

- Nega Attacco (`820`) assorbe la traiettoria offensiva in un varco e
  chiude visivamente la Battle Phase; Capro Espiatorio (`434`) fa
  materializzare uno spirito sopra ogni Token Pecora appena creato, prima
  del normale riscontro di nascita condiviso da tutti i Token;
- Scatola Mistica (`388`) conserva la fotografia del primo bersaglio
  distrutto fino alla seconda scelta e mostra due cabine prospettiche prima
  del normale passaggio di controllo;
- Rimozione del Limitatore (`350`) applica contagiri e sovraccarico soltanto
  agli indici dei mostri Macchina realmente potenziati;
- Incantesimo Ombra (`439`) ha un impatto iniziale e catene persistenti
  ricreate da `targetUid`: spariscono automaticamente quando mostro o
  Trappola lasciano il Terreno;
- cache PWA `v201`; guardrail:
  `tests/specs/cinematiche-carte-iconiche-quarto-gruppo.spec.js`.

Quinto gruppo:

- Cerchio Ammaliante (`620`) apre un sigillo dorato e mantiene un cerchio
  persistente derivato dal proprio `targetUid`;
- Cappelli Magici (`363`) materializza un cappello sopra ciascuno dei tre
  slot effettivamente nascosti; Moltiplicazione (`386`) divide Kuriboh verso
  gli slot dei nuovi Token;
- Controllore del Nemico (`226`, più la variante storica `845`) mostra un
  pannello olografico col comando scelto; Buco Dimensionale (`201`) usa un
  varco pulito e temporaneo, distinto dal portale distruttivo di Bottomless;
- Muro di Luce Rivelatrice non è presente in `data/cards.json`: non è stato
  aggiunto implicitamente durante un lavoro dedicato alle sole cinematiche;
- cache PWA `v202`; guardrail:
  `tests/specs/cinematiche-carte-iconiche-quinto-gruppo.spec.js`.

## Cinematica Evocazione Fusione

- `DuelEngine.actions.fusionSummon()` fotografa i materiali realmente scelti
  prima di mandarli al Cimitero e chiama `FX.playFusionMaterialEffect()`;
- le copie dei materiali orbitano in prospettiva 3D, stringono il raggio nel
  tunnel viola/blu e collassano nel nucleo; solo dopo i 3 secondi parte la
  normale cinematica del Mostro Fusione già presente nel motore;
- i materiali vengono consumati subito, ma lo slot resta realmente vuoto e
  il Mostro Fusione non è ancora in `gameState`; il callback finale lo
  Special Summona soltanto dopo la rimozione del vortice, facendo partire a
  quel punto anche la convergenza di Evocazione se è di Livello 7+;
- lo spazio viene validato prima di pagare i materiali: con il Terreno pieno
  la Fusione e' proponibile solo se almeno un materiale viene preso dal
  Terreno; `fusionSummon()` prenota deterministicamente la prima Zona che
  quel materiale liberera'. Materiali tutti in mano + Terreno pieno viene
  bloccato senza consumare nulla;
- `FX.isCinematicPlaying()` impedisce a fasi e bot di avanzare sotto la
  sequenza.
- all'inizio della convergenza `SFX.fusion()` riproduce
  `audio/standard/fusion.mp3` (precaricato da `audio-library.js`, con
  volume/mute SFX); vale per Fusione normale e combinazioni X/Y/Z;
- per un'Evocazione di Livello 7+ `playMonsterSummonEffect()` aspetta prima
  la ricerca del video: se esiste usa il filmato senza sovrapporre suoni;
  altrimenti la convergenza elementale usa l'audio dedicato della carta o,
  in sua assenza, `audio/standard/evocation.mp3`. I chiamanti usano ancora
  `summon` soltanto sotto il Livello 7;
- guardrail: `tests/specs/fusion-material-cinematic.spec.js` e
  `tests/specs/fusion-space-legality.spec.js`.

### Combinazioni senza Polimerizzazione

- i mostri con `banishFusionMaterials` (oggi Cannone Drago XY/XYZ) usano
  lo stesso `FX.playFusionMaterialEffect()` pur senza attivare la Magia
  Fusione: le copie X/Y/Z vengono fotografate, bandite e convergono;
- il risultato resta fuori da `gameState` per tutta la cinematica, entra
  solo nel callback finale e soltanto allora avvia la propria animazione
  di Evocazione (compresa quella dei Livelli 7+);

- a campo pieno viene prenotato deterministicamente il primo slot liberato
  dai materiali, anziche' rifiutare erroneamente la combinazione;
- guardrail: `tests/specs/contact-fusion-cinematic.spec.js`.

### Audio contestuale della campagna WW2

- `js/audio/audio-library.js` riconosce `?campaign=ww2` e, per ogni effetto
  standard, prova prima il file omonimo in `audio/standard/ww1/`;
- la cartella bellica copre attualmente `attackSwing`, `lifePointsLost` e
  `lifePointsGained`. Se un nome non e' coperto, non e' ancora caricato o
  il file manca, il resolver usa `audio/standard/` e poi il normale suono
  sintetizzato: nessun effetto resta muto;
- guardrail: `tests/specs/ww2-priorita-audio-ww1.spec.js`.

### Cinematiche acquisti del Negozio

- `js/economy/pack-opening.js` + `.css` riusano l'identita' del prodotto:
  l'apertura riproduce colore, fascia, emblema e conteggio della busta
  metallizzata dello scaffale, con linguetta dentellata che si strappa;
- l'acquisto di uno Starter/Structure Deck usa la vera `DeckBox`, compresa
  la carta di copertina, apre coperchio e faccia superiore e fa emergere
  un ventaglio di carte sopra un'aura prospettica;
- entrambe le sequenze rispettano `prefers-reduced-motion` e restano entro
  il viewport mobile; guardrail: `tests/specs/negozio-animazioni-prodotti.spec.js`.
- al riepilogo della busta le carte arrivano a 108px su desktop e restano
  separate; su mobile mantengono almeno 82px e diventano un carosello
  orizzontale con scroll-snap, senza ridursi o sovrapporsi. La carta scelta
  sale in primo piano. Il messaggio
  finale vive sotto il contatore e sparisce mentre `CardDetail` e' aperto,
  che viene portato sopra la cinematica. Guardrail:
  `tests/specs/sbustamento-striscia-come-mano.spec.js`.

## Stepper delle fasi

- `#phaseStepper` resta tra i due Terreni dentro `.battlefield-main`, con una
  barra a riga singola che riprende la UI dei menu: fondo quasi nero con
  sfumatura bruna, bordi oro sottili, angoli moderati e ombre corte. Le sei
  celle flessibili mantengono le icone SVG; la fase attiva usa ambra calda,
  mentre quelle concluse restano neutre e poco sature. Eliminati scansioni,
  bagliori azzurri e resa da HUD moderno;
- desktop conserva le etichette; sotto `900px` mostra solo badge e numero.
  Un container query sul rail usa etichette compatte complete sotto 860px
  (`Attesa`, `Lotta`) e le nasconde sotto 570px: mai testo con ellissi.
  In ogni breakpoint la larghezza usa la stessa formula di `.field-row`
  (`7 * --field-slot-w + 6 * --field-gap`), quindi i bordi del rail seguono
  gli slot esterni senza superarli; dopo ogni render/resize
  `syncPhaseStepperToFieldWidth()` rifinisce la misura sul rettangolo reale
  della riga (necessario per padding/bordi minimi delle zone speciali su
  mobile) e corregge anche l'offset orizzontale quando campo e colonna
  centrale hanno centri diversi. Sotto `420px` non usa gap fissi capaci di
  produrre overflow;
- `min-width:0`, `flex: 1 1 0`, larghezze massime e `nowrap` tengono stabile
  la geometria durante i resize. `updatePhaseIndicator()` aggiorna anche
  attributi ARIA/tabindex e lo step cliccabile risponde a Invio/Spazio;
- guardrail: `tests/specs/phase-stepper-responsive.spec.js`.

## Waboku: barriera persistente

- Waboku (`id 503`) continua a usare `noBattleDamageFor` e
  `noBattleDestructionFor` per la regola di gioco, ma memorizza anche l'UID
  della copia attiva in `wabokuProtectionUidFor`;
- `renderFields()` aggiunge una sola barriera olografica 3D dietro l'intera
  fila Mostri del proprietario protetto: scudo stratificato, sigillo,
  anelli e scintille, senza coprire o intercettare le carte;
- entrando in End Phase i flag e il visuale vengono rimossi subito; una
  vera distruzione della copia sorgente passa da `onSTDestroyed` e spegne
  allo stesso modo protezione e barriera. Il normale invio al Cimitero di
  una Trappola Normale dopo la risoluzione non e' considerato distruzione;
- guardrail: `tests/specs/waboku-persistent-shield.spec.js`.

## Distruzione Magie/Trappole

- `DuelEngine.actions.destroySpellTrap()` usa
  `FX.playSpellTrapDestroyEffect()` prima di svuotare la zona;
- Magie e Trappole hanno palette verde/rosa distinta, scansione luminosa,
  collasso olografico e frammenti energetici ascendenti: nessuna esplosione
  da mostro e nessun semplice volo della carta al Cimitero;
- coperti anche i redirect di Trappola Fasulla e dei Mostri Union.
- guardrail: `tests/specs/spell-trap-destruction-effect.spec.js`.

## Pescata causata da effetti

- `drawCardsToHand(..., true)` registra gli uid pescati prima di eseguire
  `ON_DRAW_CARDS`; `renderPlayerHand()` assegna quindi `pending-deal` già
  alla creazione del nodo, anche durante render intermedi o trigger annidati;
- un solo job a stack concluso esegue il render definitivo e la distribuzione
  sfalsata: le carte non possono più apparire, sparire e riapparire;
- il filtro per uid evita di animare vecchie carte quando l'effetto scarta o
  sposta subito alcune delle carte appena pescate.
- guardrail: `tests/specs/pescata-effetto-nessun-flash-preanimazione.spec.js`.

## Ambienti dei field

- passata organica 2026-10-12: gli strati di particelle, caustiche, rune,
  riflessi, scariche e scie di sabbia sono raster procedurali diversi a ogni
  ingresso nel field, non più pattern ripetuti riconoscibili; gli ambienti
  atmosferici alternano accenti ravvicinati, pause normali e silenzi lunghi;
- `dirigibileKaibaCorp.jpg` usa la coreografia dedicata `ventoContinuo`: una
  corrente leggera accompagna sempre il movimento del mezzo e raffiche più
  forti arrivano con intensità e cadenza irregolari. Il vento è composto da
  filamenti curvi canvas e non da linee parallele;
- le scansioni tecnologiche possono cambiare verso e inclinazione. Le
  coreografie dei due field Grande Guerra non sono state modificate;

- tutti i 36 field di `ArenaOptions.FIELDS` hanno una configurazione
  ambientale individuale in `js/ui/field-ambience.js`; le immagini mobile
  condividono il nome file e quindi la stessa configurazione coerente;
- le configurazioni riusano profili modulari (sabbia, vento, tech, natura,
  acqua, ghiaccio, fuoco, ombra, fumo, energia e citta') e tre coreografie
  (`attraversa`, `scansione`, `atmosfera`), mantenendo nome e variante
  specifici per ogni immagine;
- `VideoQuality.set()` emette `ygo:video-quality-change`: su `normali` il
  modulo elimina immediatamente timeline, timer e strati DOM; su `alti` lo
  riavvia. Resta disabilitato anche con `prefers-reduced-motion`;
- guardrail: `tests/specs/field-ambience-all-fields.spec.js`.
- il vento del Dirigibile non usa pattern lineari ripetuti: genera su canvas
  folate curve e sbuffi irregolari, diversi a ogni ingresso nel field.
- i due field Grande Guerra usano la coreografia dedicata `guerra`: impatti
  casuali nella fascia centrale, fumogeni e raffiche di traccianti, con
  variante giorno/notte e pulizia completa dopo ogni sequenza.
- nei field Grande Guerra l'asse di battaglia è verticale: impatti e
  traccianti garantiscono in ogni sequenza colpi basso→alto e alto→basso;
  anche il fumogeno nasce da uno dei due fronti e deriva verso l'altro.
- densità e frequenza WW1 non sono fisse: ogni evento genera 1–5 impatti,
  1–4 nubi di gas indipendenti, 4–12 traccianti a grappoli irregolari e
  1–5 flash d'artiglieria; il timer alterna contrattacchi rapidi,
  pause ordinarie e rari silenzi lunghi (circa 1,4–17 secondi).
- i traccianti WW1 hanno asse verticale rigoroso: posizione, velocità e
  luminosità restano casuali, ma rotazione e coordinata X non cambiano mai.
- guardrail: `tests/specs/ww1-battlefield-effects.spec.js`.
- le coreografie organiche non percorrono più una sola retta: vento/sabbia
  e profili atmosferici usano più segmenti con deviazioni casuali, cambi di
  scala e rotazione; le scansioni lineari restano solo nei field tecnologici;
- `stadioKaiba.jpg` usa il profilo dedicato `spalti`: gruppi irregolari di
  flash fotografici nascono dalla gradinata alta e lungo entrambi i lati del
  field, a quote diverse, con riflessi brevi
  verso il campo al posto della vecchia griglia di scansione.
- guardrail: `tests/specs/kaiba-stadium-crowd-flashes.spec.js`.
- seconda passata ambientale: i profili condivisi possono aggiungere una
  `firma` per variante (raggi, foglie, petali, spiriti, luna, vortice,
  scariche, lucciole, cristalli, braci, onde o fiamme), così luoghi della
  stessa famiglia non differiscono più soltanto per tinta e velocità.
- guardrail: `tests/specs/field-ambience-distinct-signatures.spec.js`.
- `anticoEgittoTempioOscuro.jpg` non usa più il generico profilo ombra:
  `tempioOscuro` sincronizza bagliori irregolari sui bracieri perimetrali,
  un respiro caldo/freddo sull'Occhio di Horus e scintille laterali, senza
  viola, spiriti o velature astratte.
- guardrail: `tests/specs/dark-egyptian-temple-ambience.spec.js`.
- `industriaKaibaCorp.jpg` estende la scansione tech con la coreografia
  `industria`: 2–5 grappoli di archi elettrici localizzati, ciascuno con
  quantità, posizione, inclinazione, intensità e cadenza casuali.
- guardrail: `tests/specs/kaibacorp-industry-sparks.spec.js`.

## Sandbox: cambio field e uscita

- `duello-sandbox.html` seleziona il field iniziale dal catalogo unico
  `ArenaOptions.FIELDS` e lo salva dentro `ygoSandboxConfig`;
- durante il duello `js/engine/duel-sandbox.js` monta `#sandboxFieldSelect`:
  il cambio è immediato, aggiorna sia lo sfondo desktop/mobile sia
  `FieldAmbience`, e persiste la scelta per la prova successiva;
- “Esci Sandbox” torna direttamente alla configurazione con conferma, senza
  chiamare `endDuel()`, registrare sconfitte o attraversare la schermata finale;
  anche il tasto Indietro hardware usa la stessa conferma.
- guardrail: `tests/specs/sandbox-field-switch-exit.spec.js`.

## Regole operative importanti ereditate da CLAUDE.md

- Conversazione e documentazione operative in italiano.
- Per le regole reali delle carte usare YGOPRODeck come riferimento primario.
- Le Trappole devono essere prima posizionate coperte.
- Eliminare dati carta duplicati/imprecisi invece di mascherarli.
- Le immagini carta devono contenere la sola illustrazione nella cornice CSS.
- Commentare soprattutto invarianti, motivazioni e bug non ovvi.
- Prima di un refactor ampio leggere `docs/architecture/GUIDA_RIUTILIZZO.md`.
- Per modifiche al duello, oltre agli spec mirati, la pagina standard di prova
  manuale è `duelMonstersCore.html`.

## UX della mano nel duello

- `renderPlayerHand()` instrada mouse e touch nello stesso ciclo Pointer Event
  (`startHandCardDrag` -> `handleDragEnd`), senza aggiungere un secondo `click`;
- un tap mostra sempre il pannello carta; durante le fasi non compatibili il
  gesto diventa sola ispezione e non può iniziare un drag/drop illegale;
- `selectHandCardForInspection()` mantiene alzata la carta toccata anche quando
  l'azione disponibile apre subito pulsanti flottanti;
- il click/tap esterno passa da `clearHandCardSelection()` e rimette la carta
  in linea senza azzerare scarti, Tributi o altre selezioni bloccanti.
- alcune WebView Android generano un ulteriore `click` dopo il `pointerup`
  touch: `armHandCompatibilityClick()`/`consumeHandCompatibilityClick()`
  consumano esclusivamente quel click alle stesse coordinate, impedendo che
  body o click-catcher richiudano immediatamente carta e pulsanti flottanti.
- su dispositivi touch il pannello informazioni si apre soltanto con un tap
  diretto: gli `mouseenter` sintetici e i trascinamenti non validi non sono
  più interpretati come ispezioni. In landscape mobile anteprima e testo sono
  affiancati; `.card-info-content` ha uno scroll `pan-y` indipendente.

## Cinematica Evocazione Rituale

- `performRitualTribute()` è il punto condiviso di tutte le Magie Rituale:
  conserva i materiali scelti nel contesto prima di mandarli al Cimitero;
- `ACTIONS.specialSummon()` intercetta quel payload solo per un mostro con
  `category === 'ritual'`, avvia `FX.playRitualSummon()` e rimanda la vera
  comparsa sul Terreno alla callback finale;
- sequenza garantita: materiali/sigillo 3D -> chiusura del rito -> Special
  Summon normale -> eventuale cinematica dedicata o Lv.7+;
- il rito conta come cinematica bloccante (`FX.isCinematicPlaying()`), quindi
  Chain, bot e cambi fase attendono; la successiva Summon non viene confusa
  con una rianimazione dal Cimitero;
- le vecchie Magie Rituale 116, 187, 506 e 517 sono state ricondotte allo
  stesso helper, insieme a tutte quelle che già lo usavano.

## Effetti vento di Magie/Trappole

- Tornado di Polvere (219) usa `FX.playDustTornado()`: vortice prospettico
  localizzato sullo slot scelto; la carta viene distrutta all'impatto, non
  prima, passando comunque da `destroySpellTrap()` per trigger e protezioni;
- Piumino delle Arpie (291) usa `FX.playHarpiesFeatherDuster()`: fronte di
  vento irregolare e piume attraverso tutta la fila Magie/Trappole nemica;
  l'intero lotto viene risolto dopo il passaggio della folata;
- entrambe saltano soltanto la frattura ST generica tramite l'opzione
  `destroySpellTrap(..., { skipVisual: true })`, evitando due animazioni
  sovrapposte senza aggirare la logica di distruzione;
- le due sequenze sono cinematiche bloccanti e mantengono compatibilità con
  scelta bersaglio e Trappola Fasulla/batch di protezione.

## Fedeltà narrativa — Il Regno delle Ombre

- `js/data/story-campaigns.js` segue ora la cronologia della serie anche nei
  cambi di protagonista: Joey affronta Mai, Rex, Keith e Marik; Kaiba affronta
  Ishizu/Lector; Téa, Tristan e Joey coprono le rispettive sfide virtuali;
- il Regno dei Duellanti include viaggio in nave, perdita di Exodia, Fratelli
  Paradosso e le finali complete Mai/Keith/Joey prima di Pegasus;
- Battle City colloca il duello controllato al molo prima dei quarti e il
  dirottamento di Noah dopo i quarti, durante il viaggio verso la Torre;
- nel Mondo dei Ricordi è Yugi a duellare contro Bakura per consegnare il nome
  ad Atem; le scene non anticipano più la scoperta;
- tutti i 53 nodi `duel` hanno un `dialogo` introduttivo; 26 appartengono
  alla linea di Yugi/Atem e 27 sono diramazioni parallele (incluse le quattro
  amichevoli facoltative del prologo richieste come allenamento);
  diramazioni parallele dedicate agli altri personaggi;
- i nodi con `parallelo: true` e `sbloccaDopo` usano il registro persistente
  `progress.laterali`: vincerli non modifica mai `progress.sotto`, quindi il
  sentiero principale può continuare indipendentemente; la mappa li mostra
  in azzurro e collega il ramo alla sua ancora;
- gli allenamenti inventati del prologo e Gozaburo sono scene, non
  combattimenti;
- ogni nuova tappa annidata richiede una voce `dalla: 'inserite'` in
  `separazioni`, perché il progresso interno alle aree è salvato per indice.

- I sei archi anime dichiarano sul capitolo il proprio `field` e la propria
  `music`: entrando nella relativa mappa la colonna sonora dell'arco sostituisce
  quella della mappa principale; nei duelli vale la precedenza
  tappa -> capitolo -> campagna.
- `StoryProgress` espone sempre campo, musica e difficoltà già risolti. Nelle
  campagne a livelli la difficoltà è soltanto quella scelta all'inizio e
  l'Editor non presenta più un selettore fuorviante sul singolo duello.

## Ritorno da fine duello

- `DuelSession.finish()` usa direttamente `location.replace(returnUrl)`:
  `history.back()` nell'APK poteva riportare alla mappa generale anziché
  all'area; vittoria e sconfitta sono coperte dal test
  `storia-continua-fine-duello.spec.js`, che verifica anche `torneo=<area>`.

## Ripresa del duello su mobile

Se Android sospende la WebView a schermo spento, `pageshow` e il ritorno a
`visibilityState=visible` ripristinano l'interazione senza cambiare lo stato
del duello: un trascinamento d'attacco rimasto senza puntatore viene annullato,
una decisione ancora pendente viene riproposta con la callback originale e un
video di Evocazione in pausa viene riavviato oppure chiuso liberando il lock.
Lo spec `ripresa-duello-schermo` copre il blocco osservato in Battle Phase.

## Editor delle mappe Storia

`js/dev/story-map-editor.js` è disponibile ai soli amministratori e lavora
sugli stessi oggetti usati dalla mappa. Ogni nodo espone sempre la propria
etichetta `X/Y`, senza richiedere un click; durante il trascinamento sia questa
etichetta sia il riepilogo nella barra si aggiornano a ogni `pointermove`.
Sono coordinate del mondo mappa, quindi coincidono con quelle esportate anche
se viewport, zoom e scorrimento cambiano. Lo spec
`editor-mappa-storia-admin` verifica il valore prima del rilascio del mouse,
non soltanto il riepilogo finale.

## Economia del lotto TCG prima serie (ID 1131-1160)

La fonte di verità resta divisa fra `js/data/card-rarity.js` per le rarità,
`js/economy/card-acquisition.js` per fonti e imprese e
`js/economy/shop-catalog.js` per rotazioni e buste. Il censimento del lotto è
documentato in `docs/economy/CARD_ACQUISITION.md` e verificato dallo spec
`nuove-carte-economia`.

Due carte richiedono una prima copia tematica prima di entrare nel commercio:
Parassita Paracida dopo 15 vittorie contro Weevil a Difficile e Golem di Lava
dopo 20 contro Marik a Difficile. Le Fusioni e i quattro Materiali aggiunti
sono raccolti anche nella busta `fusioni` («Forgia delle Fusioni»), così non
dipendono soltanto dai pool generici molto ampi. Ogni carta espone la propria
fonte nella Cartoteca e conserva il limite globale di tre copie.

## Cannoni X/Y/Z e scelte di Posizione

Cannone Drago XY si combina bandendo X + Y; Cannone Drago XYZ richiede
direttamente X + Y + Z, non XY + Z. Entrambi rifiutano la rianimazione dal
Cimitero. Testa di Drago Y e Carro Armato Metallico Z usano il ciclo Union
completo: aggancio, bonus/protezione e distacco volontario in Main Phase.

`DuelEngineUI.openPositionPicker` è una scelta obbligatoria: viene aperta
dopo che il mostro è già stato scelto da un effetto, quindi cliccare fuori
non la chiude. L'Evocazione Normale senza Tributi resta invece annullabile
perché non ha ancora pagato costi; dopo un Tributo anche il suo picker era
già obbligatorio. Guardrail: `cannoni-xyz-posizione-obbligatoria`.

## Come mantenere questa memoria

Aggiornare questo file quando cambia uno dei seguenti elementi:

- architettura o responsabilità di una cartella;
- fonte di verità dei dati;
- comandi di sviluppo/test;
- schema persistito o protocollo multiplayer;
- lavoro incompleto che una sessione successiva deve riprendere;
- rischio importante chiuso o appena scoperto.

Non trasformarlo in un diario dettagliato: la cronologia lunga resta in
`CLAUDE.md`. Qui devono rimanere la mappa corrente, le decisioni operative e lo
stato dei lavori ancora rilevante.
