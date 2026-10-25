/**
 * version.js — numero di versione del GIOCO (contenuto/motore), un solo
 * posto da aggiornare a mano ad ogni cambiamento significativo invece
 * di un numero enunciato solo nei messaggi di commit — così chi gioca
 * può vedere da dentro il gioco stesso quale versione sta usando
 * (mostrato in index.html, footer del menu principale). Identico sia
 * aperto da browser sia dentro l'APK Android — SEPARATO e indipendente
 * dal versionCode/versionName nativi del wrapper Android
 * (android/app/build.gradle, fuori da questo repository): quello
 * traccia le build APK installabili sul telefono, questo traccia lo
 * stato del codice del gioco stesso. Aggiornare i due insieme quando
 * una sessione tocca entrambi (il caso comune), ma restano concetti
 * distinti — una modifica solo ai file web non richiede un nuovo
 * versionCode Android, e viceversa una modifica nativa (icona,
 * permessi...) senza toccare il gioco non richiede un nuovo
 * GAME_VERSION.
 *
 * Schema: SemVer (major.minor.patch). Dalla release stabile 1.0.0 non si
 * usa più il suffisso beta: le correzioni incrementano la patch, le nuove
 * funzionalità compatibili la minor e le rotture incompatibili la major.
 *
 * ⚠️ QUESTA REGOLA NON È STATA SEGUITA: il numero è rimasto fermo a
 * beta.3 per 237 commit, cioè per quasi tutto lo sviluppo — Tornei,
 * Sfide, Negozio, Multiplayer, Modalità Storia e altro sono usciti
 * tutti sotto lo stesso numero. Chi guardava il footer del menu vedeva
 * sempre la stessa versione mentre il gioco cambiava sotto i piedi, che
 * è esattamente il problema che questo file doveva risolvere.
 *
 * Il salto a beta.20 è una stima onesta di quelle sessioni, non un
 * conteggio: i numeri intermedi non sono mai esistiti e fingere di
 * ricostruirli uno per uno sarebbe peggio che ammettere il buco. Da qui
 * in avanti si incrementa DAVVERO ad ogni sessione con cambiamenti
 * visibili, e l'elenco qui sotto tiene traccia di cosa c'è dentro.
 *
 * 1.4.33 — Loading generico di nuovo solo CSS (il canvas WebGL sul percorso critico di ogni pagina e' il sospetto principale dello schermo nero sull'APK). Scheda carta (Cartoteca): la X resta incollata in alto mentre si scorre e sta sopra la carta che si inclina.
 * 1.4.32 — Carte vive: via anche il bordo lucido (nessuna cornice). Loading: carta piatta (il canvas non la taglia piu'), bagliore giallo molto ridotto. Win/Lose: particelle ridotte di molto. Impatti di battaglia (danno ai LP, scontro, distruzione) in WebGL con carte e scossa su 	ranslate (WAAPI) invece di tween GSAP su x/filter.
 * 1.4.31 — Carte vive (Cartoteca, Negozio, scheda): lucido, laminato, arcobaleno e grana stanno solo sopra la finestra dell'illustrazione, non su tutta la carta; nome, stelle e ATK/DEF restano nitidi.
 * 1.4.30 — Annuncio di cambio turno: tolti i raggi ruotanti. Loading generico: via il riquadro giallo attorno alla carta (il canvas WebGL sfumava male ai bordi) e il dorso e' ora identico a quello delle carte coperte del duello.
 * 1.4.29 — Loading generico: tolti i raggi che giravano sul dorso della carta; al loro posto un piccolo canvas WebGL con particelle dorate che salgono a spirale verso la carta e un alone che respira (si ferma a loader nascosto, assente con movimento ridotto o senza WebGL).
 * 1.4.28 — Presentazione VS: pedine scontornate grandi (niente avatar tondi) che entrano dal proprio lato, i due flussi WebGL si sovrappongono oltre il centro e si fondono in una colonna d'energia. Grido di Evocazione: la figura non dondola piu', continua molto piano a scivolare di lato fino a sparire.
 * 1.4.27 — Presentazione VS ("It's time to duel!") e schermate Vittoria/Sconfitta/Pareggio: tolti i raggi ruotanti, al loro posto uno sfondo WebGL per ogni scena (fiumi di energia blu/rossa con onda d'urto, colonne di luce e braci, nebbia e cenere, polvere neutra).
 * 1.4.26 — Carte vive: tolto il WebGL dei riflessi di rarita' (tornano gli strati CSS di prima). Menu principale: lo sfondo resta fermo (si muove solo il logo) e il velo di luce dell'ambiente e' molto piu' tenue.
 * 1.4.24 — Menu principale: bagliori sull'oro molto piu' rari e stelle un po' meno frequenti.
 * 1.4.23 — Scudo araldico vero, marchio fisso delle Spade Rivelatrici in WebGL, Rinascita del Mostro e Pescata fedeli agli originali (tolti gli override WebGL non fedeli di danno/scontro/distruzione/moneta/dado), menu principale: via i raggi che girano, ambiente WebGL legato allo sfondo (luna, nubi, stelle, torce, oro).
 * 1.4.22 — Icone flottanti animate in WebGL (Attiva effetto, Annulla, Conferma, Seleziona, Evocazione), spade/scudo animati sopra la carta messa in Attacco/Difesa, Evocazione sul campo piu' contenuta e senza gialli.
 * 1.4.21 — Tutti gli spettacoli di carta in WebGL (shader per primitiva con scissor), Evocazione semplificata, icone Attacco/Difesa animate (spade che si incrociano, scudo), Buco Nero piu' grande e scuro, tolto il suggerimento 'passa il mouse'.
 * 1.4.20 — Buco Nero WebGL rifatto (orizzonte, anello di fotoni, disco di taglio, arco lensato) e carte risucchiate con sola transform (niente scatti).
 * 1.4.19 — Backend WebGL degli spettacoli di carta (Buco Nero, Spade Rivelatrici, Raigeki) senza GSAP; effects.js sceglie il backend per effetto.
 * 1.4.18 — Effetti ambientali WebGL su tutte le mappe della Storia (macromappa, sei archi, aree, Memorie Proibite, Freedom, Grande Guerra) e citta' che scorre sotto il Dirigibile.
 * 1.4.17 — Fiamme piu' lente e morbide, e tutti i bracieri principali dei templi notturni (fino a 28 per arena).
 * 1.4.16 — Meno puntini di particelle ovunque (e nessuno in Torre Shadow, Torre Pegasus, Luna Blu, Colosseo, Montagna); proiettori olografici sulle colonne delle Torri Kaiba.
 * 1.4.15 — Fiamme di torce e bracieri dei templi e delle arene notturne come luci vere nei punti delle illustrazioni; flash dello Stadio Kaiba solo sugli spalti; sandbox: interruttore effetti ambientali e evento al cambio field.
 * 1.4.14 — Anche i due fronti della Grande Guerra in WebGL: cannoneggiamento continuo con impatti, fumo e traccianti.
 * 1.4.13 — Tutti gli ambienti dei campi (tranne la Grande Guerra) ridisegnati con shader WebGL: vento a velocita' costante, particelle, raggi, caustiche, fulmini, scansioni, scintille, un evento caratteristico per arena; regolatore di fps.
 * 1.4.12 — Ambiente WebGL: rumore senza sin() e precisione alta (sui telefoni il vento risultava invisibile), vento piu' visibile.
 * 1.4.11 — Ambiente del Dirigibile disegnato da uno shader WebGL (17 -> 44 fps misurati a CPU x4), con ripiego sugli strati DOM.
 * 1.4.10 — Prestazioni: su telefono e APK i Dettagli video partono da Normali (gli strati dell'ambiente del campo pesavano ~3x); chi ha scelto Alti li tiene.
 * 1.4.9 — Grido di Evocazione: per chi entra da destra banda e vento sono lo specchio esatto della scena di sinistra.
 * 1.4.8 — rifinite le pose di esclamazione di Atem, Barbero, Ishizu, Yami Marik, Yami Yugi e Yugi Muto.
 * 1.4.7 — pose di esclamazione dedicate ai gridi di Evocazione dei duellanti.
 * 1.4.6 — Alberto Angela diventa Imperator Alberto Angela, Signore dell'Eterna Roma.
 * 1.4.5 — Alessandro Barbero si chiama ora Ser Alessandro Barbero.
 * 1.4.4 — Grido di Giacobbo: Freedom al posto di Voyager; Barbero con la spranga.
 * 1.4.3 — Grido di Evocazione anche per Roberto Giacobbo, Alberto Angela e Alessandro Barbero.
 * 1.4.2 — Il bot dà la precedenza a QUALUNQUE scelta del giocatore: nessuna sua mossa (Magie, Set, Evocazioni, Fusioni, Posizioni, attacchi) parte con una scelta aperta, e prima di attaccare ricontrolla attaccante e campo.
 * 1.4.1 — Evocazione Tributo sempre scoperta in Attacco; Drago Mascherato fa scegliere la Posizione (Difesa scoperta); il bot aspetta le scelte del giocatore e decide il bersaglio dopo; pausa visibile fra le mosse del bot.
 * 1.4.0 — Alberto Angela e Alessandro Barbero entrano nei Duellanti Extra con tre deck tematici, pedine e dialoghi completi.
 * 1.3.39 — Controllo dei tipi acceso su 40 file piccoli (@ts-check), globali dichiarati in types/globali.d.ts; la scala di card.css ha il nome --carta-schermo-intero.
 * 1.3.38 — Multiplayer: la forma dei messaggi (js/multiplayer/protocollo-mp.js) è controllata dal relay e dai client; un messaggio rotto si scarta.
 * 1.3.37 — Rinforzi: vocabolario chiuso degli effetti delle carte (guardrail) e forma del salvataggio controllata anche per cloud e backup, con tipi in types/salvataggio.d.ts.
 * 1.3.36 — Importa salvataggio: file controllati, riquadro di conferma con confronto e avvisi, salvataggio di prima conservato come copia di sicurezza.
 * 1.3.35 — Profilo: pulsante \: \ di Evocazione: una sola banda senza raggi, vento continuo, una frase per riga, testo che si adatta, avatar mai tagliato.
 * 1.3.32 — Gridi di Evocazione: più per Yami Marik, nuovi per Ishizu e Noah; tolti Guerriero Celtico e Kuriboh a Yugi, Signore dei D. a Kaiba.
 * 1.3.31 — Il grido di Evocazione dura 3 secondi invece di 2,2.
 *
 * 1.3.30 — La sessione di accesso dura 48 ore, poi si rifà il login (prima di
 *   uscire il progresso viene salvato sul cloud).
 *
 * 1.3.29 — Stesso account su due dispositivi: un dispositivo rimasto indietro
 *   non può più sovrascrivere i progressi dell'altro (versione del cloud
 *   ricordata per dispositivo, caricamento atomico, copia di sicurezza di ciò
 *   che si era fatto qui).
 *
 * 1.3.28 — Scheda carta: un tocco sulla carta la mostra a tutto schermo, con le
 *   stesse proporzioni e il suo effetto; un altro tocco (o Esc) la richiude.
 *
 * 1.3.27 — Quattro nuove lezioni nel Tutorial: Il campo di gioco, Attacco e
 *   Difesa, L'Evocazione Speciale (Rinascita del Mostro e Cannoni senza
 *   Polimerizzazione), Carte che restano sul campo (Continue e Terreno).
 *
 * 1.3.26 — Nuova opzione "Giroscopio sulle carte" (Impostazioni): spenta, nel
 *   dettaglio carta su telefono la luce si muove piano da sola invece di
 *   seguire il giroscopio.
 *
 * 1.3.25 — Carta in dettaglio su telefono: niente inclinazione né ondeggio, ma
 *   il giroscopio continua a muovere la luce (riflessi di rarità).
 *
 * 1.3.24 — Accesso e registrazione da APK: la tastiera non copre più i campi
 *   (spazio in fondo pari alla tastiera, scorrimento e campo portato in vista).
 *
 * 1.3.23 — Grido di Evocazione: il duellante annuncia la carta simbolo in due
 *   bande oblique con effetto vento; annuncio di turno "TURNO + nome"; il
 *   Piumino delle Arpie sbriciola le carte colpite; campi e musiche di Storia
 *   e tornei corretti (ritratto di Yami Bakura, sfondo del Castello, musica
 *   di Freedom).
 *
 * 1.3.22 — Completati Guerrieri Magnetici e Cavalieri delle Figure di
 *   Yugi; la IA Difficile riconosce le Evocazioni Speciali dalla mano.
 *
 * 1.3.21 — Aggiunte tre lezioni guidate specifiche (Equipaggiamenti,
 * Rituali e Magie Rapide) e quattro puzzle realmente risolvibili.
 *
 * 1.3.20 — Ripristinato il fronte senza bordo scuro; la mano non viene più
 *   staccata e riagganciata a ogni render, eliminando un altro flicker WebView.
 *
 * 1.3.19 — La cornice del fronte delle carte diventa più spessa e
 *   antracite, più vicina all'aspetto delle carte fisiche originali.
 *
 * 1.3.18 — Un mostro coperto attaccato viene distrutto conservando
 *   visivamente la Posizione di Difesa, senza scattare in Attacco.
 *
 * 1.3.17 — Il Profilo rende espliciti livello e numero totale dei titoli,
 *   punti mancanti e percorso completo con tutte le soglie.
 *
 * 1.3.16 — Il fronte delle carte adotta il sottile bordo nero delle carte
 *   fisiche, coerente fra miniature, duello e viste grandi.
 *
 * 1.3.15 — Il Mondo dei Ricordi segue l'intero finale dell'anime: viaggio
 *   in Egitto, Gioco delle Ombre, Mahad, Aknadin, Kisara, Kul Elna, Zorc,
 *   Horakhty, viaggio a Luxor, Duello Cerimoniale ed epilogo in Giappone.
 *
 * 1.3.14 — Il retro Duel Monsters arrotonda anche la cornice marrone;
 *   il duello non decodifica più immagini di carte provvisorie a ogni
 *   ridisegno e il finale anime prosegue fino all'aeroporto del Cairo.
 *
 * 1.3.13 — I duelli della Storia anime usano arene e musiche specifiche
 *   per ogni arco narrativo e per i suoi scontri principali; nuovo retro
 *   Duel Monsters e stepper delle fasi più leggero, epico e responsive.
 *
 * 1.3.12 — La Cartoteca usa un ordine di catalogo stabile: Yu-Gi-Oh per ID
 *   crescente, senza rinumerazioni, e l'intero set Grande Guerra in fondo.
 *
 * 1.3.11 — Le carte ottenute dalle bustine tornano cliccabili anche con un
 *   click reale; nuova impostazione salvata per disattivare esclusivamente i
 *   filmati dedicati di Evocazione, conservando gli effetti normali.
 *
 * 1.3.10 — Rifinitura minima della fila stelle: anche il margine visivo dei
 *   mostri Livello 12 resta interamente dentro la cornice.
 *
 * 1.3.9 — Anche la Cartoteca integrata nel menu usa davvero 300 carte per
 *   pagina; laminatura e glitter delle griglie conservano l'aspetto ma non
 *   ridipingono piu' gradienti e maschere a ogni movimento del puntatore;
 *   le stelle sono leggermente piu' compatte e anche i Livelli 12 rientrano.
 *
 * 1.3.8 — Login più leggibile e coerente con l'arena, con campi etichettati
 *   e layout responsive; Cartoteca alleggerita a 300 carte per pagina.
 *
 * 1.3.7 — Forza dello Specchio diventa una grande barriera sul lato del
 *   difensore, con raggi ramificati, impatti e frammenti sui mostri nemici.
 *
 * 1.3.6 — Cilindro Magico ridisegnato come grande deviazione energetica:
 *   portali, sigillo e impatto convergono sulla mano dell'attaccante.
 *
 * 1.3.5 — Consultazione carte sul Terreno con pressione prolungata/clic
 *   destro, prompt Posizione ripulito e nodi della mano conservati tra i
 *   ridisegni. Il video compare con un cambio di layer atomico.
 *
 * 1.3.4 — Filmati del duello fluidi: primo frame sincronizzato, compositing
 *   alleggerito e ambiente/ologrammi sospesi durante la riproduzione.
 *
 * 1.3.3 — Regole raccolte nel Tutorial; Rivincite e Torre legate ai
 *   progressi della Storia. Sul Terreno un comando informativo separa la
 *   consultazione dalle azioni, e le scelte obbligatorie non scrivono più
 *   istruzioni sopra il campo.
 *
 * 1.3.2 — Il box informazioni carta resta disponibile nei tap di
 *   consultazione, ma non si apre più sopra attacchi, Tributi, scarti e
 *   altre selezioni obbligatorie del duello.
 *
 * 1.3.1 — Cannoni X/Y/Z fedeli ai materiali TCG, distacco volontario dei
 *   Mostri Union e scelta Attacco/Difesa non più perdibile cliccando fuori.
 *
 * 1.3.0 — completamento del catalogo TCG della prima serie con 30 carte,
 *   censimento delle rarità, fonti in Cartoteca, imprese firma per Golem di
 *   Lava e Parassita Paracida e busta tematica Forgia delle Fusioni.
 *
 * 1.2.0 — rework anime controllato dell'archetipo Toon: Starter Pegasus
 *   invariato, nuovi effetti, IA per Abbandonato/Mille Occhi e deck
 *   avversari Pegasus ribilanciati sulle tre difficoltà.
 *
 * 1.1.5 — streaming delle soundtrack compatibile con le risposte HTTP 206;
 *   continuità web più robusta e player musicale nativo persistente nell'APK.
 *
 * 1.1.4 — cinematica ricompensa alleggerita: niente griglia o blur pesanti,
 *   meno particelle e ingresso separato dal movimento di attesa.
 *
 * 1.1.3 — ricompensa carta più lunga e non interrompibile durante la
 *   rivelazione; le carte sbustate scorrono con touch, mouse e rotellina.
 *
 * 1.1.2 — le buste generiche conservano emblemi originali, mentre quelle
 *   tematiche espongono l'artwork di un vero mostro simbolo del tema.
 *
 * 1.1.1 — Drop Exodia triplicati, Slifer a 30 vittorie su Strings,
 *   buste tematiche bilanciate con creature base e nuove illustrazioni;
 *   pulsante admin temporaneo per provare la cinematica ricompensa.
 * 1.1.0 — Rework dell'acquisizione: sette rarità, rotazioni e buste
 *   tematiche, carte firma, Dei Egizi, Exodia con pity, audit del farming
 *   e cinematica finto 3D per ogni carta guadagnata.
 * 1.0.43 — Multiplayer: una Carta Equipaggiamento dell'avversario non
 *   sparisce più dal tuo schermo dopo un suo Effetto Veloce. Tolto un
 *   doppione di "M-Guerriero #1" con l'Attributo sbagliato.
 * 1.0.42 — Nei menu di scelta della musica da duello ci sono tutte le
 *   tracce da 30 a 43 più la 57, ciascuna col suo nome.
 * 1.0.41 — Anche in Multiplayer puoi usare un Effetto Veloce nel turno
 *   dell'avversario quando lui non fa nulla (Standby, inizio Battle Phase,
 *   fine turno): chi è di turno aspetta la tua decisione.
 * 1.0.40 — Sette carte ti lasciano scegliere davvero: Attacco a Doppia
 *   Punta, Lady Arpia Formazione della Fenice, Mago dell'Esplosione,
 *   Nobile dello Sterminio e Cappelli Magici scelgono i bersagli che vuoi
 *   tu; con Scuotiterra dichiari gli Attributi e l'avversario ne sceglie
 *   uno; con Bara Oscura è chi la subisce a decidere cosa perdere.
 * 1.0.39 — Gli Effetti Veloci si usano anche quando l'avversario non fa
 *   niente: nel suo turno, in Standby, all'inizio della Battle Phase e
 *   prima della fine del turno ti viene chiesto se vuoi attivarli (Ninja
 *   d'Assalto, Spada Sigillante di Orichalcos, Amuleto di Shabti). La Spada,
 *   cliccata nel tuo turno, ti fa scegliere quale abilità usare.
 * 1.0.38 — Oppressione Reale scoperta la può usare anche l'avversario di
 *   chi la controlla, pagando lui: "uno dei due giocatori", come da testo.
 * 1.0.37 — Le carte che proteggono dal "bersaglio" funzionano contro tutto:
 *   Signore dei D., Gran Scudo Gardna, Mago Comando del Caos e i Dei
 *   Egizi fermano anche Equip, Union e una trentina di effetti che prima
 *   li aggiravano. Great Dezard e Fushioh Richie annullano la Magia o
 *   Trappola che li bersaglia; più carte ti lasciano scegliere il bersaglio.
 * 1.0.36 — Necrovalley ferma davvero ogni carta che prova a lasciare il
 *   Cimitero. Un mostro rubato rimandato in mano torna al suo proprietario,
 *   e una rinascita col Terreno pieno non fa più sparire la carta.
 * 1.0.35 — Le scelte dentro una battaglia sono tue: la battaglia aspetta
 *   che tu decida. Armatura Guida d'Attacco, Fata Giglio, Assalitore dei
 *   Guardiani della Tomba, Don Zaloog, Quiz Inverso e Il Cacciatore dalle
 *   7 Armi non scelgono più da sole; Fuoco di Copertura, Spiritello dei
 *   Sogni, Spostamento e Scudo con Braccio Magico tornano a una scelta vera.
 * 1.0.34 — Lo scarto lo sceglie chi lo subisce: Criosfinge e Duo
 *   Delinquente non scartano più a caso al posto della vittima.
 * 1.0.33 — Chiuse tutte le 17 carte che si comportavano ancora diversamente
 *   dal testo: seconda Battle Phase (Bollettino Meteo), attacco a tutti i
 *   mostri (Sacerdote di Asura), risposte dalla mano (Sentinella, Amuleto di
 *   Shabti), Il Sigillo di Orichalcos completo, Necrovalley che nega anche
 *   le rianimazioni, Cancello di Fusione usabile da chi è di turno, e altre.
 *   Il bot ora usa gli attacchi extra dei suoi mostri.
 * 1.0.32 — Dieci carte allineate al testo con meccanismi generici:
 *   annulla effetti dei mostri distrutti in battaglia anche in difesa
 *   (Balter Oscuro, Lupo Bicefalo), bersaglio d'attacco obbligato (Anello
 *   Magnetico), Evocazione e attacco condizionati (Drago della Caverna),
 *   Guardian Eatos, Yado Karu, Messaggero della Pace, Fanciulla
 *   Indulgente, Thunder Nyan Nyan, Simorgh. Corretto un bug: i mostri
 *   "non Evocabili Normalmente" si potevano Evocare con un click diretto.
 * 1.0.31 — Quattro carte allineate al testo: Capo dei Guardiani della Tomba
 *   (solo 1 copia scoperta), Castello delle Illusioni Oscure (+200 al flip e
 *   a ogni Standby Phase per 4 volte), Cannone Drago XY/XYZ (scarta 1
 *   carta per distruggere una carta dell'avversario).
 * 1.0.30 — Multiplayer: mentre il server si sveglia, la riga di stato
 *   diventa un terminale KaibaCorp (titolo con glitch RGB, scanline,
 *   righe scritte a mano, barra senza fine). Sempre in pagina, mai modali.
 * 1.0.29 — Storia anime: le 31 scene non sono più monologhi di un solo
 *   personaggio ma conversazioni fra più voci, fedeli agli eventi della
 *   serie. Una riga di scena può ora essere una battuta { chi, testo }.
 * 1.0.28 — Battle City: oggetti (Radar potenziato rivela tutto il distretto,
 *   Scudo del Duel Disk para un evento negativo o un Blackout), evento
 *   Blackout (radar spento per 3 mosse) e Missione secondaria (batti un
 *   Duellante indicato: +2 Carta Locazione). Negozi ed eventi buoni danno
 *   oggetti.
 * 1.0.27 — Battle City: la legenda della mappa è ancorata in fondo allo
 *   schermo; ogni distretto ha UNA sola Carta Locazione da raccogliere (erano
 *   4), le altre si guadagnano coi duelli puntati.
 *
 * 1.0.26 — Multiplayer: tolti la console a finestra e lo stile "KaibaCorp
 *   System" (non piacevano); mentre il server si sveglia l'attesa è scritta
 *   in pagina, sotto i pulsanti, con frasi che cambiano e il tempo
 *   trascorso, senza modali. Colonne sonore numerate: mainTheme.mp3 è ora
 *   "56. Battle for the Millennium.mp3", il tema di Yugi
 *   "57. King of Games - Yugi's Final Duel.mp3" (riferimenti aggiornati).
 *
 * 1.0.25 — Contro Yugi Muto e Yami Yugi suona sempre "King of Games -
 *   Yugi's Final Duel", qualunque musica chieda l'URL, ma SOLO in Torneo e
 *   Storia (in Duello Libero resta la scelta del giocatore).
 *   characters-db.js ora si carica prima dell'audio.
 *
 * 1.0.24 — Multiplayer: ingresso "KaibaCorp System" (riga di sistema con
 *   orologio, titolo che si decodifica) e console di avvio a righe di
 *   terminale mentre ci si collega, con testo dinamico, barra e cronometro
 *   anche durante il risveglio del server gratuito.
 *
 * 1.0.23 — L'IA tiene conto dei bonus/malus di ATK e DEF (Terreno,
 *   Equipaggiamenti, effetti a tempo) quando sceglie chi attaccare, quali
 *   mostri sacrificare e come valutare il campo: prima usava i valori stampati.
 *
 * 1.0.22 — Tutte le foto hanno estensione .jpg (1162 .jpeg rinominati:
 *   carte e mappe) e il codice le nomina così; guardrail contro il ritorno
 *   di .jpeg e contro riferimenti a immagini inesistenti.
 *
 * 1.0.21 — Divieti di Evocazione corretti: L'Ultimo Guerriero (1045) blocca
 *   solo le Special Summon, Capro Espiatorio (434) vieta Evocazioni scoperte
 *   e Special Summon nel turno (il Set resta libero), 282 già a posto.
 *   "Velocità del bot" ora c'è anche nelle Impostazioni del menu.
 *
 * 1.0.20 — Ritaglio di Joey (joeyWheeler.png) sulla mappa di Battle City.
 *
 * 1.0.19 — La banda delle scelte (Tributo, scarto, casella) va a capo su
 *   telefono in verticale invece di uscire dallo schermo.
 *
 * 1.0.18 — Tolte dal catalogo della Storia anime le migrazioni dei
 *   salvataggi precedenti al timbro di base (ormai azzerati).
 *
 * 1.0.17 — Storia anime: un avanzamento scritto prima dei contatori a prove
 *   principali (campo `azzeraSeSenzaTimbro`) riparte da zero invece di
 *   essere migrato in un punto sbagliato; il premio già ritirato resta.
 *
 * 1.0.16 — Kaiba cambia aspetto per contesto: avatar del Regno dei Duellanti
 *   (torneo e Storia fino a fine Regno) e di Forbidden Memories (Torneo
 *   Kaiba e tappa del torneo in Memorie Proibite); altrove resta quello di
 *   sempre. Nuovo campo `avatar` sulle tappe e `ritratti` nelle scene.
 *
 * 1.0.15 — Velocità del bot (Normale/Veloce) nelle Impostazioni; scarto a
 *   fine turno e scelta della casella con lo stesso schema dei Tributi;
 *   Rare Hunter ritagliato sulla mappa di Battle City; il server
 *   Multiplayer rifiuta azioni fuori turno o malformate.
 *
 * 1.0.14 — PNG delle pedine ridimensionati (max 320 px): ~10 MB invece di
 *   ~100 MB; gli originali restano in images/characters/avatarTrasparenza/.
 *
 * 1.0.13 — Pedine di Battle City: i PNG dei Duellanti si chiamano come il
 *   file del loro avatar (dukeDevlin.png, non duke.png).
 *
 * 1.0.12 — Evocazione Tributo: ora si può annullare (pulsante Annulla o Esc)
 *   e la modalità è molto più evidente (banda grande, velo scuro, mostri
 *   sacrificabili illuminati). Il bot non attacca né avanza più mentre il
 *   giocatore ha un modale aperto (risposta con Trappola/Magia, scelte).
 *
 * 1.0.11 — 34 Duellanti con PNG trasparente nella cartella delle pedine,
 *   nominati con l'id del personaggio: compaiono in primo piano sulla mappa
 *   di Battle City (Rex e gli altri senza file usano la pedina standard).
 *
 * 1.0.10 — Se il PNG ritagliato di un Duellante non è nella cartella
 *   delle pedine, la mappa di Battle City usa da sola la pedina standard:
 *   niente più elenco da tenere aggiornato.
 *
 * 1.0.9 — Duellanti in città ritagliati senza sfondo solo dove il ritaglio
 *   è pulito (Rex, Mako, Espa Roba); gli altri restano pedina disegnata.
 *
 * 1.0.8 — Pedine di Battle City più ricche (silhouette, luci di bordo,
 *   animazioni idle) e basamento luminoso.
 *
 * 1.0.7 — Mappa di Battle City: le caselle sono pedine 3D al posto delle
 *   emoji, e le destinazioni raggiungibili sono evidenti — accese, con un
 *   percorso e una freccia dal segnalino, uniche ad avere l'etichetta;
 *   tutte le altre restano visibili ma attenuate.
 *
 * 1.0.6 — Nuova cinematica per ogni Evocazione Rituale, con materiali e
 *   sigillo in prospettiva prima della comparsa del mostro; Tornado di
 *   Polvere e Piumino delle Arpie hanno effetti di vento dedicati e
 *   sincronizzano la distruzione con l'impatto visivo.
 *
 * 1.0.5 — Uscendo da un duello concluso, la pagina della partita viene
 *   rimossa dalla cronologia: Indietro del browser o dell'app Android non
 *   puo' piu' riaprire il duello precedente.
 *
 * 1.0.4 — Lo Structure Deck Invincible Fortress ha una regressione
 *   completa su Exxod e Drago Megaroccia; le statistiche variabili non
 *   mostrano piu' il valore sentinella -1/-1, ma ?/? finche' il loro
 *   effetto non le determina.
 *
 * 1.0.3 — La cache PWA/WebView viene rinnovata insieme alla versione del
 *   gioco, così anche l'APK carica subito il revamp di Battle City e i
 *   relativi asset invece di conservare copie precedenti.
 *
 * 1.0.2 — Battle City si apre con un prologo dialogato sulla mappa della
 *   città e la fase urbana occupa tutto lo schermo sul fondale citta.jpg;
 *   la navigazione è un overlay leggero di segnali, non un pannello a griglia.
 *
 * 1.0.1 — L'autowin amministratore vale anche per tutti e tre i Tornei,
 *   mantenendo obbligatori sia l'interruttore locale sia i permessi admin;
 *   un torneo in corso si può inoltre abbandonare già dalla selezione.
 *   Nel Regno dei Duellanti bonus, malus e puntate aggiornano davvero il
 *   contatore della scalata, mostrato correttamente anche nella selezione;
 *   entrando nel Castello il sentiero dell'isola sparisce e gli sfidanti
 *   compaiono uno alla volta; quelli già battuti nel Castello restano sul
 *   tappeto rosso mentre il successivo appare più avanti. Una nuova
 *   scalata si apre con un prologo dialogato prima di mostrare la mappa.
 *
 * 1.0.0 — Prima release stabile. Le impostazioni grafiche, ologrammi,
 *   vibrazione, volume e mute di musica/SFX fanno parte del salvataggio:
 *   viaggiano con export/import e cloud, conservando le vecchie scelte.
 *
 * beta.80 — Configurazione del Duello Libero ripensata per arena, musica
 *   e difficoltà, più una morra cinese scenica e responsive anche sui
 *   telefoni in verticale e orizzontale.
 *
 * beta.79 — Catena più grande su desktop e targhette di nome/proprietario
 *   su un piano separato, non più coperte dalle carte in risoluzione.
 *
 * beta.78 — Nei duelli della Grande Guerra gli effetti sonori cercano
 *   prima la variante in audio/standard/ww1 e usano lo standard soltanto
 *   quando quella variante non esiste.
 *
 * beta.77 — Catena senza box e senza carte troncate, distruzione olografica
 *   per Magie/Trappole/Terreno e video di evocazione con priorità assoluta
 *   che sospendono il duello fino alla loro conclusione.
 *
 * beta.76 — I Duellanti parlano durante il duello con battute brevi legate
 *   a personalità e contesto; le evocazioni iconiche hanno frasi sempre
 *   presenti e i balloon compaiono accanto ai rispettivi avatar.
 *
 * beta.75 — Cinematiche di fusione e distruzione, audio delle evocazioni,
 *   ambienti di duello più vivi, stepper delle fasi e box delle Catene
 *   rinnovati, dialoghi della Storia più coinvolgenti e sbustamento del
 *   Negozio più leggibile e responsive.
 *
 * beta.74 — Un nodo della Storia senza campo/musica propri eredita
 *   quelli del suo CAPITOLO (stesse chiavi `field`/`music`), non solo
 *   quelli dell'intera campagna — utile per un capitolo che è un'intera
 *   area/macromappa: basta dichiararli una volta sola lì.
 *
 * beta.73 — Nuovo campo "Industria KaibaCorp" nel catalogo Arene.
 *
 * beta.72 — Ritratti veri per Noah Kaiba, Gozaburo Kaiba e i Big Five
 *   (Gansley, Johnson, Nesbitt, Crump, Lector): non c'era più bisogno
 *   del sigillo dorato di ripiego con l'icona del personaggio.
 *
 * beta.71 — I due comandanti della Grande Guerra hanno ora un vero
 *   ritratto storico (di pubblico dominio, Wikimedia Commons) al posto
 *   del monogramma segnaposto.
 *
 * beta.70 — L'Editor Mappa (amministratore) può ora impostare il campo di
 *   battaglia e la musica di un duello/scena della Storia direttamente
 *   sul nodo, e "📂 Collega file" li scrive anche sul vero
 *   story-campaigns.js, non solo nella scheda aperta.
 *
 * beta.69 — Nella Grande Guerra giochi nei panni di chi comandava davvero:
 *   Luigi Cadorna dall'Isonzo a Caporetto, Armando Diaz dal Piave alla
 *   vittoria. Tolti cinque campi di battaglia (Dirigibile di Kaiba,
 *   Dirigibile KaibaCorp II, Arena Kaiba 1 e 2, Castello di Pegasus).
 *
 * beta.68 — Battle City si comincia con 1 Carta Locazione. Nuove Sfide
 *   delle Storie: completa ogni storia a Normale, a Difficile e a tutti e
 *   tre i livelli — e le Sfide delle Storie avanzano davvero (prima la
 *   pagina della Storia non le registrava). Controllate tutte le 51
 *   Carte Equipaggiamento: tre Magie che scartano una carta (Flamberge
 *   del Male Infranto, Tributo ai Dannati, Vortice Fulmineo) non si
 *   possono più attivare con in mano solo se stesse, dove si sprecavano.
 *
 * beta.67 — Il menu della Storia rinnovato: ogni campagna con la sua
 *   mappa, il protagonista, l'avanzamento per livello e un "Inizia" /
 *   "Continua". Le tappe della Storia usano finalmente il loro campo di
 *   battaglia (la Grande Guerra di giorno e di notte, ma anche le altre:
 *   prima restava sempre quello di default). Nel Profilo, al posto del
 *   record del Duello Libero, le tue statistiche.
 *
 * beta.66 — Barra in alto rinnovata: medaglione d'oro per tornare
 *   indietro, l'icona della pagina in un rombo (prima non si vedeva
 *   affatto), titolo nello stesso stile del logo, filo d'oro con un
 *   rombo al centro e un'ombra che si stacca quando scorri. I mazzi del
 *   Negozio chiedono più Stelle e più Carte Locazione / del Millennio.
 *
 * beta.65 — Le Sfide aperte dal menu mostrano finalmente le missioni di
 *   Oggi e della Settimana e la sezione Storie (erano rimaste alla
 *   versione vecchia), ed entrare nel Profilo non chiede più quale
 *   salvataggio tenere: se ne occupa l'accesso, tenendo il più recente.
 *
 * beta.64 — Logo nuovo: il Puzzle del Millennio d'oro con l'Occhio di
 *   Wedjat dentro due anelli di geroglifici, e la scritta DUEL ARENA con
 *   un riflesso di luce. All'apertura si compone davanti a chi guarda —
 *   gli anelli si tracciano, la piramide si riempie, l'Occhio si apre in
 *   un lampo e i raggi si accendono — e lo stesso logo è ora nel menu.
 *
 * beta.63 — La Storia si gioca a tre livelli: Facile all'inizio, poi
 *   Normale e Difficile una volta finita (con un premio finale più ricco);
 *   la Grande Guerra resta com'è. Nel Mondo dei Ricordi il Faraone
 *   affronta finalmente Bakura — il Re dei Ladri, il sacrificio di Mahad,
 *   il Gioco delle Ombre — e il Duello Cerimoniale lo gioca Yugi.
 *
 * beta.62 — Mappe della Storia al loro posto anche sui monitor grandi,
 *   scene di un'area sul disegno della loro mappa (Croquet parla negli
 *   interni del castello), rileggere una scena non salta più le tappe,
 *   ologrammi su desktop più piccoli e ancorati alla propria carta, e
 *   niente più riquadro scuro dietro "Continua" a fine duello.
 *
 * beta.61 — Il Castello di Pegasus è la seconda mappa del Regno dei
 *   Duellanti, non più un'isola a parte: battuto Kaiba sulla scalinata si
 *   varca il portone e si passa agli interni, con un cartello d'arrivo e
 *   un passaggio per tornare sull'isola quando si vuole.
 *
 * beta.60 — Battuto Kaiba al cancello, si entra nel Castello di Pegasus:
 *   un'area nuova con la mappa degli interni, la semifinale con Mai
 *   nell'arena e Pegasus nella sala del trono. Battle City (prima e
 *   seconda parte) e il Mondo Virtuale hanno i duelli sui luoghi veri
 *   delle loro mappe.
 *
 * beta.59 — La Storia di Yugi comincia dove deve: un prologo a Domino
 *   City con la sua mappa (il negozio del nonno, la scuola, e il primo
 *   duello contro Kaiba in cima alla KaibaCorp), una mappa grande a sei
 *   isole, il Regno dei Duellanti con i duelli sulle arene vere dell'isola,
 *   Freedom su una nuova mappa della valle del Nilo, e le battaglie
 *   notturne della Grande Guerra su un campo di notte. I progressi già
 *   fatti restano dove sono.
 *
 * beta.58 — 25 arene nuove fra cui scegliere (Regno dei Duellanti,
 *   Castello di Pegasus, Stadio Kaiba, Dirigibile, Torre dei Duelli,
 *   Mondo Virtuale, l'Antico Egitto e altre), i duelli della Grande Guerra
 *   su un vero campo di battaglia, e le cinque aree della Storia con la
 *   loro mappa disegnata.
 *
 * beta.57 — I mazzi dei Duellanti rifatti da capo, tre per personaggio e
 *   scritti a mano: fedeli al mazzo vero dell'anime o del gioco (Joey
 *   senza le carte di Yugi, Kaiba con i cannoni X/Y/Z da Normale in su,
 *   Noah con i Mostri Spirito, i Maghi di Forbidden Memories con il mazzo
 *   del loro terreno), e un Facile davvero facile: mostri deboli in
 *   prevalenza, pochi mostri da Tributo, al massimo una carta che
 *   distrugge mostri, Spada Rivelatrice e carte difensive. I mazzi della
 *   Grande Guerra restano com'erano. Sviluppato su branch.
 *
 * beta.56 — Nel Negozio, una carta della rotazione giornaliera sparisce
 *   dalla vetrina appena la compri (prima si poteva ricomprare più volte
 *   nello stesso giorno, finché bastavano i crediti) — torna in vendita
 *   solo con la rotazione nuova, a mezzanotte. Il numero di copie
 *   possedute era già mostrato per ogni carta, verificato dal vivo.
 *
 * beta.55 — Il mazzo Facile è DAVVERO più debole ora: la versione
 *   precedente rispettava ogni regola scritta ma si fermava a un tetto
 *   fisso di scambi, lasciando i mostri deboli una minoranza marginale in
 *   mazzi come quello di Kaiba (quasi tutti Draghi forti) — segnalato
 *   dall'utente rileggendo il risultato vero. Ora il mazzo continua a
 *   indebolirsi finché i mostri deboli non sono davvero la maggioranza, e
 *   quando il pool del personaggio non basta pesca un mostro debole A
 *   TEMA (stessa razza/attributo prevalenti, stessa provenienza) dall'
 *   intero database delle carte invece di ripiegare subito su un
 *   riempitivo generico. Sviluppato su branch, non ancora sul gioco
 *   pubblicato.
 *
 * beta.54 — Creazione Deck mostra anche il mazzo Facile di ogni
 *   Duellante (prima solo Normale/Difficile) — consultabile come gli
 *   altri due, mai clonabile in blocco.
 *
 * beta.53 — Nuovo livello "Facile" in Duello Libero e nei Tornei: stessa
 *   IA di Normale, ma con un mazzo avversario molto più debole (mostri
 *   deboli prevalenti, niente ATK 1800/1900, Nega Attacco al posto di
 *   Forza dello Specchio) — richiesto perché i mazzi base restavano
 *   troppo forti per chi inizia a giocare. Normale riceve anche lui un
 *   piccolo assaggio in più (Spada Rivelatrice). Sviluppato su branch,
 *   non ancora sul gioco pubblicato.
 *
 * beta.52 — Il bot non Evoca più un mostro per poi distruggerselo da
 *   solo con Buco Nero: gli effetti "distruggi tutti i mostri" che
 *   colpiscono anche il proprio Terreno (a differenza di Raigeki) ora
 *   pesano il costo, e quando conviene davvero partono PRIMA
 *   dell'Evocazione del turno, non dopo.
 *
 * beta.51 — Fra due salvataggi non si chiede più MAI quale tenere:
 *   decide sempre la data, in ogni caso (anche a un minuto di distanza,
 *   anche con una data illeggibile). Il Profilo aveva una copia tutta
 *   sua di questo controllo, mai collegata alla regola vera: chiedeva
 *   sempre, a ogni salvataggio cloud trovato — ora usa la stessa regola
 *   del gate.
 *
 * beta.50 — Editor Mappa nella Storia: un amministratore può ora
 *   spostare, modificare, cancellare e creare i nodi di una campagna
 *   direttamente sullo schermo (trascinamento incluso), con un
 *   pulsante per esportare il codice pronto da incollare in
 *   story-campaigns.js. Spento di default, si accende dal Pannello
 *   Admin. Nessun salvataggio automatico sui contenuti: questo gioco
 *   non ha un backend per loro, solo per account e progressi.
 *
 * beta.49 — I 5 nodi della mappa grande della Storia dell'anime (Regno
 *   dei Duellanti, Battle City I/II, Mondo Virtuale, Mondo dei Ricordi)
 *   sono ora esattamente al centro dell'arena della propria isola — la
 *   mappa era stata rifatta con 5 isole nuove ma le coordinate dei nodi
 *   erano rimaste quelle del vecchio disegno a 7, e cadevano fra un'isola
 *   e l'altra invece che sopra.
 *
 * beta.48 — Gli Starter e gli Structure Deck costano di più, e sempre di
 *   più a ogni acquisto dello stesso tipo — anche nelle Carte Locazione/
 *   del Millennio richieste dal secondo in poi. Una vittoria al Regno dei
 *   Duellanti resta abbastanza per il primo Starter Deck. La regola
 *   scritta nel Negozio non riportava più il numero vero di carte
 *   speciali richieste: ora lo legge dal catalogo invece di ripeterlo a
 *   mano.
 *
 * beta.47 — Le Sfide sono una griglia di riquadri, non più un elenco a
 *   righe: icona con anello di progresso, nome e conteggio, e al tocco
 *   un pannello con descrizione e ricompensa. Con una sessantina di
 *   Sfide la vecchia lista era alta undici-quindici schermate.
 *
 * beta.46 — La Storia dell'anime torna a seguire SOLO il percorso vero
 *   della prima serie: cinque aree, non più sette — Il Regno dei
 *   Duellanti (con dentro il prologo del Puzzle), Battle City Parte 1,
 *   Il Mondo Virtuale (Noah, i Big Five e Gozaburo), Battle City Parte 2
 *   e il viaggio nel passato per la battaglia finale. Il Risveglio dei
 *   Draghi e il Gran Premio KC restano fuori, e i loro otto duellanti
 *   sono usciti dal roster di Duello Libero.
 *
 * beta.45 — La storia dell'anime è una mappa di mappe: sette isole, una
 *   per arco della serie, e ognuna si apre sul proprio percorso. Con le
 *   tre parti che mancavano — il Mondo Virtuale, Il Risveglio dei Draghi
 *   e il Gran Premio KC — e i loro otto duellanti, da Noah a Dartz.
 *
 * beta.44 — L'apertura delle bustine è rifatta: una carta alla volta,
 *   grande al centro, con il mazzetto che cala e la fila in basso che si
 *   riempie — e non scorre più niente. L'acquisto di un mazzo mostra la
 *   scatola vera del mazzo che si apre. A fine duello sparisce la barra
 *   di scorrimento, e mentre gira un filmato di Evocazione il duello sta
 *   davvero fermo.
 *
 * beta.43 — Le carte si vedono muovere: quando vanno al Cimitero e
 *   quando ne risalgono, e quando un mostro rubato torna al suo
 *   proprietario. Le bustine si aprono davvero — la bustina si strappa e
 *   le carte si girano una alla volta, con un momento tutto suo per
 *   l'ultra rara — e comprare una carta o un mazzo non è più solo un
 *   numero che cambia. La schermata di fine duello, su telefono girato,
 *   passa a due colonne: si leggono cinque ricompense invece di due.
 *
 * beta.42 — Il salvataggio non aspetta più che tu esca: arriva sul cloud
 *   mentre giochi, e quando rientri vince sempre il più recente invece di
 *   chiedertelo mostrando una data sola. Dal Profilo si può ricominciare
 *   da capo, azzerando il progresso senza perdere l'account. L'orologio
 *   del Negozio funziona davvero (prima dava sempre errore), e un
 *   amministratore ha il portafoglio pieno per provare le cose.
 *
 * beta.41 — In Duello Libero i Duellanti si guadagnano: si parte con
 *   Yugi Muto e suo nonno Solomon, e gli altri si sbloccano battendoli
 *   per la prima volta in un Torneo o nella Modalità Storia.
 *
 * beta.40 — L'autowin nelle Storie non è più acceso per tutti: è un
 *   interruttore del Pannello Admin, spento di default. Un giocatore
 *   normale duella sul serio anche se la scorciatoia è ancora nel gioco.
 *
 * beta.39 — Il pulsante "Continua" a fine duello torna visibile: era
 *   coperto dalla sua stessa fascia sfumata. E quando le ricompense non
 *   ci stanno tutte, ora la schermata lo dice invece di sembrare finita.
 *
 * beta.38 — Gli ologrammi si leggono: il soggetto resta nitido al centro
 *   e si dissolve verso i bordi, invece di essere slavato allo stesso
 *   modo dappertutto.
 *
 * beta.37 — Le Sfide diventano quattro sezioni: le missioni di OGGI
 *   (tre, nuove ogni giorno), quelle della SETTIMANA (dieci), le Sfide di
 *   sempre e una sezione per ogni Storia. Le missioni ruotano con
 *   l'orario del server come le carte del Negozio, e il loro progresso
 *   scade col periodo. I mazzi chiedono ora anche più carte speciali man
 *   mano che se ne comprano, non più una sola per sempre.
 *
 * beta.36 — Nel Regno dei Duellanti il Castello di Pegasus ha la sua
 *   mappa: dal Cancello in poi il bosco lascia il posto alle sale. E le
 *   Stelle di quel torneo sono SUE — si parte sempre da zero, anche col
 *   portafoglio pieno, mentre ogni Stella vinta resta comunque al
 *   giocatore. Nel presente di Memorie Proibite si duella come Yugi Muto
 *   e non come Atem, torneo compreso. La schermata di fine duello si
 *   scorre da qualunque punto, col pulsante "Continua" appiccicato in
 *   fondo. I mazzi Starter e Structure costano di più e rincarano più in
 *   fretta.
 *
 * beta.35 — Il campo inclinato di beta.34 è stato tolto su richiesta.
 *   Restano tre cose nuove: con l'ologramma acceso il mostro scoperto
 *   lascia nella carta un PORTALE nero al posto dell'illustrazione, da
 *   cui la proiezione esce; su schermo largo o in orizzontale la pila
 *   della Catena si sposta a sinistra, a metà altezza, invece di stare in
 *   alto al centro; e una carta già sul Terreno si illumina per un secondo
 *   quando è lei ad attivarsi, così si vede QUALE delle cinque coperte si
 *   è appena scoperta. Le carte della Grande Guerra dicono anche lo
 *   schieramento nella riga del tipo: [Aviazione · Italiana].
 *
 * beta.34 — Due scelte nuove in Impostazioni. "Campo inclinato" fa
 *   vedere il Terreno in prospettiva, come seduti a un vero tavolo da
 *   duello, invece che dall'alto — spenta di default, perche' cambia come
 *   si legge tutto il campo. E la proiezione sopra i mostri si vede
 *   finalmente anche su un monitor: c'era gia', ma era misurata sulla
 *   carta, e su desktop la carta e' piccola rispetto allo schermo.
 *
 * beta.33 — Anche gli ultimi tredici personaggi di Memorie Proibite
 *   hanno la loro faccia: i cinque Maghi delle terre, i cinque Alti
 *   Maghi, il Mago del Labirinto, Sebek e Neku, coi ritratti del gioco
 *   originale al posto del monogramma. Da qui nessun duellante della
 *   Storia è più un cerchio vuoto.
 *
 * beta.32 — Il torneo di Memorie Proibite è quello del gioco PS1: quattro
 *   preliminari (Rex, Weevil, Mai, Bandit Keith) e cinque finali, dove
 *   ognuno porta un Oggetto del Millennio — Shadi la Chiave, Yami Bakura
 *   l'Anello, Pegasus l'Occhio, Isis la Collana, Kaiba lo Scettro — e
 *   dopo Kaiba c'è una scena che dice cos'era davvero quella notte.
 *   E nelle scene il protagonista ha finalmente la sua faccia e il suo
 *   nome, invece di un cerchio vuoto col sigillo.
 *
 * beta.31 — Le tappe di sola storia hanno il respiro di una scena:
 *   tutte e trentatré, in tutte e quattro le campagne, passano da due o
 *   tre battute a quattro o cinque. Non riempitivo — quello che prima
 *   restava fuori: perché Simon chiude il principe nel Puzzle proprio
 *   così, cosa Kaiba stia davvero cercando a Domino, quante divisioni
 *   Conrad abbia tolto al fronte russo per la Strafexpedition.
 *   Sull'elenco delle storie non restano più appesi in fondo i pulsanti
 *   della mappa, e sulla Grande Guerra dodici tappe si spostano dove
 *   stanno davvero: la Bainsizza sull'altopiano e non in pianura, il
 *   Montello sul Montello, Gorizia a Gorizia, la Valsugana in Valsugana.
 *   E il torneo di Kaiba, in Memorie Proibite, si può rifare: il nodo
 *   resta aperto anche dopo averlo vinto, il tabellone riparte dal primo
 *   incontro e rivincerlo non fa avanzare la storia una seconda volta.
 *   In una campagna non si duella più come sé stessi: sei Yami Yugi nel
 *   Regno delle Ombre, Atem in Memorie Proibite, Giacobbo in Freedom, e
 *   nella Grande Guerra non sei nessuno in particolare — sei il Regio
 *   Esercito, con la bandiera al posto della faccia. I sei comandanti
 *   austro-ungarici hanno la loro fotografia d'epoca al posto del
 *   monogramma. E la schermata di fine duello regge anche con dieci
 *   ricompense: l'elenco scorre, il pulsante "Continua" non esce più
 *   dallo schermo.
 *
 * beta.30 — La Grande Guerra ha la sua mappa disegnata del fronte
 *   italiano, e le tappe sono posate sui luoghi veri: l'Isonzo
 *   sull'Isonzo, la Strafexpedition sugli Altipiani, Caporetto a
 *   Caporetto, il Solstizio lungo il Piave, l'ultima offensiva dal
 *   Grappa a Trieste. Sei capitoli nell'ordine in cui le cose
 *   successero davvero — Gorizia e la Bainsizza non sono più una nota a
 *   margine — e prima di ogni duello si parla con chi si ha davanti.
 *   Sotto suona "Alba sul Montello", e nei duelli "La carica del Piave".
 *
 * beta.29 — Memorie Proibite: nel presente c'è il TORNEO della Kaiba
 *   Corporation, una tappa che dentro ha il proprio tabellone su una
 *   mappa sua — cinque incontri fino a Kaiba, e chi perde ricomincia dal
 *   primo, come nel gioco originale. E prima di ognuno dei ventinove
 *   duelli della campagna si parla con l'avversario che si ha davanti.
 *
 * beta.28 — Le tappe di Memorie Proibite sono posate sui LUOGHI VERI
 *   della sua mappa: il palazzo dove c'è il palazzo, i cinque Maghi
 *   ognuno sulla propria terra (mare, montagne, bosco, deserto, prati),
 *   il labirinto sotto la città e gli ultimi due capitoli su per la
 *   fortezza oscura. Il percorso smette di essere una serpentina
 *   appoggiata sopra un disegno e diventa un viaggio dentro quel disegno.
 *
 * beta.27 — La campagna Freedom ha la sua mappa disegnata
 *   (images/maps/storia_freedom_1.jpg): una mappa vera si stende intera
 *   sul mondo invece di essere piastrellata come le texture prese in
 *   prestito, e il mondo di quella campagna è stato riportato alle
 *   proporzioni dell'arte. Le altre quattro campagne aspettano la loro
 *   con il nome già pronto.
 *
 * beta.26 — Storia: finito un duello si resta nella campagna invece di
 *   essere rispediti all'elenco; le tappe già superate si possono
 *   rigiocare (senza far avanzare la storia, che si sblocca solo
 *   giocando la tappa nuova); "Ricomincia" chiede conferma dicendo
 *   quante tappe si perdono.
 *
 * beta.25 — Rimpicciolendo, la mappa della Storia non mostra mai zone
 *   vuote: lo zoom si ferma dove smetterebbe di riempire lo schermo, e
 *   si rialza da solo ruotando il telefono. In orizzontale anche le
 *   informazioni sulla campagna si possono chiudere (lì manca l'altezza,
 *   non la larghezza).
 *
 * beta.24 — La mappa della Storia si ingrandisce e si rimpicciolisce
 *   (pulsanti, Ctrl+rotellina, pizzico a due dita) e si prende tutta
 *   l'altezza dello schermo; su telefono le informazioni sulla campagna
 *   partono chiuse dietro una riga di riassunto, e la scelta si ricorda.
 *   Con l'autowin di prova la morra cinese non compare più.
 *
 * beta.23 — Modalità Storia molto più viva: le scene sono intermezzi a
 *   dialoghi (luogo sullo sfondo, ritratto di chi parla, testo che si
 *   scrive una battuta alla volta, polvere dorata con i Dettagli video su
 *   "Alti"), un cartello annuncia ogni capitolo nuovo, la mappa anima il
 *   tratto verso la tappa viva e ci si posa sopra invece di saltarci, e
 *   una scena già vista si può rileggere. Più diciannove ritratti
 *   PROVVISORI per i personaggi che non ne avevano ancora uno.
 *   ⚠️ In questa versione i duelli della Storia si vincono da soli
 *   (autowin di prova, richiesto per collaudarla): vedi
 *   js/dev/test-shortcuts.js.
 *
 * beta.22 — I menu non scorrono più di lato (era la stella del logo, che
 *   pulsando si allargava oltre il bordo dello schermo); Modalità Storia:
 *   ogni capitolo dice di cosa parla, e il capitolo dei Cinque Maghi
 *   Guerrieri non è più dieci duelli di fila senza una parola in mezzo —
 *   cinque terre, ognuna aperta dalla voce del mago che la custodisce.
 *
 * beta.21 — Lo stiramento elastico a fine scorrimento se ne va davvero
 *   anche dentro l'APK (serviva una modifica NATIVA, la CSS da sola non
 *   poteva bastare — vedi MainActivity.java nel progetto Android); la
 *   campagna Grande Guerra si presenta raccontando il fronte italiano
 *   invece del set di carte.
 *
 * beta.20 — Modalità Storia (storia.html): 4 campagne giocabili (Il
 *   Regno delle Ombre, Memorie Proibite, Freedom, Grande Guerra) su
 *   mappa a nodi condivisa; carte ammesse per campagna con il nuovo
 *   campo `fazione` sul set WW1; Sfide da 14 a 66 con cinque modi nuovi
 *   di guadagnarle; Oggetti del Millennio come premio dei tornei; ogni
 *   torneo paga solo la propria valuta; niente più stiramento elastico
 *   a fine scroll su nessuna pagina.
 */
window.GAME_VERSION = '1.4.107';
