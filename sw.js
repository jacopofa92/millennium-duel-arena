/**
 * sw.js — Service Worker di Yu-Gi-Oh! Duel Arena (PWA).
 * =====================================================================
 * Percorsi tutti RELATIVI (mai assoluti "/…"): GitHub Pages serve questo
 * progetto sotto un sottopercorso (https://<utente>.github.io/<repo>/),
 * non alla radice del dominio — un percorso assoluto punterebbe fuori
 * dal sito. Lo stesso vale per manifest.json e per ogni <script src>/
 * <link href> nelle pagine HTML: NON aggiungere mai uno "/" iniziale.
 *
 * Strategia in due parti, diverse per tipo di file:
 *   - APP SHELL (HTML/CSS/JS, ~8,3 MB non compressi al 2026-10-06):
 *     "network-first" — prova
 *     sempre la rete per avere subito l'ultima versione pubblicata (utile
 *     visto lo sviluppo continuo del progetto), e ripiega sulla cache
 *     SOLO se offline. Così un aggiornamento pubblicato arriva sempre al
 *     prossimo avvio online, senza bisogno di incrementare a mano un
 *     numero di versione della cache per invalidarla (un errore classico
 *     nei Service Worker: dimenticarsi di farlo lascia gli utenti
 *     bloccati su una versione vecchia per sempre).
 *   - MEDIA (immagini/audio, centinaia di MB in tutto — troppi per
 *     precaricarli tutti in un colpo solo): "cache-first" — una volta
 *     scaricato un file la prima volta, resta in cache e non viene
 *     rifatto scaricare, ed è disponibile offline da quel momento in poi.
 *     Il gioco resta giocabile offline PIENAMENTE solo per le carte/i
 *     suoni già incontrati almeno una volta online — limite dichiarato,
 *     non finto: precaricare 114MB di immagini + 259MB di audio al primo
 *     avvio sarebbe un'esperienza pessima, specie da rete mobile.
 */

// v2: riorganizzazione di js/ in sottocartelle per contesto (motore, dati,
// IA, audio, UI, multiplayer, cloud) — bump necessario per svuotare le
// vecchie voci di cache ai vecchi percorsi piatti, altrimenti restano
// orfane in cache invece di essere ripulite da activate() qui sotto.
// v3: nuova icona dell'app (le icone sono MEDIA, non app shell — cache-
// first, vedi sopra — quindi senza questo bump chi le aveva già scaricate
// non vedrebbe mai la nuova finché non svuota la cache a mano).
// v4: pagina Sfide (sfide.html) + i suoi file nuovi (challenges-db.js,
// challenge-tracker.js, challenge-banner.js/.css).
// v5: pagina Torneo "Regno dei Duellanti" (torneo-regno-duellanti.html) +
// i file js/native/*.js aggiunti per l'APK Android (no-op sul web, ma
// caricati da quasi ogni pagina) + js/ui/error-recovery.js/js/version.js.
// v6: backgroundMainMenu.png/backgroundMenu.png (MEDIA, cache-first)
// convertiti in .jpg per alleggerirli (~85% più leggeri, stessa qualità
// visiva) — bump per svuotare le vecchie voci .png orfane in cache, mai
// più referenziate da nessuna pagina.
// v7: images/fields/*.jpg ripristinate alla qualità originale (su
// richiesta esplicita: niente compressione del Terreno su desktop) e
// nuova cartella images/fields/mobile/ con le versioni compresse per
// schermi touch — bump NECESSARIO (non solo igiene): senza, chi aveva
// già in cache le v6 (compresse, allo STESSO percorso) continuerebbe a
// vedersele servite dalla cache-first anche su desktop, ignorando il
// ripristino appena fatto.
// v8: nuova schermata di caricamento condivisa ad ogni cambio pagina
// (js/ui/page-loader.js/.css, sostituisce il vecchio #preIntroCover
// statico di duelMonstersCore.html) — file nuovi da aggiungere all'app
// shell.
// v9: accesso con approvazione admin OBBLIGATORIO per giocare (replica
// del meccanismo del progetto Fioxify) — js/cloud/auth-gate.js nuovo,
// admin.html nuova pagina. Aggiunta anche duello-sandbox.html, mancante
// dall'app shell da prima di questa sessione (gap preesistente, corretto
// qui insieme al resto visto che questo file andava comunque toccato).
// v16: sei pagine menu fuse in index.html come viste SPA (Sfide, Tornei,
// Negozio, Impostazioni, Regole, Cartoteca). Nessun file nuovo da
// aggiungere — quelli che le viste caricano alla prima apertura
// (cards-data.generated.js, duel-engine.js, card-effects.js,
// card-renderer.js, challenges-db.js...) erano già tutti nell'app shell
// perché usati dalle pagine autonome, quindi la fusione funziona anche
// offline. Il bump serve solo a far ripopolare la cache con il nuovo
// index.html, cresciuto di parecchio.
// v17: js/ui/fx-gsap.js, backend di animazione opzionale per il duello.
// v18: pagina Torneo "Battle City" (torneo-battle-city.html).
// v19: pagina Torneo "Kaiba" (torneo-kaiba.html).
// v20: economia + Negozio — js/data/card-rarity.js, js/cloud/server-date.js,
// js/economy/* (rewards, shop-catalog, shop-ui e i due CSS).
// v21: componenti condivisi estratti per il Negozio — js/ui/deck-box.*
// (la scatola 3D, prima dentro creazione-deck.html) e js/ui/card-detail.*
// (la scheda di una carta, prima duplicata in Cartoteca e Creazione Deck).
// v22: Multiplayer online — la lobby punta al server pubblico (vedi
// render.yaml), e js/multiplayer/network.js insiste alla prima
// connessione mentre quel server si risveglia.
// v23: Sala d'Attesa del Multiplayer — js/ui/mp-lobby.css e
// js/data/arena-options.js (catalogo di arene e colonne sonore).
// v24: selettore condiviso di mazzo/arena/musica (js/ui/duel-setup.*),
// usato dalla Sala d'Attesa e ora anche dal Duello Libero.
// v25: le "Carte ammesse" entrano nello stesso selettore, quindi anche in
// Multiplayer, dove viaggiano all'avversario come regola del duello.
// v26: la Sala d'Attesa torna nella tavolozza del gioco (oro su pietra
// egizia), col ciano ridotto alla sola voce del sistema.
// v27: ritratto e mazzo corrente nella barra in alto del Duello Libero,
// con il selettore a scorrimento (js/ui/deck-switcher.*).
// v28: ritratto in ogni barra (mazzo solo dove si duella), e pulsanti
// arrotondati come il resto del gioco al posto degli spigoli tagliati.
// v29: via l'evidenziazione azzurrina del browser al tocco su ogni
// pagina, con lo stato premuto dei pulsanti a farne le veci.
// v30: il controllo sulle carte ammesse ora avviene PRIMA di entrare
// nell'arena (js/data/deck-legality.js + card-origins.generated.js).
// v31: mazzi mostrati come scatole 3D anche nel Profilo, interruttore
// della vibrazione in Impostazioni, e niente rimbalzo elastico ai bordi
// della pagina su telefono.
// v32: schermata Tornei rifatta (arte dell'arena, avanzamento, mazzo in
// barra), nessun premio per un duello abbandonato, interruttori Musica/
// Effetti che dicono "attivo" invece di "muto", e la nuova impostazione
// Dettagli video (js/ui/video-quality.js).
// v33: raffiche di sabbia nelle arene egizie con i Dettagli video su
// "Alti" (js/ui/field-ambience.*), il primo effetto di quel livello.
// v34: folate vere (a ondate) invece di un velo trascinato, più due
// ambienti nuovi — vento d'alta quota sul Dirigibile di Kaiba e campo
// olografico nelle Arene Kaiba.
// v35: nuova arena "Castello di Pegasus" (usata dai duelli dentro il
// Castello nel Regno dei Duellanti) e nuova immagine del Dirigibile di
// Kaiba, entrambe con la loro variante in images/fields/mobile/.
// v36: folate di sabbia e vento più marcate, con la grana della sabbia
// disegnata su canvas invece che con gradienti ripetuti (a piena
// intensità i granelli si leggevano come una griglia).
// v37: intermezzi narrativi nei tre tornei (js/ui/story-cutscene.* +
// js/data/tournament-dialogues.js): dialoghi in carattere ai passaggi di
// fase — dirigibile, Torre Kaiba, Castello di Pegasus, finali.
// v38: gli intermezzi non sono più su fondo nero — ogni scena mostra il
// LUOGO in cui si svolge (dirigibile, Castello, arena KaibaCorp).
// v39: il bot non gioca più sotto a un filmato di Evocazione, Kaiba ha
// sempre il suo tema di duello in ogni torneo, i dialoghi raccontano il
// tabellone vero (altra semifinale, avversario in finale) e dal Regno dei
// Duellanti si può rigiocare senza passare da "Abbandona".
// v40: il duello in Multiplayer riceve davvero il CSS e tutti gli
// elementi dell'arena; il primo avvio passa dal negozio del nonno
// (js/ui/onboarding.*); e in sala d'attesa si parte solo quando entrambi
// premono "Pronto", con conto alla rovescia e morra cinese fra i due.
// v41: la sala d'attesa del Multiplayer si accorge se l'avversario se ne
// va — prima restava a mostrarlo "Pronto" e si poteva far partire un
// duello contro nessuno — e uscire dalla pagina libera il posto subito
// invece di tenerlo occupato per i 45 secondi di grazia del server.
// v42: in Multiplayer un Tributo fa ora scattare gli stessi avvisi del
// motore su tutti e due i client, il sacrificio pagato per attaccare non
// disallinea più i due lati, e il Castello dell'Ingranaggio Antico
// sacrificato viaggia finalmente sulla rete.
// v43: in Multiplayer l'attivazione di una carta viene annunciata PRIMA
// della finestra di risposta (prima ogni Magia restava ferma 30 secondi e
// poi rimbalzava fra i due client), le Magie giocate dalla mano arrivano
// davvero all'avversario, e Special Summon dalla mano / Evocazione
// dall'Extra Deck / scarto per il limite di mano non lasciano più i due
// lati con due partite diverse.
// v44: in Multiplayer la carta dell'avversario non si risolve più "come
// se fosse mia" (il campo owner del messaggio ribaltava il proprietario
// dell'effetto), e la scelta del bersaglio viaggia invece di essere
// indovinata dalla copia che gira dall'altra parte.
// v45: il contesto di un effetto non è più sovrascrivibile dai dati del
// momento, e le prime dieci carte che promettevano una scelta al
// giocatore (Richiamo della Mummia, Cambio di Cuore, Controllo Mentale…)
// ora gliela fanno davvero fare invece di decidere da sole.
// v46: ologrammi in finto 3D sopra i mostri scoperti
// (js/ui/monster-hologram.*), stile Master Duel, con i Dettagli video su
// "Alti" — generici per tutte le carte, e fuori dal Terreno perché questo
// viene ricostruito da zero circa una volta al secondo.
// v47: gli ologrammi hanno un'impostazione tutta loro, "Visualizzazione
// ologramma" (js/ui/hologram-setting.js), accesa di default e accanto ai
// Dettagli video nelle Impostazioni.
// v48: aggiunto js/engine/duel-sandbox.js, che mancava dall'app shell
// pur essendo caricato da duelMonstersCore.html — chi aveva già la v47
// in cache deve riscaricare, o offline resterebbe con la lista vecchia.
// (v49-v54: bump fatti senza lasciare una nota qui. Non li ricostruisco a
// posteriori inventandomeli: sono stati incrementi di routine per far
// ripopolare la cache dopo modifiche a file già presenti nell'app shell,
// non aggiunte di file nuovi. Da qui in avanti la nota si scrive.)
// v55: i menu non scorrono più in orizzontale — la stella del logo
// (`.menu-logo-eyecatch`, index.html) pulsando allargava la propria
// scatola oltre il bordo dello schermo.
// v56: Modalità Storia arricchita — descrizione per ogni capitolo e
// cinque scene nuove nel capitolo dei Cinque Maghi Guerrieri. Nessun file
// nuovo: cambiano solo storia.html, js/data/story-campaigns.js e
// js/story/story-progress.js, già tutti nell'app shell.
// v57: le scene della Storia diventano intermezzi a dialoghi (storia.html
// carica ora js/ui/story-cutscene.* e js/ui/video-quality.js, già
// nell'app shell perché usati da index.html e dai tornei), e arrivano
// diciannove ritratti PROVVISORI in images/characters/. Quelli sono
// MEDIA, quindi cache-first: il bump serve perché chi aveva già in cache
// un 404 a quei percorsi non se lo porti dietro.
// v58: zoom sulla mappa a nodi (js/ui/node-map.*), mappa alta quanto lo
// schermo e informazioni sulla campagna pieghevoli su telefono
// (storia.html). Nessun file nuovo.
// v59: lo zoom non scende più sotto il punto in cui la mappa smette di
// riempire lo schermo, e si riadatta alla rotazione. Nessun file nuovo.
// v60: Storia — ritorno alla mappa della campagna a fine duello, tappe
// rigiocabili, conferma prima di ricominciare. Nessun file nuovo.
// v105: nuove immagini per 9 campi esistenti (anticoEgittoPiazzaGiorno/
// Notte, anticoEgittoTempio/Oscuro, arenaAnticoEgittoGiorno/Notte,
// torreDeiDuelli/Colosseo/Shadow) e 3 campi nuovi aggiunti al catalogo
// (campoAcquatico, campoForesta, campoMontagna — js/data/arena-options.js).
// v104: seconda versione dell'immagine del campo Mondo Virtuale - Arena
// di Gozaburo (l'utente l'ha ricambiata, stesso nome di file).
// v103: nuova immagine del campo Mondo Virtuale - Arena di Gozaburo
// (stesso nome di file).
// v102: nuova immagine del campo Dirigibile KaibaCorp (stesso nome di
// file). Le immagini sono cache-first: senza questo bump chi l'aveva già
// in cache continuerebbe a vedere la vecchia.
// v111: revamp della mappa di Battle City e bump esplicito della cache
// PWA/WebView, così l'APK non conserva il vecchio citta.jpg cache-first.
// Include inoltre i balloon dei dialoghi duello nell'app shell offline.
// v110: un nodo della Storia senza campo/musica propri eredita quelli del
// suo capitolo (js/story/story-progress.js, js/data/story-campaigns.js —
// entrambi già nell'app shell). Solo logica, nessun file nuovo.
// v109: nuovo campo Industria KaibaCorp (images/fields/ e fields/mobile/,
// js/data/arena-options.js). Il bump serve perché chi non l'avesse mai
// richiesto prima non trovi un 404 in cache al primo utilizzo.
// v108: ritratti veri per Noah Kaiba, Gozaburo Kaiba e i Big Five
// (Gansley/Johnson/Nesbitt/Crump/Lector) — prima ricadevano tutti sul
// sigillo dorato di ripiego, nessuna immagine esisteva ancora a questi
// nomi di file.
// v107: ritratti veri per Cadorna e Diaz (stesso nome di file, sostituiscono
// i segnaposto).
// v106: Editor Mappa: campo/musica per nodo, scrittura diretta su
// story-campaigns.js (js/dev/story-map-editor.js, solo amministratori).
// v101: Cadorna e Diaz protagonisti della Grande Guerra (story-campaigns.js,
// story-progress.js, storia.html; ritratti nuovi in images/characters/,
// MEDIA e quindi cache-first, nessuna voce da aggiungere qui).
// v100: tolti cinque campi (Dirigibile di Kaiba, Dirigibile KaibaCorp II,
// Arena Kaiba 1 e 2, Castello di Pegasus): chi li avesse in cache se li
// porterebbe dietro, e il campo di default del duello è cambiato.
// v99: Battle City a 1 Carta Locazione, Sfide dei livelli della Storia
// (storia.html carica ora il tracker), otherHandCards in card-effects.js.
// Nessun file nuovo.
// v98: statistiche del Profilo (js/ui/profile-stats.js/.css, nuovi
// nell'APP_SHELL), menu della Storia rinnovato, campo della tappa letto
// per nome di file in duelMonstersCore.html.
// v97: topbar rinnovata (js/ui/topbar.js/.css, già nell'APP_SHELL) e
// prezzi dei mazzi alzati (js/economy/shop-catalog.js). Nessun file nuovo.
// v96: la schermata Sfide diventa un componente condiviso
// (js/ui/sfide-view.js/.css, nuovi nell'APP_SHELL) montato sia da
// sfide.html sia dalla vista Sfide del menu; il Profilo del menu non
// chiede più quale salvataggio tenere (index.html).
// v95: logo nuovo (js/ui/game-logo.js/.css, nuovi nell'APP_SHELL) e
// splash d'apertura rifatto in index.html.
// v94: livelli della Storia (story-progress.js, storia.html, rewards.js,
// duel-session.js, story-campaigns.js, challenges-db.js, test-shortcuts.js).
// v93: node-map.js (mondo grande quanto il disegno), storia.html
// (rilettura delle scene, sfondo delle scene d'area), monster-hologram.js,
// duel-cinematics.css (fascia dietro "Continua").
// v92: Storia — il castello diventa la seconda mappa del Regno
// (mappeSuccessive); cambiano storia.html, node-map.js, story-progress.js,
// story-campaigns.js e l'Editor Mappa.
// v91: Storia — area del Castello di Pegasus con la mappa degli interni
// (images/maps/storia_anime_castello_pegasus.jpg); cambiano
// story-campaigns.js, story-progress.js e challenges-db.js.
// v90: Storia — mappa grande a sei isole
// (images/maps/storia_mappa_principale_sei_isole.jpg), il prologo a
// Domino City con la sua mappa (storia_anime_prologo.jpg) e la nuova
// mappa di Freedom (storia_freedom_2.jpg). Cambiano story-campaigns.js,
// story-progress.js e challenges-db.js.
// v89: 25 terreni nuovi (images/fields/ e fields/mobile/, compresi i due
// della Grande Guerra) e le mappe delle cinque aree della Storia anime
// (images/maps/storia_anime_*.jpg). Sono MEDIA, cache-first: il bump
// serve perché chi aveva in cache un 404 a quei percorsi non se lo porti
// dietro.
// v88: i mazzi dei Duellanti rifatti (tre liste per personaggio in
// js/data/character-decks.js). Nessun file nuovo.
// v87: nel Negozio, una carta della rotazione giornaliera sparisce dalla
// vetrina appena comprata (prima si poteva ricomprare più volte nello
// stesso giorno). Nessun file nuovo (shop-catalog.js/shop-ui.js/shop.css
// erano già in app shell) - il bump serve solo a far ripopolare la cache.
// v86: 3 difficolta' (Facile/Normale/Difficile) in Duello Libero e nei
// Tornei, con un mazzo dedicato per personaggio per ognuna
// (js/data/character-decks.js) e Creazione Deck che mostra anche il
// mazzo Facile. Nessun file nuovo (character-decks.js era gia' in app
// shell) - il bump serve solo a far ripopolare la cache con la versione
// nuova, non a introdurre percorsi nuovi.
// v85: images/maps/storia_mappa_principale.jpg rifatta con le 5 isole
// vere della Storia anime (MEDIA, cache-first: il bump serve a farla
// riscaricare), e i 5 nodi della mappa spostati al centro di ogni arena
// (js/data/story-campaigns.js). Nessun file di codice nuovo.
// v84: Starter/Structure Deck piu' cari e piu' progressivi
// (js/economy/shop-catalog.js/rewards.js/shop-ui.js). Nessun file nuovo.
// v83: Sfide (sfide.html) ridisegnata come griglia di riquadri con
// pannello di dettaglio, non più un elenco a righe. Nessun file nuovo.
// v82: la campagna anime torna a cinque aree (solo il percorso vero della
// prima serie — via Il Risveglio dei Draghi e il Gran Premio KC).
// Nessun file nuovo.
// v81: la campagna anime diventa una mappa di sette aree, con la sua
// immagine images/maps/storia_mappa_principale.jpg (MEDIA, cache-first:
// il bump serve a farla scaricare). Nessun file di codice nuovo.
// v80: apertura bustina rifatta (una carta alla volta, niente
// scorrimento), scatola vera per l'acquisto di un mazzo, barra di
// scorrimento nascosta a fine duello. Nessun file nuovo.
// v79: animazioni di spostamento carta (Terreno<->Cimitero, ritorno del
// controllo) e cerimonia di apertura bustina — js/economy/pack-opening.js
// e .css sono file NUOVI da aggiungere all'app shell.
// v78: salvataggio caricato sul cloud mentre si gioca (js/cloud/auto-sync.js,
// file NUOVO da aggiungere all'app shell), reset del profilo, admin con
// valute piene, e l'ora del server presa dalla funzione SQL server_now()
// invece che dall'header HTTP `Date`, che il CORS non espone.
// v77: Duellanti da sbloccare in Duello Libero.
// js/data/character-unlocks.js e' un file nuovo, aggiunto all'app shell.
// v76: l'autowin delle Storie diventa un interruttore del Pannello Admin.
// Nessun file nuovo in cache: js/dev/ resta deliberatamente FUORI
// dall'app shell (vedi guardrail-script-delle-pagine.spec.js).
// v75: schermata di fine duello — pulsante "Continua" non piu' coperto
// dalla fascia sfumata, piu' l'avviso "scorri" quando i premi non ci
// stanno tutti. Nessun file nuovo.
// v74: ologrammi piu' definiti al centro e sfumati sui bordi. Nessun file
// nuovo, ma il bump serve perche' la modifica vive tutta in
// js/ui/monster-hologram.css, che e' gia' in cache.
// v73: revamp delle Sfide. js/data/missions-db.js e' un file nuovo da
// aggiungere all'app shell; sfide.html carica ora anche server-date.js e
// story-campaigns.js.
// v72: mappa del Castello di Pegasus nel Regno dei Duellanti (immagine
// gia' presente, ora usata anche come mondo della mappa a nodi) e Stelle
// del torneo indipendenti dal portafoglio.
// v71: tolto js/ui/tilt-setting.js (il campo inclinato, rimosso su
// richiesta); portale nella carta sotto l'ologramma, pila della Catena a
// sinistra su schermo largo, bagliore sulla carta che si attiva.
// v70: le due scelte di resa (ologramma, campo inclinato) erano finite
// solo in impostazioni.html e mancavano dalla vista Impostazioni di
// index.html, cioe' dall'unica che si apre dal menu. Il bump serve a far
// ripulire la copia in cache del vecchio index.html: l'app shell e'
// network-first e in teoria non ne avrebbe bisogno, ma un Service Worker
// gia' installato e' esattamente il caso in cui "in teoria" non basta
// (vedi il giro di debug via adb documentato in CLAUDE.md).
// v69: nuova impostazione "Campo inclinato" (js/ui/tilt-setting.js, file
// nuovo da aggiungere all'app shell) e ologrammi piu' grandi su schermo
// largo.
// v68: i tredici ritratti di Forbidden Memories che erano ancora
// segnaposto (i Maghi, Sebek, Neku). Sono MEDIA, cache-first: il bump
// serve perche' chi aveva in cache il monogramma a quegli stessi
// percorsi non se lo porti dietro.
// v67: tabellone del torneo di Memorie Proibite completo (nove incontri
// piu' una scena) e ritratto del protagonista nelle cutscene. Solo dati
// e logica di pagina, nessun file nuovo.
// v66: ritratti storici dei sei comandanti della Grande Guerra e
// bandiera del Regio Esercito (MEDIA, cache-first: il bump serve perche'
// chi aveva in cache i vecchi segnaposto a quegli stessi percorsi non se
// li porti dietro). duelMonstersCore.html carica ora anche
// js/data/story-campaigns.js, per sapere chi sei in una campagna.
// v65: le scene della Storia allungate e dodici tappe della Grande
// Guerra rimesse sul posto giusto (solo dati in
// js/data/story-campaigns.js), piu' il fix alla lista delle storie in
// storia.html. Nessun file nuovo.
// v64: la mappa disegnata della Grande Guerra e i due canti del fronte
// (images/maps/storia_la_grande_guerra_1.jpg,
// audio/soundtracks/ww1/*.mp3 — tutti MEDIA, cache-first). Il bump serve
// per lo stesso motivo di sempre: chi aveva in cache un 404 a quei
// percorsi, finché non esistevano, se lo porterebbe dietro.
// v63: il torneo della Kaiba Corporation dentro Memorie Proibite, più un
// dialogo prima di ogni duello della campagna. Solo dati e logica di
// pagina (nessun file nuovo da precaricare) — la mappa del tabellone
// (images/maps/storia_torneo_kaiba_1.jpg) non c'è ancora e ricade sulla
// texture di riserva: il bump serve perché chi avesse in cache il 404 a
// quel percorso non se lo porti dietro quando l'immagine arriverà.
// v62: le tappe di Memorie Proibite posate sui luoghi veri della sua
// mappa. Solo dati (js/data/story-campaigns.js), nessun file nuovo.
// v61: prima mappa disegnata di una campagna (images/maps/, MEDIA e
// quindi cache-first). Le altre campagne puntano già al nome della
// propria, che ancora non esiste: il bump serve perché chi avesse in
// cache un 404 a quei percorsi non se lo porti dietro.
// v113: il duello concluso viene rimosso dalla cronologia, cosi' Indietro
// da browser o APK non puo' riaprire la partita precedente.
// v114: nuove cinematiche Rituale/Tornado/Piumino e relativi aggiornamenti
// di motore e stile. Il cambio forza browser e WebView dell'APK a scartare
// le copie precedenti di effects.js/effects.css e dei moduli delle carte.
// v115: nuovo font locale del logo e loader riutilizzabile nelle viste SPA
// Negozio/Cartoteca.
// v116: il carattere decorativo è sostituito da un'iscrizione romana
// geometrica, più vicina all'immaginario monumentale dell'Antico Egitto.
// v117: trattamento del titolo semplificato — niente cornici o rilievi
// metallici multipli, solo oro caldo e ombra morbida.
// v118: Rare Hunter estratti soltanto entrando nel relativo nodo.
// v119: la struttura logica della mappa Battle City torna invisibile; i nodi
// restano persistenti e soltanto il segnalino scorre fra gli isolati.
// v120: pedine 3D in SVG al posto delle emoji sulla mappa di Battle City
// (js/ui/board-pieces.js, nuovo nell'app shell) e percorsi con freccia
// verso le caselle raggiungibili.
// v121: pedine piu' ricche di Battle City (js/ui/board-pieces.js).
// v122: Duellanti ritagliati senza sfondo, solo quelli puliti
// (images/characters/pedine/: Rex, Mako, Espa Roba).
// v123: fallback automatico alla pedina standard se manca il PNG del Duellante.
// v124: PNG trasparenti dei Duellanti in images/characters/pedine/ (id.png).
// v125: Annulla/Esc e modalita' evidente per i Tributi; il bot aspetta i modali aperti.
// v126: PNG delle pedine rinominati col nome del file avatar (dukeDevlin.png).
// v127: pedine ridimensionate (max 320 px); originali in avatarTrasparenza/.
// v128: velocità del bot, schema unico delle scelte, Rare Hunter ritagliato, anti-imbroglio server.
// v129: avatar di Kaiba per contesto (Regno dei Duellanti / Forbidden Memories).
// v130: salvataggi vecchi della Storia anime azzerati invece che migrati.
// v131: ripulite le vecchie migrazioni della Storia anime.
// v132: banda delle scelte (Tributo/scarto/casella) a capo su telefono in verticale.
// v133: ritaglio di Joey per la mappa di Battle City.
// v134: divieti di Evocazione (282/434/1045) e Velocita' del bot nel menu Impostazioni.
// v135: tutte le foto sono .jpg (prima carte e mappe erano .jpeg): i nomi sono cambiati.
// v136: l'IA decide gli attacchi con ATK/DEF effettivi (bonus e malus inclusi).
// v137: console di avvio KaibaCorp System nel Multiplayer (mp-boot.js).
// v138: tema fisso "King of Games" contro i due Yugi.
// v139: Multiplayer senza console a finestra (attesa del server scritta in pagina);
// colonne sonore numerate: "56. Battle for the Millennium" (era mainTheme) e
// "57. King of Games - Yugi's Final Duel".
// v140: Battle City, legenda ancorata in basso e una sola Carta Locazione per distretto.
// v141: Battle City, oggetti (Radar potenziato, Scudo del Duel Disk), Blackout e Missione secondaria.
// v142: Storia anime, scene riscritte come dialoghi fra personaggi.
// v143: Multiplayer, attesa del server come terminale KaibaCorp con glitch (in pagina, senza modali).
// v144: carte 899/142/511/512 allineate al testo.
// v145: dieci carte allineate al testo (negazione in battaglia, bersaglio obbligato, Evocazione condizionata).
// v146: chiuse le ultime 17 carte che non seguivano il testo.
// v147: lo scarto lo sceglie chi lo subisce (Criosfinge, Duo Delinquente).
// v148: la battaglia aspetta le scelte del giocatore (selettore di opzioni).
// v149: Necrovalley vede ogni spostamento dal Cimitero; ritorni in mano al proprietario.
// v150: checkpoint di targeting coperto ovunque (Equip, Union, ~30 carte).
// v151: carte usabili da entrambi i giocatori (Oppressione Reale).
// v159: indicatore dell'attesa di una decisione remota nel Multiplayer.
// v160: una risposta HTTP non valida non sostituisce più una copia buona;
// le scritture vengono attese prima di concludere la risposta intercettata.
// v161: il client Multiplayer usa esclusivamente il passo comune; rimossi
// dispatcher, messaggi per singola mossa e fotografie di stato legacy.
// v165: nuovi emblemi illustrati e bilanciamento di drop/buste tematiche.
// v166: emblemi originali solo sulle generiche; artwork veri sulle tematiche.
// v167: ricompensa carta rifinita e carosello sbustamento trascinabile.
// v168: cinematica ricompensa alleggerita e sfondo senza griglia.
// v170: l'Editor Mappa mostra X/Y in tempo reale durante il trascinamento.
// v171: coordinate su ogni nodo; dettaglio carta mobile landscape scorribile
// e apertura touch limitata al tap diretto.
// v172: unione col fix degli stream Range/HTTP 206 e il player persistente.
// v173: dettaglio carta landscape compatto e strumenti admin per le Storie.
// v174: rework completo dei Toon e bilanciamento dei deck Pegasus.
// v185: l'azzeramento del profilo vale anche sugli altri dispositivi.
// v186: un solo caricamento automatico sul cloud (cloud-autosync.js assorbito da auto-sync.js).
// v187: carte "vive" (inclinazione e riflessi per rarità) e parallasse del menu.
// v188: Dettagli video "Alti" di default; "Profondità del menu" attivabile dalle Impostazioni.
// v189: Storia, ritorno nell'area dopo un duello rigiocato e riparazione delle aree azzerate.
// v190: azzeramento delle storie per tutti (save-manager.js, AZZERAMENTO_STORIE).
// v191: ritocchi dell'Editor Mappa in un file proprio (js/data/story-ritocchi.js + js/story/story-ritocchi.js) ed editor rinnovato.
// v192: riscontri del duello (duel-feedback.js), ologrammi giusti su carte scoperte e in Difesa, moneta e dado senza rimbalzo.
// v193: caselle del campo ridotte a un'ombra tonda col colore dell'arena (tinta-campo.js, tinte-campi.js), contorno solo durante la zoomata d'ingresso.
// v194: plance dei duellanti a triangolo sfumato con la pedina scontornata, angolo di sistema (tempo/turno/livello/Abbandona) in un solo pannello.
// v195: finestra "prepara la sfida" del Duello Libero condivisa (sfida-libera.js/.css), anteprime musicali che fermano davvero il sottofondo, dissolvenze della musica nel browser.
// v196: fumetti delle battute rifatti e animati, ologrammi sotto la descrizione carta su telefono, Segnalini Magia visibili (Abile Mago Oscuro & co.).
// v197: morra cinese rifatta (ritratti, medaglioni, scontro delle mani, tasti 1/2/3).
// v206: fumetti delle battute a targa d'oro, senza barra del tempo.
// v207: battute dei duellanti come sottotitoli.
// v208: alone delle battute sfumato su tutti i lati.
// v209: Regno dei Duellanti con sfidanti visibili e vicoli ciechi.
// v213: carta scoperta col Flip Summon che spariva al passaggio del mouse.
// v214: Profilo rifatto (testata, riepilogo, portafoglio, mazzi: js/ui/profile-hero.*).
// v215: Duello Libero con barra di ricerca e filtri, sblocco preciso e medaglie (js/ui/scelta-duellante.*).
// v216: unita la lezione guidata col nonno (js/tutorial/), sviluppata su un branch a parte.
// v217: schermate di Vittoria/Sconfitta che tagliavano il titolo e i premi.
// v218: menu Tutorial (tutorial.html) e lezioni brevi su Catena, Fusione e Flip.
// v219: Storia anime riallineata all'anime (duelli mancanti, laterali dalla parte di chi vince).
// v221: avatar definitivi e sinergie IA/deck di Mage Soldier.
// v222: Duello Sandbox visibile solo all'amministratore.
// v223: nuovo nome, Yu-Gi-Oh! Millennium Duel Arena (logo, titoli, nome dell'app).
// v224: modalità Puzzle (puzzle.html, js/modes/), sezione Modalità nelle Sfide.
// v225: modalità Rivincite (rivincite.html): duelli dell'anime col mazzo del personaggio.
// v226: Torre dei Duellanti (torre.html): 20 piani, LP che si portano, Ristoro o oggetto.
// v227: Torre, conferma di abbandono con la finestra del gioco.
// v228: Equip con piu' bersagli non finiscono piu' al Cimitero durante la scelta.
// v229: Collana del Comando e Carro Armato Ingranaggio Antico: il bersaglio lo sceglie il giocatore.
// v230: Torre dei Duellanti disegnata come una vera torre da scalare.
// v231: UI Torre rinnovata e ambienti field più organici, con vento continuo sul Dirigibile.
// v233: completamento delle carte TCG della prima serie (30 nuove risorse
// incluse le quattro Fusion Material mancanti). v232 resta riservata al
// branch VFX parallelo, così i due lavori non pubblicano la stessa cache.
// v234: rarità, fonti di acquisizione, imprese firma e Forgia delle Fusioni
// per il nuovo lotto; invalida la cache perché cambiano Negozio e Cartoteca.
// v235: correzioni X/Y/Z e selettore obbligatorio Attacco/Difesa.
// v236: box info carta escluso durante attacchi e selezioni di gioco.
// v237: sblocchi modalità, Regole nel Tutorial e consultazione esplicita
// delle carte sul Terreno senza interferire con le azioni di gioco.
// v238: filmati alleggeriti e grafica sottostante sospesa durante i video.
// v239: long-press informazioni, prompt ripulito e rendering mano stabile.
// v240: revamp ampio di Cilindro Magico diretto alla mano avversaria.
// v241: revamp epico e riallineato di Forza dello Specchio.
// v242: login rinnovata e Cartoteca a 300 carte per pagina.
// v243: riallineata a 300 anche la Cartoteca integrata nel menu.
// v244: margine stelle Livello 12 rifinito.
// v245: dettagli bustina cliccabili e interruttore filmati di Evocazione.
// v246: Cartoteca in ordine catalogo, con WW1 in fondo.
// v249: ambientazioni e musica per arco della Storia anime.
// v250: ripresa sicura del duello dopo sospensione della WebView mobile.
// v255: versione 1.3.16, bordo nero sul fronte delle carte.
// v256: versione 1.3.17, percorso e livelli dei titoli nel Profilo.
// v257: versione 1.3.18, distruzione dei mostri coperti sempre in Difesa.
// v258: versione 1.3.19, cornice antracite più fedele delle carte.
// v260: versione 1.3.21, nuove lezioni guidate e nuovi puzzle.
// v261: nuove tracce 57-58 e King of Games rinumerata 59; temi automatici
// per Pegasus, Heishin, Marik, DarkNite e Nitemare nei modi senza selezione.
// v263: Tifone dello Spazio Mistico rifatto come imbuto di vento (merge VFX).
// v264: Extra Deck che pulsa in viola quando una Fusione senza Polimerizzazione è evocabile.
// v265: dorso con un solo bordo; in verticale carte e pile a misure vicine.
// v266: badge ATK/DEF e contatori delle pile senza sovrapposizioni su mobile.
// v267: ATK/DEF e contatori senza box, su una riga, con rilievo 3D.
// v268: ologrammi su mobile un po' più bassi (base al 68% della carta).
// v269: barra delle fasi dal Terreno al Cimitero, col colore del campo e un solo bordo.
// v270: barra delle fasi responsive senza fascia d'ombra, dorsi nitidi sulle carte piccole, pile allineate alle carte, niente sollevamento al tocco.
// v271: su mobile ATK/DEF appena sotto la carta, artwork compatto ad angoli
// vivi, riquadro marrone del dorso arrotondato e ovale sempre nero.
// v272: il campo desktop resta centrato anche con il box informazioni carta.
// v273: stepper piu' leggibile e avatar/pedina corretti per Nitemare.
// v274: retro carta in CSS, sigilli fasi scenici e pedine uniformi fuori dal Duello Libero.
// v275: stepper ricomposto come barra rituale compatta, senza anelli orbitanti.
// v276: dorso CSS alleggerito eliminando i doppi contorni interni.
// v277: stepper senza bordi, stato corrente affidato alla luce dell'icona.
// v278: passaggio morra-arena mobile senza layer e animazioni concorrenti.
// v279: nomi compatti e invito all'azione rendono leggibili le fasi.
// v282: miniature WebP lazy per Duellanti e anteprime delle Arene.
// v317: pose di esclamazione rifinite senza ritagli laterali.
const CACHE_NAME = 'ygo-duel-arena-v321';

// L'intera "app shell": tutte le pagine HTML + tutto il codice JS/CSS che
// le fa funzionare. Leggero (pochi MB in tutto), quindi si può precaricare
// per intero all'installazione — è quello che rende il gioco AVVIABILE
// offline, non solo "un po' più veloce".
const APP_SHELL = [
    './',
    'index.html',
    'admin.html',
    'cartoteca.html',
    'creazione-deck.html',
    'crea-carta.html',
    'duello-libero.html',
    'duello-sandbox.html',
    'impostazioni.html',
    'multiplayer.html',
    'negozio.html',
    'profilo.html',
    'regole.html',
    'sfide.html',
    'tutorial.html',
    'puzzle.html',
    'rivincite.html',
    'torre.html',
    'storia.html',
    'tornei.html',
    'torneo-regno-duellanti.html',
    'torneo-battle-city.html',
    'torneo-kaiba.html',
    'duelMonstersCore.html',
    'manifest.json',
    'images/icons/icon-192.png',
    'images/icons/icon-512.png',
    'images/icons/icon-180.png',
    'images/icons/icon-32.png',
    // js/ organizzata per contesto (vedi docs/architecture/GUIDA_RIUTILIZZO.md): motore di
    // gioco in engine/, dati carte/mazzi in data/, IA in ai/, audio in
    // audio/, presentazione in ui/, multiplayer in multiplayer/, sync
    // cloud in cloud/, librerie di terze parti in vendor/ — solo
    // save-manager.js/duel-session.js/pwa-register.js restano nella
    // radice di js/ (collante di pagina, non parte di un sottosistema).
    'js/ui/card.css',
    'js/ui/effects.css',
    'js/ui/duel-cinematics.css',
    'js/ui/duel-rps.css',
    'js/ui/duel-dialogues.css',
    'js/tutorial/tutorial-duel.css',
    'js/modes/modes.css',
    'js/modes/mode-pages.css',
    'js/modes/mode-unlocks.js',
    'js/ui/topbar.css',
    'js/ui/challenge-banner.css',
    'js/ui/page-loader.css',
    'js/ui/game-logo.css',
    'assets/fonts/cinzel/Cinzel-Variable.ttf',
    'assets/fonts/cinzel/OFL.txt',
    'js/ui/sfide-view.css',
    // Mancava duel-sandbox.js: duelMonstersCore.html lo carica (è quello
    // che allestisce lo stato iniziale del "Duello Demo"), ma non era mai
    // finito qui, quindi offline la pagina del duello si apriva monca.
    // Trovato dal guardrail tests/specs/guardrail-script-delle-pagine.spec.js.
    // gruppo-script:partita
    'js/engine/duel-sandbox.js',
    'js/engine/stato.js',
    'js/engine/pausa-duello.js',
    'js/engine/canale-partita.js',
    'js/engine/comandi.js',
    'js/engine/passo-comune.js',
    'js/engine/fasi.js',
    'js/engine/battaglia.js',
    'js/engine/evocazioni.js',
    'js/engine/game-flow.js',
    'js/engine/actions.js',
    // /gruppo-script:partita
    // gruppo-script:motore
    'js/engine/casuale.js',
    'js/engine/porta-ui.js',
    'js/engine/eventi-duello.js',
    'js/engine/tavolo.js',
    'js/engine/duel-engine.js',
    'js/engine/decisioni.js',
    'js/engine/effect-templates.js',
    'js/engine/card-effects.js',
    'js/engine/card-effects-1.js',
    'js/engine/card-effects-2.js',
    'js/engine/card-effects-3.js',
    'js/engine/card-effects-4.js',
    'js/engine/card-effects-5.js',
    'js/engine/card-effects-6.js',
    'js/engine/card-effects-7.js',
    'js/engine/card-effects-8.js',
    // /gruppo-script:motore
    'js/ai/ai-controller.js',
    'js/ai/ai-hard.js',
    'js/ai/ai-medium.js',
    'js/ai/ai-shared.js',
    'js/ai/bot.js',
    'js/audio/audio-library.js',
    'js/audio/audio-manager.js',
    'js/audio/sfx.js',
    'js/challenges/challenge-tracker.js',
    'js/story/story-progress.js',
    'js/dev/story-admin-tools.js',
    'js/data/cards-data.generated.js',
    'js/data/cards-db.js',
    'js/data/challenges-db.js',
    'js/data/missions-db.js',
    'js/data/story-campaigns.js',
    'js/data/story-ritocchi.js',
    'js/story/story-ritocchi.js',
    'js/data/character-decks.js',
    'js/data/characters-db.js',
    'js/data/character-unlocks.js',
    'js/data/custom-cards.js',
    'js/data/custom-taxonomy.js',
    'js/data/starter-structure-decks.js',
    'js/ui/inclinazione.js',
    'js/ui/card-renderer.js',
    'js/ui/fx-gsap.js',
    'js/ui/challenge-banner.js',
    'js/ui/duel-cinematics.js',
    'js/ui/duel-rps.js',
    'js/ui/duel-dialogues.js',
    'js/tutorial/tutorial-duel.js',
    'js/data/puzzles-db.js',
    'js/modes/puzzle-mode.js',
    'js/data/rivincite-db.js',
    'js/modes/rivincita-mode.js',
    'js/data/torre-db.js',
    'js/modes/torre.js',
    'js/modes/torre-mode.js',
    'js/ui/effects.js',
    'js/ui/error-recovery.js',
    'js/ui/icon-library.js',
    'js/ui/board-pieces.js',
    'js/ui/topbar.js',
    'js/ui/node-map.js',
    'js/ui/node-map.css',
    'js/ui/page-loader.js',
    'js/ui/game-logo.js',
    'js/ui/sfide-view.js',
    'js/ui/profile-stats.js',
    'js/ui/profile-hero.js',
    'js/ui/recupero-copia.js',
    'js/ui/recupero-copia.css',
    'js/ui/scelta-duellante.js',
    'js/ui/profile-stats.css',
    'js/ui/profile-hero.css',
    'js/ui/scelta-duellante.css',
    'js/ui/visual-effects-library.js',
    'js/multiplayer/mp-lobby.js',
    'js/multiplayer/mp-passo-comune.js',
    'js/multiplayer/multiplayer.js',
    'js/multiplayer/network.js',
    'js/multiplayer/protocollo-mp.js',
    'js/cloud/auth-gate.js',
    'js/cloud/cloud-sync.js',
    'js/cloud/auto-sync.js',
    'js/cloud/supabase-config.js',
    'js/native/app-back-button.js',
    'js/native/haptics.js',
    'js/native/keep-awake.js',
    'js/native/native-save-backup.js',
    'js/duel-session.js',
    'js/pwa-register.js',
    'js/save-manager.js',
    // Economia e Negozio
    'js/cloud/server-date.js',
    'js/data/card-rarity.js',
    'js/economy/card-acquisition.js',
    'js/economy/card-drop-animation.js',
    'js/economy/card-drop-animation.css',
    'js/economy/rewards.js',
    'js/economy/rewards.css',
    'js/economy/shop-catalog.js',
    'js/economy/shop-ui.js',
    'js/economy/shop.css',
    'js/economy/pack-opening.js',
    'js/economy/pack-opening.css',
    'js/ui/deck-box.js',
    'js/ui/deck-box.css',
    'js/ui/mp-lobby.css',
    'js/ui/duel-setup.js',
    'js/ui/duel-setup.css',
    'js/ui/sfida-libera.js',
    'js/ui/sfida-libera.css',
    'js/ui/deck-switcher.js',
    'js/ui/deck-switcher.css',
    'js/ui/video-quality.js',
    'js/ui/bot-speed.js',
    'js/ui/onboarding.js',
    'js/ui/onboarding.css',
    'js/ui/story-cutscene.js',
    'js/ui/story-cutscene.css',
    'js/data/tournament-dialogues.js',
    'js/ui/ambiente-webgl.js',
    'js/ui/field-ambience.js',
    'js/ui/field-ambience.css',
    'js/ui/monster-hologram.js',
    'js/ui/monster-hologram.css',
'js/ui/grido-evocazione.js',
'js/ui/grido-evocazione.css',
'js/data/gridi-evocazione.js',
    'js/ui/duel-feedback.js',
    'js/ui/duel-feedback.css',
    'js/ui/hologram-setting.js',
    'js/ui/tinta-campo.js',
    'js/data/arena-options.js',
    'js/data/tinte-campi.js',
    'js/data/card-origins.generated.js',
    'js/data/deck-legality.js',
    'js/ui/card-detail.js',
    'js/ui/card-detail.css',
    'js/version.js',
    'js/vendor/gsap.min.js',
    'js/vendor/howler.min.js',
    'js/vendor/pixi.min.js',
    'js/vendor/supabase.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // addAll fallisce TUTTO se anche un solo file manca (404): meglio
            // così, un file dimenticato dalla lista qui sopra si nota subito
            // invece di restare un buco silenzioso nella cache offline.
            // cache: 'reload' su ogni richiesta per lo stesso motivo per cui
            // lo usa la strategia network-first più sotto: queste fetch le
            // fa il Service Worker, quindi NON passano dal proprio handler e
            // userebbero la cache HTTP del browser — una cache appena creata
            // si riempirebbe di copie vecchie fino a qualche minuto, e
            // basta che UNO dei file sia indietro rispetto all'.html che lo
            // usa perché la pagina si apra con un errore (visto davvero su
            // telefono: "getCardTerms is not defined", .html nuovo e
            // cards-db.js vecchio).
            .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
            // Attiva subito questa versione invece di aspettare che tutte le
            // schede aperte del gioco si chiudano — chi lo installa/aggiorna
            // vuole vedere l'effetto al prossimo avvio, non prima.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

/** Vero per le richieste dell'app shell (HTML/CSS/JS) — vedi la strategia network-first sopra. */
function isAppShellRequest(url) {
    return /\.(html|css|js)$/.test(url.pathname) || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // niente cache per POST/ecc (qui non ce ne sono comunque)

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // mai toccare richieste verso altri domini

    // Audio/video vengono richiesti a segmenti tramite Range. Cache Storage
    // non accetta risposte HTTP 206: un cache.put() trasformerebbe uno stream
    // valido in ERR_FAILED. I segmenti passano quindi direttamente dalla rete.
    const rangeHeader = req.headers && typeof req.headers.get === 'function'
        ? req.headers.get('range')
        : null;
    if (rangeHeader) {
        event.respondWith(fetch(req));
        return;
    }

    if (isAppShellRequest(url)) {
        event.respondWith(
            // cache: 'reload' forza il bypass della cache HTTP del BROWSER
            // (quella governata dagli header Cache-Control del server, uno
            // strato SOTTO la Cache Storage di questo Service Worker):
            // senza, un fetch() "network-first" può comunque tornare una
            // risposta stantia se il browser la considera ancora valida
            // per i suoi header (GitHub Pages ne manda con qualche minuto
            // di validità) — proprio il caso che questa strategia vuole
            // escludere, un aggiornamento appena pubblicato deve arrivare
            // SEMPRE al prossimo avvio online, non "quando scade la cache
            // HTTP".
            fetch(req, { cache: 'reload' })
                .then((response) => {
                    // Un 404/500 è comunque una fetch risolta: senza questo
                    // controllo sostituirebbe nella Cache Storage una copia
                    // buona, rendendo guasto anche il successivo avvio
                    // offline. La risposta di rete resta visibile online,
                    // ma non viene resa persistente.
                    if (!response || !response.ok) return response;
                    const copy = response.clone();
                    // La Promise di put fa parte di respondWith: se la si
                    // lasciasse staccata, il worker potrebbe essere sospeso
                    // dopo aver consegnato `response` ma prima di aver
                    // terminato l'aggiornamento della cache.
                    return caches.open(CACHE_NAME)
                        .then((cache) => cache.put(req, copy).catch(() => {}))
                        .then(() => response);
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((response) => {
                // Solo risposte valide vengono messe in cache (una 404 per
                // un'immagine mancante — caso già gestito con un fallback
                // grafico lato client — non deve "incollarsi" in cache).
                if (response && response.ok && response.status !== 206) {
                    const copy = response.clone();
                    // Anche la cache al primo uso deve completare la propria
                    // scrittura dentro la vita della richiesta del worker.
                    return caches.open(CACHE_NAME)
                        .then((cache) => cache.put(req, copy).catch(() => {}))
                        .then(() => response);
                }
                return response;
            });
        })
    );
});





