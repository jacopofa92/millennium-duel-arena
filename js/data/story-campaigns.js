/**
 * story-campaigns.js — Le campagne della Modalità Storia (storia.html).
 * =====================================================================
 * Solo dati. La progressione (dove sei arrivato, cosa è sbloccato, cosa
 * succede quando vinci) vive in js/story/story-progress.js, e il disegno
 * della mappa in js/ui/node-map.js: qui non c'è nessuna logica, come per
 * characters-db.js e challenges-db.js.
 *
 * UNA CAMPAGNA è un elenco ORDINATO di capitoli, e un capitolo un elenco
 * ordinato di TAPPE. Si avanza una tappa alla volta: la successiva si
 * sblocca vincendo quella prima. Niente bivi e niente percorsi generati a
 * caso — quelli sono dei tornei, dove la sorpresa è il punto. Qui la
 * sorpresa sarebbe un difetto: una storia si racconta nell'ordine in cui
 * è scritta.
 *
 * UNA TAPPA è di tre specie:
 *   - `kind: 'duel'`   — un duello. `characterId` (js/data/characters-db.js),
 *     e facoltativamente `field` e `music` per l'ambientazione.
 *     `difficulty` si usa soltanto nelle campagne `senzaLivelli`: nelle
 *     altre vale la difficoltà scelta una volta all'inizio della Storia.
 *   - `kind: 'scene'`  — una schermata di racconto, nessun duello: `testo`
 *     (una o più righe) e facoltativamente `chi` (chi parla). Serve a dare
 *     respiro fra un duello e l'altro e a spiegare perché si sta
 *     duellando, che è l'unica cosa che distingue una Storia da una fila
 *     di Duelli Liberi.
 *   - `kind: 'torneo'` — una tappa che è a sua volta un PERCORSO: ha una
 *     mappa propria (`mappa: { sfondo, larghezza, altezza }`) e un proprio
 *     elenco di `tappe`. Ci si entra cliccandola, si sale un incontro alla
 *     volta e CHI PERDE RICOMINCIA DAL PRIMO — la regola che dà peso a un
 *     torneo, e che nella campagna non vale (lì perdere costa solo il
 *     tempo di riprovare). Vinto l'ultimo incontro si torna sulla mappa
 *     della campagna, che avanza di quella sola tappa. L'avanzamento sta
 *     in `sotto` dentro il salvataggio della campagna, vedi
 *     js/story/story-progress.js.
 *
 * `dialogo` (facoltativo, su una tappa di DUELLO) è la conversazione che
 * precede l'incontro: un elenco di battute nella stessa forma degli
 * intermezzi (`{ chi: <id del roster>, testo }`, oppure `{ nome, icona,
 * testo }` per una voce che nel roster non c'è). Serve perché arrivare
 * davanti a un avversario e trovarsi dentro un duello senza che nessuno
 * abbia detto una parola fa sembrare la Storia un elenco di partite; due
 * righe in carattere bastano a ricordare chi si ha davanti e perché.
 *
 * `sfondo` è l'immagine della mappa, e può essere un ELENCO di candidati
 * in ordine di preferenza: si usa il primo che esiste davvero.
 *
 * Ogni campagna dichiara come PRIMO candidato la sua mappa disegnata,
 * `images/maps/storia_<id della campagna>_1.jpg`, e come secondo
 * l'immagine presa in prestito da un'arena, che è il ripiego finché
 * quella mappa non c'è:
 *
 *     sfondo: ['images/maps/storia_ww2_1.jpg', 'images/fields/mobile/rovine_2.jpg']
 *
 * IL GIORNO IN CUI QUEL FILE VIENE MESSO NELLA CARTELLA, la mappa lo usa
 * da sola — nessuna riga di codice da toccare, nessun elenco da
 * aggiornare. Una mappa arrivata con un nome diverso da quello canonico
 * si mette semplicemente davanti agli altri candidati (è il caso della
 * Grande Guerra), invece di rinominare il file: l'elenco esiste apposta.
 * Oggi hanno la loro mappa Freedom, Memorie Proibite e la Grande Guerra;
 * le altre aspettano lì col loro nome già pronto.
 *
 * Lo stesso vale per i RITRATTI: un personaggio si aspetta
 * `images/characters/<id>.jpg`, e quelli che oggi sono segnaposto
 * generati (monogramma su pietra) si sostituiscono sovrascrivendo il
 * file con lo stesso nome.
 *
 * `x` e `y` sono la posizione della tappa sulla mappa, in px dentro il
 * mondo della campagna (`larghezza`/`altezza`). Sono scritti a mano, non
 * calcolati: un sentiero disegnato a mano racconta qualcosa (si sale
 * verso il castello, si torna indietro), una fila di pallini equidistanti
 * no.
 *
 * QUANDO LA CAMPAGNA HA LA SUA MAPPA DISEGNATA, le tappe si posano sui
 * LUOGHI VERI dell'immagine: il palazzo dove c'è il palazzo, il mago del
 * bosco nel bosco, il mare dov'è disegnato il mare. È la differenza fra
 * una mappa e uno sfondo — e si vede subito, perché il percorso smette di
 * essere una serpentina appoggiata sopra un disegno e diventa un viaggio
 * attraverso quel disegno. Memorie Proibite e la Grande Guerra sono
 * fatte così; per le altre vale quando arriva la loro mappa.
 *
 * Sulla Grande Guerra l'ancoraggio porta con sé anche l'ORDINE: i
 * capitoli seguono i fatti come successero all'esercito italiano
 * (Isonzo 1915, Strafexpedition 1916, Gorizia e la Bainsizza, Caporetto,
 * il Solstizio, Vittorio Veneto), e ogni tappa sta dove quel fatto
 * avvenne. Quando i due criteri esistono entrambi — la geografia e la
 * cronologia — è la cronologia a decidere in che ordine si gioca, la
 * geografia dove si clicca.
 *
 * Due conseguenze pratiche, entrambe volute:
 *   - DUE TAPPE POSSONO STARE VICINE, anche di capitoli diversi, se la
 *     storia ripassa dalle stesse parti (il palazzo nel primo capitolo e
 *     di nuovo nella Caduta, la fortezza oscura negli ultimi due). È la
 *     mappa a dettare dove si va, non una griglia;
 *   - il mondo deve avere lo STESSO RAPPORTO dell'immagine, altrimenti
 *     stenderla la deforma. Quando è arrivata la mappa di Memorie
 *     Proibite (16:9) il mondo era 1500x3400: è stato rifatto a
 *     3200x1800 e le tappe riposizionate. Conviene quindi partire
 *     dall'arte e disporci sopra le tappe, non il contrario.
 *
 * `avatar` su una TAPPA ({ idPersonaggio: 'percorso/immagine' }) cambia
 * l'aspetto di un personaggio solo lì: nella schermata e nei dialoghi del
 * duello e nelle battute della scena. Serve quando lo stesso personaggio ha
 * più versioni nel corso della storia (Kaiba nel Regno dei Duellanti non è
 * quello di Battle City). Senza, vale il ritratto del roster. Per i tornei
 * a sé lo stesso si dichiara in CHARACTER_IMAGE_VARIANTS (characters-db.js).
 *
 * `protagonista` è CHI SEI in quella campagna: nome e ritratto che
 * prendono il posto dei tuoi nel duello, nella cinematica di presentazione
 * e nella schermata finale. Serve perché in una storia non si gioca come
 * sé stessi — nel Regno delle Ombre sei Yami Yugi, in Memorie Proibite sei
 * Atem (il nome vero del Faraone, che nel gioco originale resta il
 * "Principe" solo perché l'ha dimenticato), in Freedom sei Giacobbo, e
 * nella Grande Guerra non sei una persona ma il Regio Esercito, che infatti
 * ha una bandiera al posto della faccia.
 *
 *     protagonista: { name: 'Atem', title: 'Il Faraone senza nome',
 *                     image: 'images/characters/yamiYugi.jpg', icon: '👑' }
 *
 * Facoltativo: una campagna che non lo dichiara lascia al giocatore il
 * proprio nome e il proprio ritratto, com'è sempre stato. Il campo lo legge
 * js/duel-session.js, che carica questo stesso file — una sola fonte, così
 * non si può disallineare da quello che la mappa mostra.
 *
 * Lo stesso campo si può mettere su un CAPITOLO, e lì vince su quello
 * della campagna per tutte le sue tappe. Serve quando dentro una sola
 * storia si cambia panni: in Memorie Proibite sei Atem per tutta la
 * campagna, ma nel capitolo del presente sei Yugi Muto — il Faraone è
 * chiuso nel Puzzle, e a duellare nel torneo è il ragazzo che l'ha
 * rimesso insieme.
 *
 * `musica` e `musicaDuello` sono la colonna sonora della campagna: la
 * prima suona sulla sua mappa (storia.html la mette con
 * DuelMusic.setTrack appena la campagna si apre, e rimette quella del
 * menu appena si torna all'elenco), la seconda accompagna OGNI duello
 * della campagna. Sono percorsi relativi a `audio/soundtracks/`, anche
 * dentro una sottocartella ('ww1/La carica del Piave.mp3'). Entrambe
 * facoltative: una campagna che non le dichiara suona come ha sempre
 * suonato il resto del gioco.
 *
 * `field`/`music` (STESSE chiavi) si possono mettere anche su un
 * CAPITOLO, e lì un nodo che non li dichiara eredita quelli del suo
 * capitolo — esattamente come `protagonista` qui sopra. Vince sempre
 * l'ordine tappa → capitolo → campagna (`music` di tappa/capitolo batte
 * `musicaDuello`, `field` di tappa/capitolo batte `campoDuello`).
 * Serve soprattutto quando un capitolo È un'intera area/macromappa (un
 * capitolo per area nella campagna 'anime', vedi il commento su
 * `capitoli` più sotto): basta scrivere `music` UNA volta sul capitolo
 * perché OGNI nodo di quell'area — inclusi quelli dentro le sue prove/
 * tappe annidate — la eredati, senza ripeterla su ciascuno. Risolto in
 * un punto solo (StoryProgress.getTappe/getProveConStato), mai da
 * ricalcolare altrove.
 *
 * `campoDuello` è l'arena di ogni duello della campagna che non ne
 * dichiara una propria (né la tappa né il suo capitolo). Può essere un
 * elenco: la tappa ne riceve una scelta in modo stabile dal suo id, così
 * rigiocandola si ritrova la stessa arena. Facoltativo.
 *
 * LIVELLI. Ogni campagna si gioca a Facile, Normale e Difficile, ognuno
 * col suo avanzamento, e la difficoltà di ogni duello è quella del
 * livello — il `difficulty` scritto sulle tappe allora NON conta (vedi
 * LIVELLI in js/story/story-progress.js). `senzaLivelli: true` spegne
 * tutto questo: una partita sola, e ogni duello alla difficoltà della sua
 * tappa. Serve alle campagne i cui mazzi non hanno tre versioni.
 *
 * `carteAmmesse` dice con QUALI carte si può giocare quella campagna:
 *   { origini: ['yu-gi-oh'] }                  solo carte Yu-Gi-Oh
 *   { origini: ['yu-gi-oh', 'fanmade'] }       anche le fanmade
 *   { origini: ['ww1'], fazione: 'italiana' }  solo il set WW1, e di un
 *                                              solo schieramento
 * Le origini sono quelle di CARD_ORIGIN_LABELS (js/data/cards-db.js); la
 * `fazione` è il campo aggiunto alle carte WW1, che distingue l'esercito
 * italiano da quello austro-ungarico. Serve perché una campagna
 * raccontata da una parte non si gioca con le carte dell'altra: al
 * Piave non si schierano i Kaiserjäger.
 *
 * Il controllo vero sta in StoryProgress.carteNonAmmesse (un punto solo,
 * js/story/story-progress.js), e la pagina lo usa per non far partire un
 * duello con un mazzo che quella campagna non accetta — dicendo quali
 * carte sono di troppo, non solo che "non si può".
 *
 * `chiId` su una scena aggancia chi parla a un personaggio del roster e
 * gli mette la faccia. È facoltativo apposta: molte voci non sono
 * nessuno in particolare ("La troupe", "Il Bollettino", "Il Comando
 * Supremo") e devono restare senza.
 *
 * AGGIUNGERE UNA CAMPAGNA non richiede di toccare nient'altro: basta una
 * voce in questo elenco. Una campagna con `capitoli: []` viene mostrata
 * bloccata con la sua descrizione — dichiararla e non poterla ancora
 * giocare è più onesto che far finta che non esista, ed è lo stato in
 * cui si trova oggi la sola Seconda Guerra Mondiale.
 */

/**
 * I due comandanti della Grande Guerra, protagonisti della campagna nella
 * successione storica: Luigi Cadorna fino all'8 novembre 1917, Armando
 * Diaz dal 9 novembre (dopo Caporetto) alla vittoria. Richiesta
 * dell'utente: si vede Cadorna, poi Diaz con l'avanzare della storia.
 *
 * NON sono Duellanti: non stanno in js/data/characters-db.js, quindi non
 * si affrontano mai e non compaiono in Duello Libero — sono solo il volto
 * di chi gioca. Definiti qui una volta sola perché la campagna li usa in
 * più punti (campagna, capitoli, la tappa del passaggio di comando).
 * I ritratti sono due fotografie storiche vere, di pubblico dominio
 * (Wikimedia Commons: "Luigi Cadorna 02.jpg", 1917, e "Armando Diaz
 * 01.jpg" di Mario Nunes Vais, ante 1929 — entrambe segnalate come
 * libere da restrizioni di copyright), ritagliate a quadrato 512×512
 * sullo stesso taglio busto/spalle degli altri ritratti del roster.
 */
const WW1_COMANDANTI = {
    cadorna: { name: 'Luigi Cadorna', title: 'Capo di Stato Maggiore, 1914-1917', image: 'images/characters/ww1_cadorna.jpg', icon: '🇮🇹' },
    diaz: { name: 'Armando Diaz', title: 'Capo di Stato Maggiore, 1917-1918', image: 'images/characters/ww1_diaz.jpg', icon: '🇮🇹' }
};

const storyCampaignsDatabase = [
    {
        id: 'anime',
        nome: 'Il Regno delle Ombre',
        sottotitolo: 'La storia di Yugi Muto',
        icona: '🧩',
        // La MAPPA DELLE MAPPE: sei isole sospese, una per area, collegate
        // da frecce nello stesso ordine della storia — Domino City, il
        // Castello di Pegasus, Battle City, il Mondo Virtuale, di nuovo
        // Battle City, l'Egitto. Ogni nodo sta sulla SUA isola. Il castello
        // non ha un nodo suo: è la seconda mappa DENTRO il Regno.
        //
        // La vecchia mappa a cinque isole (`storia_mappa_principale.jpg`)
        // NON è più fra i candidati, e non per dimenticanza: ha un altro
        // rapporto (1672x940 contro 1942x809), quindi se questa mancasse
        // e ricadesse su quella, i nodi posati per sei isole finirebbero
        // in mezzo al mare. Meglio l'arena generica qui sotto, che almeno
        // non finge di essere la mappa giusta.
        sfondo: [
            'images/maps/storia_mappa_principale_sei_isole.jpg',
            'images/fields/mobile/rovine_1.jpg'
        ],
        musica: '56. Battle for the Millennium.mp3',
        // A duellare non è Yugi: è l'altro, quello che si sveglia quando il
        // Puzzle è al collo. È tutto il punto della serie.
        protagonista: { name: 'Yami Yugi', title: 'Il Re dei Giochi', image: 'images/characters/yamiYugi.jpg', icon: '🧩' },
        descrizione: 'Dal giorno in cui Yugi completa il Puzzle del Millennio fino al Duello Cerimoniale: il Regno dei Duellanti, Battle City e tutto quello che c\'è in mezzo.',
        // Solo Yu-Gi-Oh: e' la storia del gioco vero, e un Bersagliere
        // in mezzo al Regno dei Duellanti la spezzerebbe.
        carteAmmesse: { origini: ['yu-gi-oh'] },
        // Il mondo ha le STESSE misure della mappa a sei isole (1942x809),
        // così le coordinate dei nodi sono pixel del disegno: stendere
        // un'arte panoramica su un mondo di altro rapporto la deformerebbe.
        // Vedi il commento sul rapporto in cima a questo file.
        larghezza: 1942,
        altezza: 809,
        // =============================================================
        // CINQUE AREE — SOLO LA PRIMA SERIE ORIGINALE
        // =============================================================
        // Richiesta esplicita dell'utente, dopo un primo giro a sette
        // aree: la Storia segue fedelmente SOLO il percorso della prima
        // serie animata — Il Regno dei Duellanti, Battle City Parte 1,
        // Il Mondo Virtuale (Noah, Gozaburo e i Big Five), Battle City
        // Parte 2, e il viaggio nel passato per la battaglia finale.
        // TOLTI rispetto al giro precedente: Il Risveglio dei Draghi
        // (Dartz/Orichalcos) e il Gran Premio KC (Zigfried/Leon) — pur
        // essendo andati in onda nella stessa serie giapponese, non sono
        // nell'elenco che l'utente ha chiesto, quindi restano fuori. I
        // sei personaggi che esistevano solo per quei due archi sono
        // stati tolti anche dal roster (vedi characters-db.js): senza
        // nessuna Storia/Torneo che li renda più sbloccabili sarebbero
        // rimasti bloccati per sempre in Duello Libero.
        //
        // Prima dei cinque archi c'è il PROLOGO a Domino City (il negozio
        // del nonno, la scuola, la torre della KaibaCorp): la prima isola
        // della mappa. Le sue prime cinque tappe stavano in testa al Regno
        // dei Duellanti — vedi `separazioni` qui sotto per come si porta
        // dietro il progresso di chi le aveva già giocate lì.
        //
        // Sono `kind: 'area'`, non `kind: 'torneo'`: stessa forma (mappa
        // propria + tappe proprie), ma senza la regola del torneo per cui
        // chi perde ricomincia dal primo incontro. Rispedire indietro di
        // dieci duelli chi ne perde uno trasformerebbe una storia in una
        // punizione — vedi SOTTOPERCORSI in js/story/story-progress.js.
        //
        // Ogni area dichiara la propria mappa col nome canonico
        // `images/maps/storia_anime_<area>.jpg`. Le cinque mappe sono
        // arrivate tutte insieme: il mondo di ogni area è stato portato alle
        // proporzioni del suo disegno (16:9 per Regno e Battle City, 3:2 per
        // Mondo Virtuale e Mondo dei Ricordi) e le tappe spostate IN
        // PROPORZIONE, così nessun disegno si deforma. In ogni area le
        // tappe stanno sui luoghi veri del disegno (ritoccabili a mano
        // dall'Editor Mappa). Battle
        // City ha due mappe DISTINTE (`_battlecity1`/`_battlecity2`),
        // perché la città vista prima e dopo il Mondo Virtuale è
        // narrativamente lo stesso posto ma un momento diverso della
        // storia — due arte diverse quando arriveranno, non un file
        // condiviso.
        //
        // Un capitolo per area, così la striscia dei capitoli in alto è
        // lo specchio dei nodi della mappa grande.
        capitoli: [
            {
                id: 'prologo',
                nome: 'Prologo: Domino City',
                field: 'images/fields/mobile/citta.jpg',
                testo: 'Il negozio del nonno, i banchi di scuola e una torre di vetro sul mare: tutto comincia a casa.',
                music: '02. Input Name.mp3',
                tappe: [
                    {
                        id: 'anime-area-prologo', kind: 'area', icona: '🧩',
                        label: 'Domino City', x: 190, y: 360,
                        nome: 'Prologo: Domino City',
                        testo: 'Otto anni su un puzzle, tre amici da convincere, e un Drago Bianco che Kaiba non doveva toccare.',
                        mappa: { sfondo: ['images/maps/storia_anime_prologo.jpg'], larghezza: 1672, altezza: 940 },
                        // Le PRIME CINQUE tappe qui sotto stavano in testa
                        // al Regno dei Duellanti prima che il prologo avesse
                        // un'isola sua: vedi `separazioni` in fondo alla
                        // campagna. Le tappe nate col prologo (la KaibaCorp)
                        // vanno sempre DOPO quelle cinque, mai in mezzo — è
                        // su quell'ordine che conta la migrazione.
                        //
                        // Ogni nodo sta su un luogo vero del disegno: il
                        // negozio di giochi con la tenda verde, la scuola
                        // col suo campo, il centro, il parco col laghetto,
                        // la sopraelevata e la torre della KaibaCorp.
                        tappe: [
                            {
                                id: 'anime-1-scena', kind: 'scene', icona: '🧩',
                                label: 'Otto anni dopo', x: 138, y: 600,
                                chi: 'Solomon Muto', chiId: 'solomonMuto',
                                testo: [
                                    { chi: 'yugiMuto', testo: 'Nonno, ce l’ho fatta! L’ultimo pezzo è andato al suo posto!' },
                                    { chi: 'solomonMuto', testo: 'Otto anni, Yugi. Otto anni su quel Puzzle, e nessuno prima di te era mai arrivato in fondo.' },
                                    { chi: 'yugiMuto', testo: 'Ogni volta che stavo per arrendermi pensavo a quello che dicono: che chi lo completa vede esaudito un desiderio.' },
                                    { chi: 'solomonMuto', testo: 'E tu cosa desideri?' },
                                    { chi: 'yugiMuto', testo: 'Degli amici, nonno. Degli amici veri.' },
                                    { chi: 'solomonMuto', testo: 'Allora tienilo stretto, quel Puzzle. E adesso vieni: ti insegno a giocare davvero a Duel Monsters.' }
                                ]
                            },
                            {
                                id: 'anime-1-allenamento-solomon', kind: 'duel', icona: '🎴',
                                label: 'Allenamento con il nonno', x: 198, y: 535,
                                parallelo: true, sbloccaDopo: 'anime-1-scena',
                                characterId: 'solomonMuto',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                field: 'images/fields/mobile/citta.jpg',
                                music: '07. Preliminary Face-Off.mp3',
                                dialogo: [
                                    { chi: 'solomonMuto', testo: 'Hai completato il Puzzle, ma prima di pensare ai misteri vediamo quanto ricordi di Duel Monsters.' },
                                    { io: true, testo: 'Va bene, nonno. Sarà soltanto un allenamento, ma proverò comunque a sorprenderti.' }
                                ]
                            },
                            {
                                id: 'anime-1-nonno', kind: 'scene', icona: '🎴',
                                label: 'Le regole del nonno', x: 262, y: 478,
                                chi: 'Solomon Muto', chiId: 'solomonMuto',
                                testo: [
                                    { chi: 'solomonMuto', testo: 'Hai giocato bene, Yugi. Ma ricordati una cosa: a Duel Monsters non vince la carta più forte. Vince chi crede nel proprio mazzo.' },
                                    { chi: 'yugiMuto', testo: 'Me lo ripeti da quando ero piccolo, nonno.' },
                                    { chi: 'solomonMuto', testo: 'E continuerò a farlo. Piuttosto, ha bussato il tuo amico Joey: vuole imparare le regole.' },
                                    { chi: 'yugiMuto', testo: 'Joey? Davvero? Allora lo aiuterò io!' },
                                    { chi: 'solomonMuto', testo: 'Bravo. Non prenderlo in giro quando sbaglia: aiutalo a costruire un mazzo che gli somigli.' },
                                    { chi: 'yugiMuto', testo: 'Nonno, quel Drago Bianco Occhi Blu nella teca… perché non l’hai mai venduto?' },
                                    { chi: 'solomonMuto', testo: 'Perché me l’ha affidato un amico, Yugi. Certe carte non hanno prezzo.' }
                                ]
                            },
                            {
                                id: 'anime-1-joey', kind: 'scene', icona: '🎲',
                                label: 'Un nuovo amico', x: 250, y: 262,
                                chi: 'Joey Wheeler', chiId: 'joey',
                                testo: [
                                    { chi: 'joey', testo: 'Yugi! Aspetta, ti devo parlare.' },
                                    { chi: 'yugiMuto', testo: 'Dimmi, Joey.' },
                                    { chi: 'joey', testo: 'All’inizio mi sono comportato da idiota, con te e con quel Puzzle. E tu mi hai difeso lo stesso, senza chiedere niente.' },
                                    { chi: 'yugiMuto', testo: 'Siamo amici, Joey. Gli amici fanno così.' },
                                    { chi: 'joey', testo: 'Allora fammi un favore da amico: insegnami a giocare. Voglio diventare un duellante vero.' },
                                    { chi: 'yugiMuto', testo: 'Va bene. Ma ti avverto: è più difficile di quel che sembra!' }
                                ]
                            },
                            {
                                id: 'anime-1-amichevole-joey', kind: 'duel', icona: '🎲',
                                label: 'Amichevole con Joey', x: 325, y: 245,
                                parallelo: true, sbloccaDopo: 'anime-1-joey',
                                characterId: 'joey',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                field: 'images/fields/mobile/citta.jpg',
                                music: '07. Preliminary Face-Off.mp3',
                                dialogo: [
                                    { chi: 'joey', testo: 'Conosco appena le regole, ma non imparerò mai se continuo soltanto a guardare. Facciamo un duello, Yugi.' },
                                    { io: true, testo: 'Cominciamo con calma. Ti spiegherò le mosse, ma non sceglierò le carte al posto tuo.' }
                                ]
                            },
                            {
                                id: 'anime-1-amichevole-tristan', kind: 'duel', icona: '🔧',
                                label: 'Amichevole con Tristan', x: 405, y: 270,
                                parallelo: true, sbloccaDopo: 'anime-1-amichevole-joey',
                                characterId: 'tristan',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                field: 'images/fields/mobile/citta.jpg',
                                music: '07. Preliminary Face-Off.mp3',
                                dialogo: [
                                    { chi: 'tristan', testo: 'Se Joey può imparare, posso riuscirci anch’io. Però niente strategie incomprensibili al primo turno.' },
                                    { io: true, testo: 'Ti mostrerò come costruire una combinazione semplice. Poi starà a te capire quando usarla.' }
                                ]
                            },
                            {
                                id: 'anime-1-amichevole-tea', kind: 'duel', icona: '💫',
                                label: 'Amichevole con Téa', x: 475, y: 310,
                                parallelo: true, sbloccaDopo: 'anime-1-amichevole-tristan',
                                characterId: 'tea',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                field: 'images/fields/mobile/citta.jpg',
                                music: '07. Preliminary Face-Off.mp3',
                                dialogo: [
                                    { chi: 'tea', testo: 'Non pensare che abbia accettato soltanto per fare numero. Le mie fate possono ancora sorprenderti.' },
                                    { io: true, testo: 'Non ti sottovaluterò. Un duello amichevole funziona soltanto se entrambi giochiamo seriamente.' }
                                ]
                            },
                            {
                                id: 'anime-1-tristan', kind: 'scene', icona: '🔧',
                                label: 'Il gruppo', x: 540, y: 352,
                                chi: 'Tristan Taylor', chiId: 'tristan',
                                testo: [
                                    { chi: 'tristan', testo: 'Allora, com’è andata la lezione? Joey ha capito la differenza fra un mostro e una Trappola?' },
                                    { chi: 'joey', testo: 'Ehi! Ho capito più di quanto pensi!' },
                                    { chi: 'tea', testo: 'Più o meno. Ha chiamato “Magia” una carta Mostro per tutto il pomeriggio.' },
                                    { chi: 'joey', testo: 'Sono dettagli!' },
                                    { chi: 'yugiMuto', testo: 'Joey impara in fretta, Tristan. Piuttosto, tocca a te: se vuoi imparare anche tu, ti insegno volentieri.' },
                                    { chi: 'tristan', testo: 'Ci sto. Ma io e Joey ci mettiamo sempre nei guai: se parti tu, partiamo tutti.' }
                                ]
                            },
                            {
                                id: 'anime-1-tea', kind: 'scene', icona: '💫',
                                label: 'L’altro Yugi', x: 655, y: 592,
                                chi: 'Téa Gardner', chiId: 'tea',
                                testo: [
                                    { chi: 'tea', testo: 'Yugi, posso farti una domanda strana? Da quando hai completato il Puzzle, a volte sembri un’altra persona.' },
                                    { chi: 'yugiMuto', testo: 'Lo so, Téa. Quando succede mi sento come se qualcuno mi tenesse per mano, e dopo non ricordo bene cos’è successo.' },
                                    { chi: 'tea', testo: 'Non mi fa paura. Quando Joey e Tristan erano nei guai, quella voce più sicura è comparsa a proteggerli.' },
                                    { chi: 'yugiMuto', testo: 'Forse c’è davvero qualcuno dentro al Puzzle. Prima o poi dovrò scoprire chi è.' },
                                    { chi: 'tea', testo: 'Lo scopriremo insieme. Non devi affrontarlo da solo.' }
                                ]
                            },
                            {
                                id: 'anime-1-regionale-rex', kind: 'duel', icona: '🏆',
                                // Nell'anime la finale regionale arriva DOPO il
                                // duello di Yugi con Kaiba (episodio 2): si apre
                                // da lì, non prima.
                                label: 'Finale regionale: Weevil contro Rex', x: 735, y: 275,
                                parallelo: true, sbloccaDopo: 'anime-1-kaiba',
                                characterId: 'rex',
                                protagonista: { name: 'Weevil Underwood', title: 'Campione regionale', image: 'images/characters/weevilUnderwood.jpg', icon: '🐛' },
                                dialogo: [
                                    { chi: 'rex', testo: 'I tuoi insetti verranno schiacciati dai miei dinosauri. Il titolo regionale è già mio.' },
                                    { io: true, testo: 'La forza non serve quando cade nella mia trappola. Questa finale farà conoscere a tutti il nome di Weevil Underwood.' }
                                ]
                            },
                            // --- La KaibaCorp: il primo duello della serie ---
                            // Nell'anime Kaiba si prende il Drago Bianco
                            // Occhi Blu del nonno battendolo a duello e lo
                            // strappa davanti a lui; Yugi lo sfida nella sua
                            // arena e lo batte con Exodia. È l'episodio 1, e
                            // il prologo senza questo duello non era un
                            // prologo.
                            {
                                id: 'anime-1-quarta-carta', kind: 'scene', icona: '🐉',
                                label: 'La quarta carta', x: 820, y: 420,
                                chi: 'Solomon Muto', chiId: 'solomonMuto',
                                testo: [
                                    { chi: 'yugiMuto', testo: 'Nonno, cos’è successo? Hai la faccia di chi ha visto un fantasma.' },
                                    { chi: 'solomonMuto', testo: 'Kaiba è venuto in negozio, Yugi. Ha riconosciuto subito il Drago Bianco Occhi Blu.' },
                                    { chi: 'yugiMuto', testo: 'E tu cos’hai risposto?' },
                                    { chi: 'solomonMuto', testo: 'Che non era in vendita, a nessun prezzo. Allora i suoi uomini mi hanno portato alla KaibaCorp e mi ha costretto a giocarmela in un duello.' },
                                    { chi: 'yugiMuto', testo: 'Non dirmi che…' },
                                    { chi: 'solomonMuto', testo: 'Ho perso. Adesso il quarto Drago Bianco è nelle sue mani, e non ha nessuna intenzione di conservarlo.' }
                                ]
                            },
                            {
                                id: 'anime-1-kaiba-scena', kind: 'scene', icona: '🏢',
                                // Kaiba con l'aspetto del Regno dei Duellanti
                                // (vedi `avatar` in cima al file).
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                label: 'La KaibaCorp', x: 1010, y: 522,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                music: '07. Preliminary Face-Off.mp3',
                                testo: [
                                    { chi: 'kaiba', testo: 'Ah, il nipotino. Ti sei fatto strada fin quassù per piangere sul latte versato?' },
                                    { io: true, testo: 'Mio nonno ti aveva detto che quella carta non era in vendita.' },
                                    { chi: 'kaiba', testo: 'E io l’ho presa lo stesso. Ne esistono quattro al mondo: tre sono mie, e una carta che potrebbe essere usata contro di me non deve esistere. L’ho strappata.' },
                                    { io: true, testo: 'Hai strappato molto più di una carta, Kaiba.' },
                                    { chi: 'kaiba', testo: 'Se vuoi rimediare, sali fino all’ultimo piano. Ti aspetto nella mia arena, con i miei ologrammi e il mio mazzo.' }
                                ]
                            },
                            {
                                id: 'anime-1-kaiba', kind: 'duel', icona: '🐉',
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                label: 'Seto Kaiba', x: 1425, y: 470,
                                characterId: 'kaiba',
                                field: 'images/fields/mobile/torreDeiDuelli.jpg',
                                music: '32. Seto Kaiba (Tournament Final) HD.mp3',
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Ho sconfitto tuo nonno e strappato il suo Drago Bianco. Ora i tre esemplari rimasti risponderanno soltanto a me.' },
                                    { io: true, testo: 'Le carte di mio nonno custodiscono il cuore di chi gliele ha affidate. Te lo dimostrerò in questo duello.' },
                                    // Exodia va nominata qui: è la carta con cui
                                    // Yugi vince questo duello, e Weevil la cita
                                    // sulla nave come cosa nota a tutti.
                                    { chi: 'kaiba', testo: 'Il mazzo del vecchio? Non c’è niente là dentro che possa fermare tre Draghi Bianchi.' },
                                    { io: true, testo: 'C’è una carta che nessuno è mai riuscito a evocare, Kaiba: Exodia il Proibito. Mio nonno me ne ha dato tutti e cinque i pezzi.' }
                                ]
                            },
                            // Il videonastro arriva a casa, nel negozio del
                            // nonno: il nodo sta lì, non sulla torre di Kaiba.
                            {
                                id: 'anime-1-pegasus-video', kind: 'duel', icona: '📼',
                                label: 'Il duello nel videonastro', x: 92, y: 690,
                                characterId: 'pegasus',
                                field: 'images/fields/mobile/torreCastelloPegasus.jpg',
                                music: "28. Heishin's Invasion.mp3",
                                dialogo: [
                                    { chi: 'pegasus', testo: 'Ti concedo quindici minuti, Yugi-boy. Il mio Occhio vede la tua mente e, allo scadere, reclamerò una ricompensa.' },
                                    { io: true, testo: 'Non so come tu abbia dato vita alle carte attraverso un videonastro, ma vincerò e scoprirò che cosa vuoi da me.' }
                                ]
                            },
                            // Nell'anime questo duello Yugi lo perde allo
                            // scadere del tempo, e il nonno ci rimette l'anima.
                            // Qui il duello si vince: la scena racconta la
                            // svolta, che è quella vera — il tempo era già
                            // finito, e Pegasus aveva più Life Point.
                            {
                                id: 'anime-1-tempo-scaduto', kind: 'scene', icona: '⏳',
                                label: 'Tempo scaduto', x: 205, y: 712,
                                chi: 'Maximillion Pegasus', chiId: 'pegasus',
                                testo: [
                                    { chi: 'pegasus', testo: 'Bravo, Yugi-boy, che attacco! Peccato che sia arrivato a tempo scaduto. Allo scoccare dei quindici minuti avevo io più Life Point, e le regole sono regole.' },
                                    { io: true, testo: 'Cosa vuol dire? Il duello l’ho vinto io!' },
                                    { chi: 'pegasus', testo: 'Il duello sì. La sfida a tempo, no. E chi perde paga: guarda alle tue spalle.' },
                                    { testo: 'Dallo schermo esce una luce. Il nonno si irrigidisce sulla sedia, e la sua anima si stacca dal corpo per finire dentro il televisore.' },
                                    { chi: 'yugiMuto', testo: 'Nonno! NONNO! Rispondimi!' },
                                    { chi: 'pegasus', testo: 'Se lo rivuoi, vieni a prenderlo. Ti aspetto nel Regno dei Duellanti.' }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'regno',
                nome: 'Il Regno dei Duellanti',
                field: 'images/fields/mobile/arenaRegnoDeiDuellanti.jpg',
                music: '19. Forest Shrine.mp3',
                testo: 'Un invito, un nonno chiuso dentro una videocassetta, e un\'isola intera fra te e il castello di Pegasus.',
                tappe: [
                    {
                        id: 'anime-area-regno', kind: 'area', icona: '🏝️',
                        label: 'Il Regno dei Duellanti', x: 590, y: 312,
                        nome: 'Il Regno dei Duellanti',
                        testo: 'Due Stelle dell\'Esagono alla partenza, dieci per entrare nel castello: sull\'isola ogni duello avvicina Yugi a Pegasus e all\'anima di suo nonno.',
                        // DUE MAPPE in un'area sola (vedi `mappeSuccessive`
                        // in js/story/story-progress.js): prima l'isola, poi,
                        // battuto Kaiba al cancello, gli interni del
                        // castello. Resta un percorso unico — una voce nella
                        // striscia dei capitoli, un nodo sulla mappa grande —
                        // perché è un unico torneo: il castello è dove
                        // finisce, non un posto nuovo.
                        mappa: { nome: 'L\'isola di Pegasus', sfondo: ['images/maps/storia_anime_regno.jpg'], larghezza: 1672, altezza: 941 },
                        mappeSuccessive: [
                            {
                                daTappa: 'anime-2c-scena',
                                nome: 'Il Castello di Pegasus',
                                testo: 'Oltre il cancello le Stelle non servono più: restano quattro finalisti, e un padrone di casa che legge nel pensiero.',
                                sfondo: ['images/maps/storia_anime_castello_pegasus.jpg'], larghezza: 1672, altezza: 941,
                                // Sull'isola il passaggio è il portone del
                                // castello, in cima alla scalinata dove
                                // aspetta Kaiba; dentro, è la scalinata
                                // esterna disegnata in alto a sinistra.
                                uscita: { x: 970, y: 215, icona: '🏰', label: 'Il Castello' },
                                ingresso: { x: 215, y: 105, icona: '🏝️', label: 'Torna sull\'isola' }
                            }
                        ],
                        // I nodi stanno sulle arene disegnate sull'isola: si
                        // sbarca al molo, si gira l'isola da un'arena
                        // all'altra e si sale al castello per la scalinata.
                        tappe: [
                            {
                                id: 'anime-2-scena', kind: 'scene', icona: '🏝️',
                                label: 'L\'invito', x: 1335, y: 378,
                                chi: 'Maximillion Pegasus', chiId: 'pegasus',
                                testo: [
                                    { chi: 'pegasus', testo: 'Buonasera, Yugi-boy. Il tuo caro nonno è qui con me: la sua anima riposa al sicuro dentro una carta, e solo io posso restituirgliela.' },
                                    { io: true, testo: 'Pegasus… che cosa vuoi da noi?' },
                                    { chi: 'pegasus', testo: 'Un duello. Il Regno dei Duellanti ti aspetta, e io sarò in fondo al torneo. Se mi batterai, riavrai tuo nonno.' },
                                    { io: true, testo: 'Vengo sull’isola. E ti batterò.' },
                                    { chi: 'joey', testo: 'Un attimo, Yugi! Io vengo con te. Il premio del torneo servirà a pagare l’operazione agli occhi di mia sorella Serenity.' },
                                    { chi: 'tea', testo: 'E noi due non ti lasciamo andare da solo, vero Tristan?' },
                                    { chi: 'tristan', testo: 'Neanche a parlarne. Se serve, ci imbarchiamo di nascosto.' }
                                ]
                            },
                            {
                                id: 'anime-2-viaggio', kind: 'scene', icona: '🚢',
                                label: 'Verso il Regno', x: 1515, y: 455,
                                chi: 'Joey Wheeler', chiId: 'joey',
                                testo: [
                                    { chi: 'weevil', testo: 'Fammi vedere queste famose carte di Exodia, Yugi. Dicono che con quelle tu abbia battuto Kaiba.' },
                                    { io: true, testo: 'Eccole. Ma stai attento, sono tutto quello che ho.' },
                                    { chi: 'weevil', testo: 'Davvero? Peccato per te. Ops… mi sono scivolate di mano.' },
                                    { chi: 'joey', testo: 'Quel verme! Le ha buttate in mare! Yugi, ci penso io!' },
                                    { io: true, testo: 'Joey, aspetta! Le onde se le sono già portate via…' },
                                    { chi: 'pegasus', testo: 'Benvenuti nel Regno dei Duellanti! Ogni duellante riceve due Stelle dell’Esagono, e dieci Stelle vi apriranno il cancello del mio castello. Il terreno modificherà i vostri mostri. Che il torneo cominci.' },
                                    { chi: 'weevil', testo: 'Senza Exodia sei finito, Yugi. Ti aspetto nella foresta.' }
                                ]
                            },
                            {
                                id: 'anime-2-weevil', kind: 'duel', icona: '🐛',
                                label: 'Weevil Underwood', x: 1420, y: 548,
                                characterId: 'weevil',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'weevil', testo: 'Senza Exodia e dentro una foresta che potenzia i miei insetti, la tua fama finirà al primo duello.' },
                                    { io: true, testo: 'Hai gettato le mie carte in mare per paura di affrontarle. Vincerò con quelle che mi sono rimaste.' }
                                ]
                            },
                            {
                                id: 'anime-2-mai-primo', kind: 'duel', icona: '🦋',
                                label: 'Joey contro Mai', x: 1260, y: 610,
                                parallelo: true, sbloccaDopo: 'anime-2-weevil',
                                characterId: 'mai',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Joey Wheeler', title: 'Il duellante alle prime armi', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'mai', testo: 'Non ho bisogno di vedere le mie carte: profumo diverso, scelta perfetta. Un principiante non può capirlo.' },
                                    { io: true, testo: 'Forse sono un principiante, ma non sono venuto fin qui per farmi mandare a casa al primo duello.' }
                                ]
                            },
                            {
                                id: 'anime-2-rex', kind: 'duel', icona: '🦖',
                                label: 'Rex Raptor', x: 1108, y: 645,
                                parallelo: true, sbloccaDopo: 'anime-2-mai-primo',
                                characterId: 'rex',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Joey Wheeler', title: 'Il duellante dal cuore indomabile', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    // È il duello in cui Joey vince il suo Drago
                                    // Nero Occhi Rossi: da qui in poi è la carta
                                    // di Joey, e la storia la nomina come tale.
                                    { chi: 'rex', testo: 'Metto in palio il mio Drago Nero Occhi Rossi, la carta più rara della mia collezione. Tanto non lo vedrai mai dalla tua parte del campo.' },
                                    { io: true, testo: 'Allora tienilo stretto, Rex. Duello per arrivare da Serenity con il premio, e quel drago mi servirà per arrivarci.' }
                                ]
                            },
                            {
                                id: 'anime-2-mako', kind: 'duel', icona: '🌊',
                                label: 'Mako Tsunami', x: 798, y: 785,
                                characterId: 'mako',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'mako', testo: 'Questo mare mi ha cresciuto. Se vuoi passare, dovrai battermi dove la marea combatte al mio fianco.' },
                                    { io: true, testo: 'Non sono venuto a portarti via il mare. Sono venuto a riprendermi mio nonno.' }
                                ]
                            },
                            {
                                id: 'anime-2-bonz', kind: 'duel', icona: '🪦',
                                label: 'Joey contro Bonz', x: 925, y: 705,
                                parallelo: true, sbloccaDopo: 'anime-2-rex',
                                characterId: 'bonz',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Joey Wheeler', title: 'Il duellante dal cuore indomabile', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'bonz', testo: 'Nel cimitero i miei mostri tornano come zombie più forti. Quando avremo le tue Stelle, Keith ci farà entrare nel castello.' },
                                    { io: true, testo: 'Keith vi sta usando e poi vi abbandonerà. Prima uscirò da questa caverna, cominciando dal tuo Re dei Fantasmi.' }
                                ]
                            },
                            {
                                id: 'anime-2-notte', kind: 'scene', icona: '🔥',
                                label: 'Le Stelle di Mai', x: 555, y: 755,
                                chi: 'Mai Valentine', chiId: 'mai',
                                testo: [
                                    { chi: 'mai', testo: 'Non mi servono le tue condoglianze, ragazzino. Panik mi ha trascinata nel buio della sua arena, e ho perso tutte le mie Stelle.' },
                                    { io: true, testo: 'Chi è, quel Panik?' },
                                    { chi: 'mai', testo: 'Uno degli Eliminatori di Pegasus. Non gioca per arrivare al castello: è lì per cacciare dall’isola chi si avvicina troppo.' },
                                    { io: true, testo: 'Allora lo sconfiggerò e ti restituirò le tue Stelle.' },
                                    { chi: 'mai', testo: 'Non te l’ho chiesto, Yugi. Ma non posso lasciarti andare da lui senza dirti cosa ti aspetta: là dentro la paura gioca contro di te prima ancora delle carte.' },
                                    { io: true, testo: 'Grazie dell’avvertimento. La paura non mi fermerà.' }
                                ]
                            },
                            {
                                id: 'anime-2-panik', kind: 'duel', icona: '🕯️',
                                label: 'Panik', x: 308, y: 655,
                                characterId: 'panik',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'panik', testo: 'Ho già tolto a Mai tutte le sue Stelle. Nella mia arena buia perderai anche il coraggio di guardare il campo.' },
                                    { io: true, testo: 'La paura è l’unica strategia che possiedi. Riconquisterò le Stelle di Mai e distruggerò il tuo Castello delle Illusioni Oscure.' }
                                ]
                            },
                            {
                                id: 'anime-2-mai-panik', kind: 'duel', icona: '🕯️',
                                // Nell'anime è Panik a vincere (Mai perde tutte le
                                // Stelle, ed è da lì che parte "Le Stelle di
                                // Mai"): si gioca dalla sua parte, come ogni
                                // laterale in cui il canone dà la vittoria
                                // all'avversario del personaggio più noto.
                                label: 'Panik contro Mai', x: 235, y: 570,
                                parallelo: true, sbloccaDopo: 'anime-2-mako',
                                characterId: 'mai',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Panik', title: 'Eliminatore di Pegasus', image: 'images/characters/panik.jpg', icon: '🕯️' },
                                dialogo: [
                                    { chi: 'mai', testo: 'Non ho bisogno di vedere il tuo volto per capire che vivi d’intimidazione. Le mie Arpie non si piegheranno.' },
                                    { io: true, testo: 'Nel buio non vedrai i miei mostri crescere. Quando la paura avrà vinto, prenderò tutte le tue Stelle.' }
                                ]
                            },
                            {
                                id: 'anime-2-kaiba-joey', kind: 'duel', icona: '🐉',
                                label: 'Kaiba contro Joey', x: 430, y: 545,
                                parallelo: true, sbloccaDopo: 'anime-2-panik',
                                characterId: 'joey',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Seto Kaiba', title: 'In cerca di Mokuba', image: 'images/characters/setoKaiba_duelist_Kingdom.png', icon: '🐉' },
                                dialogo: [
                                    { chi: 'joey', testo: 'Non passerai sopra di noi come se non esistessimo. Il mio Drago Nero affronterà il tuo Drago Bianco.' },
                                    { io: true, testo: 'Se vuoi misurarti con me, Wheeler, preparati a scoprire la differenza fra un dilettante e un campione.' }
                                ]
                            },
                            {
                                id: 'anime-2-bakura-isola', kind: 'duel', icona: '💍',
                                label: 'Il Gioco delle Ombre di Bakura', x: 485, y: 430,
                                characterId: 'bakura',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'bakura', testo: 'Ho rinchiuso le vostre anime nelle carte preferite. Se perdo Life Point, sarete voi a pagarne il prezzo.' },
                                    { io: true, testo: 'Lo spirito dell’Anello ha preso il corpo di Bakura. Useremo le carte in cui siamo imprigionati per salvarlo senza sacrificarci.' }
                                ]
                            },
                            {
                                id: 'anime-2-falso-kaiba', kind: 'duel', icona: '👻',
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                label: 'Il fantasma di Kaiba', x: 610, y: 390,
                                characterId: 'kaiba',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    // Mokuba era con Yugi quella notte: è da lì
                                    // che si allea con lui (episodi 8-10).
                                    { chi: 'mokuba', testo: 'Quello non è mio fratello, Yugi! Seto non si comporterebbe mai così. Ti prego, battilo!' },
                                    { nome: 'Imitatore di Kaiba', icona: '👻', testo: 'Pegasus mi ha dato il mazzo di Kaiba e una parte della sua mente. Affronterai di nuovo i suoi tre Draghi Bianchi.' },
                                    { io: true, testo: 'Non sei Kaiba: imiti le sue carte senza comprenderne l’orgoglio. Libererò ciò che resta della sua anima da questo duello.' }
                                ]
                            },
                            {
                                id: 'anime-2-mai', kind: 'scene', icona: '🐉',
                                label: 'Kaiba sull’isola', x: 368, y: 335,
                                chi: 'Mokuba Kaiba', chiId: 'mokuba',
                                testo: [
                                    { chi: 'tea', testo: 'Yugi, hai visto? Kaiba è sbarcato sull’isola con un elicottero!' },
                                    { chi: 'joey', testo: 'Eccome se l’ho visto. Mi ha battuto senza nemmeno spettinarsi, quel…' },
                                    { chi: 'tristan', testo: 'Cerca Pegasus. Gli ha preso Mokuba, e vuole la KaibaCorp.' },
                                    { io: true, testo: 'Anche noi dobbiamo arrivare al castello. Ci servono dieci Stelle.' },
                                    { chi: 'joey', testo: 'E la strada passa sotto il castello, nelle grotte. Pegasus ci ha messo dei guardiani.' },
                                    { io: true, testo: 'Allora attraverseremo anche quelle, tutti insieme.' }
                                ]
                            },
                            {
                                id: 'anime-2-keith', kind: 'scene', icona: '🪦',
                                label: 'Sotto il cimitero', x: 748, y: 215,
                                chi: 'Joey Wheeler', chiId: 'joey',
                                testo: [
                                    { chi: 'joey', testo: 'Quel Bonz e i suoi scagnozzi mi hanno fregato le Stelle, e ci hanno chiusi qui sotto, nelle grotte del cimitero.' },
                                    { chi: 'tristan', testo: 'Dietro c’è Bandit Keith: manda gli altri a rubare, e intanto aspetta che gli portino quello che serve per entrare nel castello.' },
                                    { io: true, testo: 'Quello è un truffatore. Troviamo un’uscita.' },
                                    { chi: 'joey', testo: 'Ce n’è una, ma Pegasus l’ha affidata ai Fratelli Paradosso. Vogliono tutte le nostre Stelle, in un unico duello a coppie.' },
                                    { io: true, testo: 'Allora lo affronteremo insieme, Joey. Io e te.' },
                                    { chi: 'joey', testo: 'Ci sto! Entriamo nel loro labirinto e usciamo dalla porta giusta.' }
                                ]
                            },
                            {
                                id: 'anime-2-paradox', kind: 'duel', icona: '🚪',
                                label: 'I Fratelli Paradosso', x: 830, y: 275,
                                characterId: 'paradoxBrothers',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'paradoxBrothers', testo: 'Una porta conduce al castello, l’altra di nuovo nel labirinto. Prima, però, superate il Guardiano del Cancello.' },
                                    { io: true, testo: 'Joey ed io metteremo in comune mostri e strategie. Il vostro labirinto non dividerà ciò che ci ha portati fin qui.' }
                                ]
                            },
                            {
                                id: 'anime-2-stelle', kind: 'scene', icona: '⭐',
                                label: 'L’uscita dal labirinto', x: 895, y: 255,
                                chi: 'Joey Wheeler', chiId: 'joey',
                                testo: [
                                    { chi: 'joey', testo: 'Ce l’abbiamo fatta, Yugi! I Fratelli Paradosso erano duri, ma combinando i nostri mostri abbiamo trovato la porta giusta.' },
                                    { io: true, testo: 'Insieme siamo più forti di qualunque labirinto, Joey.' },
                                    { chi: 'joey', testo: 'Adesso abbiamo tutti e due dieci Stelle. Possiamo entrare nel castello!' },
                                    { chi: 'tea', testo: 'Aspettate… guardate, sulla scalinata. C’è qualcuno.' },
                                    { chi: 'kaiba', testo: 'Fermi. Pegasus tiene prigioniero Mokuba, e per sfidarlo mi servono le Stelle. Le tue, Yugi.' },
                                    { io: true, testo: 'Anch’io devo entrare per salvare mio nonno, Kaiba. Nessuno dei due può rinunciare.' }
                                ]
                            },
                            // Kaiba sbarra la scalinata del castello: batterlo
                            // apre il portone, e con lui la seconda mappa.
                            {
                                id: 'anime-2-kaiba', kind: 'duel', icona: '🐉',
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                label: 'Seto Kaiba', x: 1030, y: 330,
                                characterId: 'kaiba',
                                music: "32. Seto Kaiba (Tournament Final) HD.mp3",
                                field: 'images/fields/mobile/torreCastelloPegasus.jpg',
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Pegasus tiene prigioniero Mokuba. Mi servono le tue Stelle per entrare nel castello e riprendermelo.' },
                                    { io: true, testo: 'Anch’io devo entrare per salvare mio nonno, Kaiba. Nessuno dei due può rinunciare a questo duello.' }
                                ]
                            },
                            // Nell'anime questo duello Yugi lo PERDE: stava per
                            // vincere, ma Kaiba sale sul parapetto e Yugi ferma
                            // l'ultimo attacco per non farlo cadere. Il duello
                            // qui si vince, e la scena racconta quella scelta.
                            {
                                id: 'anime-2-kaiba-torre', kind: 'scene', icona: '🏰',
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                // Sulla torre destra del castello, dove si
                                // gioca il duello nell'anime.
                                label: 'Sul parapetto', x: 1055, y: 200,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { chi: 'kaiba', testo: 'Avanti, attacca. Ma sappi che se il mio ologramma viene distrutto, cado anch’io: sono sul bordo del parapetto, e non mi sposterò.' },
                                    { io: true, testo: 'Sei impazzito? Scendi da lì, Kaiba!' },
                                    { chi: 'yugiMuto', testo: 'Fermati! Se attacchi, Kaiba precipita! Non è questo il modo di vincere!' },
                                    { testo: 'Il colpo finale non parte. Yugi riprende il controllo del Puzzle e abbassa la mano: il duello finisce lì, e la vittoria va a Kaiba.' },
                                    { chi: 'kaiba', testo: 'Metà delle tue Stelle sono mie. Pegasus mi aspetta.' },
                                    { chi: 'tea', testo: 'Yugi… hai fatto la cosa giusta. Le Stelle che ti mancano le recupero io.' }
                                ]
                            },
                            {
                                id: 'anime-2-tea-mai', kind: 'duel', icona: '💫',
                                label: 'Téa contro Mai', x: 1110, y: 285,
                                parallelo: true, sbloccaDopo: 'anime-2-kaiba-torre',
                                characterId: 'mai',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Téa Gardner', title: 'Amica di Yugi', image: 'images/characters/teaGardner.jpg', icon: '💫' },
                                dialogo: [
                                    { chi: 'mai', testo: 'Yugi ha perso le Stelle contro Kaiba. Se vuoi conquistargliele, dovrai affrontare le mie Lady Arpia.' },
                                    { io: true, testo: 'Non sono una finalista, ma non lascerò che il viaggio di Yugi finisca ai cancelli del castello.' }
                                ]
                            },
                            // --- Seconda mappa: gli interni del castello ---
                            // Si entra dalla scalinata esterna in alto a
                            // sinistra, la semifinale si gioca nell'arena al
                            // centro, Pegasus aspetta nella sala del trono.
                            // Pegasus chiudeva l'isola prima che il castello
                            // avesse una mappa: le due tappe nate col castello
                            // gli stanno DAVANTI (vedi `separazioni`).
                            {
                                id: 'anime-2c-scena', kind: 'scene', icona: '🏰',
                                label: 'Il cancello si apre', x: 170, y: 300,
                                chi: 'Croquet',
                                testo: [
                                    { nome: 'Croquet', testo: 'Congratulazioni. Siete arrivati al cancello in quattro, con le Stelle dell’Esagono al completo.' },
                                    { chi: 'mai', testo: 'Quattro finalisti: Yugi, Joey, Keith e io. Mi sembra una compagnia interessante.' },
                                    { nome: 'Croquet', testo: 'Il signor Pegasus vi aspetta per le finali. Stanotte dormirete nel castello, e domani si duella nell’arena al piano di sotto.' },
                                    { chi: 'joey', testo: 'E gli abbinamenti li decidete voi?' },
                                    { nome: 'Croquet', testo: 'Li decide il caso, come ogni cosa sotto questo tetto. O quasi. Una cortesia: non girate per i corridoi di notte.' },
                                    { io: true, testo: 'E Kaiba? È entrato prima di noi.' },
                                    { nome: 'Croquet', testo: 'Il signor Kaiba ha sfidato il padrone di casa questo pomeriggio. Ha perso, e la sua anima è rimasta in una carta. Non lo vedrete a cena.' }
                                ]
                            },
                            // Kaiba contro Pegasus si gioca DENTRO il castello,
                            // in una delle sale (episodi 26-27). Nell'anime vince
                            // Pegasus, e Kaiba ci perde l'anima: si gioca dalla
                            // parte di chi ha vinto.
                            {
                                id: 'anime-2-kaiba-pegasus', kind: 'duel', icona: '👁️',
                                avatar: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
                                label: 'Pegasus contro Kaiba', x: 1190, y: 175,
                                parallelo: true, sbloccaDopo: 'anime-2c-scena',
                                characterId: 'kaiba',
                                field: 'images/fields/mobile/arenaCastelloPegasus.jpg',
                                music: "36. Heishin.mp3",
                                protagonista: { name: 'Maximillion Pegasus', title: 'Il padrone del castello', image: 'images/characters/maximillionPegasus.jpg', icon: '👁️' },
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Non mi interessa come leggi la mente, Pegasus. Libererai Mokuba quando i miei Draghi Bianchi avranno distrutto i tuoi Toon.' },
                                    { io: true, testo: 'Mokuba e la KaibaCorp saranno miei, Kaiba-boy. Con l’Occhio del Millennio conosco già ogni carta che giocherai.' }
                                ]
                            },
                            // Nell'anime la semifinale di Yugi è contro Mai,
                            // una seconda volta dopo il duello sull'isola.
                            {
                                id: 'anime-2c-mai', kind: 'duel', icona: '🦋',
                                label: 'Semifinale: Mai', x: 830, y: 450,
                                characterId: 'mai',
                                field: 'images/fields/mobile/arenaCastelloPegasus.jpg',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'mai', testo: 'Mi hai restituito le Stelle senza chiedere nulla. Proprio per questo, in semifinale non accetterò che tu ti trattenga.' },
                                    { io: true, testo: 'Ti affronterò come la duellante che ha conquistato questo posto. Il nostro duello deciderà chi continuerà.' }
                                ]
                            },
                            {
                                id: 'anime-2c-keith', kind: 'duel', icona: '🇺🇸',
                                label: 'Semifinale: Bandit Keith', x: 975, y: 450,
                                parallelo: true, sbloccaDopo: 'anime-2c-scena',
                                characterId: 'bandit_keith',
                                field: 'images/fields/mobile/arenaCastelloPegasus.jpg',
                                music: "34. Mages Duel.mp3",
                                protagonista: { name: 'Joey Wheeler', title: 'Finalista del Regno dei Duellanti', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'bandit_keith', testo: 'Ho rubato la tua carta d’ingresso. Senza Gloria della Mano del Re non puoi nemmeno sederti al tavolo.' },
                                    { io: true, testo: 'Mai mi ha dato la sua prima di andarsene. Ora resta solo il duello, Keith: niente scagnozzi e niente carte nascoste nel polsino.' }
                                ]
                            },
                            {
                                id: 'anime-2c-joey', kind: 'duel', icona: '🎲',
                                label: 'Finale: Joey Wheeler', x: 902, y: 385,
                                characterId: 'joey',
                                field: 'images/fields/mobile/arenaCastelloPegasus.jpg',
                                music: "34. Mages Duel.mp3",
                                dialogo: [
                                    { chi: 'joey', testo: 'Siamo arrivati in finale insieme, Yugi. Adesso niente favori: voglio vedere quanto sono cresciuto davvero.' },
                                    { io: true, testo: 'È proprio perché siamo amici che duellerò con tutto ciò che ho. Il vincitore affronterà Pegasus.' }
                                ]
                            },
                            {
                                id: 'anime-2-pegasus', kind: 'duel', icona: '👁️',
                                label: 'Maximillion Pegasus', x: 905, y: 165,
                                characterId: 'pegasus',
                                field: 'images/fields/mobile/arenaCastelloPegasus.jpg',
                                music: "57. Duel of Shadows – The Millennium Mind.mp3",
                                dialogo: [
                                    { chi: 'pegasus', testo: 'Il mio Occhio del Millennio vede ogni carta nella tua mente, Yugi-boy. Toon World farà il resto.' },
                                    { io: true, testo: 'Non duello da solo. Alterneremo le nostre menti e combatteremo insieme per liberare nonno, Mokuba e Kaiba.' }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'battlecity1',
                nome: 'Battle City - Parte 1',
                field: 'images/fields/mobile/citta.jpg',
                music: '04. Modern Times.mp3',
                testo: 'Kaiba apre la città, e fra gli iscritti c\'è chi non è venuto per il torneo.',
                tappe: [
                    {
                        id: 'anime-area-battlecity1', kind: 'area', icona: '🏙️',
                        label: 'Battle City - Parte 1', x: 865, y: 360,
                        nome: 'Battle City - Parte 1',
                        testo: 'Sei Carte Localizzatrici per arrivare alle finali, e tre Dei Egizi che non dovrebbero esistere.',
                        mappa: { sfondo: ['images/maps/storia_anime_battlecity1.jpg'], larghezza: 1672, altezza: 941 },
                        tappe: [
                            {
                                id: 'anime-3-scena', kind: 'scene', icona: '🏙️',
                                label: 'Domino City', x: 180, y: 780,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { chi: 'kaiba', testo: 'Ascoltate bene, duellanti di Domino City. Battle City è aperta: si duella per strada, col Duel Disk, e chi perde cede la propria carta migliore.' },
                                    { chi: 'mokuba', testo: 'Per accedere alle finali servono sei Carte Localizzatrici: messe insieme, dicono dove si terrà la fase finale!' },
                                    { chi: 'kaiba', testo: 'Chi ne ha meno non arriva alle finali, e basta. Ho aperto io le iscrizioni, e non per generosità.' },
                                    { io: true, testo: 'C’è qualcosa che vuoi far uscire allo scoperto, vero?' },
                                    { chi: 'kaiba', testo: 'Tre Dei Egizi, Yugi. Uno ce l’ho io. Gli altri due li voglio.' }
                                ]
                            },
                            {
                                id: 'anime-3-tavola-scena', kind: 'scene', icona: '🗿',
                                label: 'La tavola del Faraone', x: 260, y: 610,
                                chi: 'Ishizu Ishtar', chiId: 'ishizu',
                                testo: [
                                    { chi: 'ishizu', testo: 'Ti ho portato al museo per mostrarti questa tavola. Guarda: un Faraone senza nome che duella contro un sacerdote.' },
                                    { io: true, testo: 'Quel sacerdote somiglia a Kaiba…' },
                                    { chi: 'ishizu', testo: 'Sì. E sopra di loro ci sono i tre Dei Egizi. Mio fratello Marik ne ha sottratti due, e guida i Cacciatori Rari.' },
                                    { io: true, testo: 'E Obelisk, la terza carta?' },
                                    { chi: 'ishizu', testo: 'Ce l’ha Kaiba: gliel’ho affidata io. Sapevo che il suo desiderio di riunire gli Dei avrebbe dato inizio a Battle City.' },
                                    { chi: 'ishizu', testo: 'Entra nel torneo, Faraone. Recupera le altre carte e ferma Marik: solo allora la porta dei tuoi ricordi potrà aprirsi.' }
                                ]
                            },
                            {
                                id: 'anime-3-seeker', kind: 'duel', icona: '🕶️',
                                label: 'Seeker', x: 350, y: 700,
                                characterId: 'seeker',
                                music: '30. Preliminaries.mp3',
                                dialogo: [
                                    { chi: 'seeker', testo: 'Joey ha già perso il suo Drago Nero Occhi Rossi. Adesso scommetti il Mago Nero: Exodia vuole una preda più rara.' },
                                    { io: true, testo: 'Le carte contraffatte non fanno di te un duellante. Libererò il Drago Nero e fermerò la tua caccia.' }
                                ]
                            },
                            {
                                id: 'anime-3-joey-seeker', kind: 'duel', icona: '🕶️',
                                // Nell'anime Seeker batte Joey e gli prende il
                                // Drago Nero Occhi Rossi (è per questo che poi
                                // Yugi lo sfida): si gioca dalla parte di Seeker.
                                label: 'Seeker contro Joey', x: 405, y: 765,
                                parallelo: true, sbloccaDopo: 'anime-3-tavola-scena',
                                characterId: 'joey',
                                music: '30. Preliminaries.mp3',
                                protagonista: { name: 'Seeker', title: 'Cacciatore Raro', image: 'images/characters/seeker.jpg', icon: '🕶️' },
                                dialogo: [
                                    { chi: 'joey', testo: 'Il Drago Nero Occhi Rossi non è merce per i Cacciatori Rari. Ti batterò prima che tu possa mettere insieme tutti i pezzi.' },
                                    { io: true, testo: 'Le mie carte completeranno Exodia prima che tu possa reagire. Il tuo Drago Nero, ragazzino, è già nella collezione di Marik.' }
                                ]
                            },
                            {
                                id: 'anime-3-espa', kind: 'duel', icona: '🔮',
                                label: 'Espa Roba', x: 510, y: 610,
                                parallelo: true, sbloccaDopo: 'anime-3-seeker',
                                characterId: 'espaRoba',
                                music: '30. Preliminaries.mp3',
                                protagonista: { name: 'Joey Wheeler', title: 'Duellante di Battle City', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'espaRoba', testo: 'I miei poteri extrasensoriali mi mostrano ogni carta che hai in mano. Jinzo metterà a tacere le tue Trappole.' },
                                    { io: true, testo: 'I tuoi fratelli stanno spiando le mie carte dai tetti. Batterò i tuoi trucchi e conquisterò Jinzo secondo le regole di Battle City.' }
                                ]
                            },
                            {
                                id: 'anime-3-mako-joey', kind: 'duel', icona: '🌊',
                                // Dopo Strings, come nell'anime (episodi 19-20).
                                label: 'Joey contro Mako', x: 565, y: 500,
                                parallelo: true, sbloccaDopo: 'anime-3-strings',
                                characterId: 'mako',
                                music: '30. Preliminaries.mp3',
                                protagonista: { name: 'Joey Wheeler', title: 'Duellante di Battle City', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'mako', testo: 'Combatto per ritrovare mio padre e il mare mi presta ancora una volta la sua forza. Metti in palio Jinzo, Joey.' },
                                    { io: true, testo: 'Io metto in palio Jinzo e tu la Fortezza Balena. Uno di noi uscirà da qui con la sua seconda Carta Localizzatrice.' }
                                ]
                            },
                            // Arkana PRIMA di Strings, come nell'anime
                            // (episodi 11-13 e 16-18): è Arkana il primo
                            // burattino che Marik manda contro Yugi.
                            {
                                id: 'anime-3-arkana', kind: 'duel', icona: '🎭',
                                label: 'Arkana', x: 420, y: 460,
                                characterId: 'arkana',
                                music: '30. Preliminaries.mp3',
                                dialogo: [
                                    { chi: 'arkana', testo: 'Marik mi restituirà Catherine quando il mio Mago Nero avrà sconfitto il tuo. Le seghe sotto i nostri piedi renderanno definitiva la sconfitta.' },
                                    { io: true, testo: 'Marik ti ha ingannato e tu hai maltrattato le tue carte. Ti mostrerò quale Mago Nero possiede davvero la fiducia del suo duellante.' }
                                ]
                            },
                            // Joey contro Weevil (episodi 14-15): Weevil bara
                            // con una carta nascosta, e Joey vince lo stesso.
                            {
                                id: 'anime-3-joey-weevil', kind: 'duel', icona: '🐛',
                                label: 'Joey contro Weevil', x: 525, y: 380,
                                parallelo: true, sbloccaDopo: 'anime-3-arkana',
                                characterId: 'weevil',
                                music: '30. Preliminaries.mp3',
                                protagonista: { name: 'Joey Wheeler', title: 'Duellante di Battle City', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'weevil', testo: 'Ti ricordi di me, Joey? Sono quello che ha buttato in mare l’Exodia di Yugi. Stavolta a perdere una carta sarai tu, e i miei insetti hanno fame.' },
                                    { io: true, testo: 'Quella sulla nave te la devo ancora, Weevil. Puoi infilarmi tutti gli insetti che vuoi nel mazzo: io questo duello lo vinco lo stesso.' }
                                ]
                            },
                            {
                                id: 'anime-3-strings', kind: 'duel', icona: '🧵',
                                label: 'Strings', x: 270, y: 300,
                                characterId: 'strings',
                                music: '30. Preliminaries.mp3',
                                dialogo: [
                                    { chi: 'strings', testo: '...' },
                                    { nome: 'Marik', icona: '☥', testo: 'Questo burattino non ha bisogno di parlare. Nella sua mano cresce il potere di Slifer il Drago del Cielo.' },
                                    { io: true, testo: 'Puoi controllare il suo corpo, Marik, ma non il cuore delle mie carte.' }
                                ]
                            },
                            {
                                id: 'anime-3-lumis', kind: 'duel', icona: '☀️',
                                label: 'Lumis', x: 530, y: 230,
                                characterId: 'lumis',
                                music: '30. Preliminaries.mp3',
                                dialogo: [
                                    { chi: 'lumis', testo: 'Sul tetto non c’è spazio per fuggire. La Maschera della Luce sigillerà i tuoi tributi.' },
                                    { io: true, testo: 'Una maschera può nascondere un volto, non le intenzioni di chi la indossa.' }
                                ]
                            },
                            {
                                id: 'anime-3-umbra', kind: 'duel', icona: '🌘',
                                label: 'Umbra', x: 720, y: 300,
                                characterId: 'umbra',
                                music: '30. Preliminaries.mp3',
                                dialogo: [
                                    { chi: 'umbra', testo: 'Lumis ha chiuso la via alla luce. Ora la mia Bestia Mascherata completerà il doppio duello.' },
                                    { io: true, testo: 'Avete separato il campo, ma avete sottovalutato il legame tra me e Kaiba.' }
                                ]
                            },
                            {
                                id: 'anime-3-joey-controllato', kind: 'duel', icona: '⚓',
                                label: 'Il duello dell’amicizia', x: 675, y: 400,
                                characterId: 'joey',
                                music: '36. Heishin.mp3',
                                dialogo: [
                                    { nome: 'Marik', icona: '☥', testo: 'Joey è sotto il mio controllo. Vincerai soltanto condannando il tuo migliore amico a essere trascinato in fondo alla baia.' },
                                    { io: true, testo: 'Non combatterò contro Joey come se fosse un nemico. Userò il duello per raggiungerlo e spezzare il tuo controllo.' }
                                ]
                            },
                            {
                                id: 'anime-3-marik-molo', kind: 'scene', icona: '⚓',
                                label: 'Il duello al molo', x: 790, y: 405,
                                chi: 'Téa Gardner', chiId: 'tea',
                                testo: [
                                    { chi: 'tea', testo: 'Joey! Yugi! State bene?' },
                                    { chi: 'joey', testo: 'Ho la testa che mi gira… Ricordo solo una nebbia e la tua voce, Yugi, che mi chiamava.' },
                                    { io: true, testo: 'Non ti avrei mai fatto del male, amico. Mai.' },
                                    { chi: 'tea', testo: 'Marik ci aveva incatenati a un’ancora. Voleva costringere Yugi a scegliere chi salvare.' },
                                    { chi: 'joey', testo: 'Quel bastardo… e Yugi ha rifiutato di trattarmi da nemico.' },
                                    // Serenity arriva al molo proprio durante il
                                    // duello (episodi 27-29), accompagnata da Duke:
                                    // è la prima volta che Joey la vede da quando
                                    // ha di nuovo la vista, cioè il motivo per cui
                                    // ha combattuto nel Regno dei Duellanti.
                                    { chi: 'serenity', testo: 'Joey! Sono io, Serenity! L’operazione è andata bene… adesso ti vedo!' },
                                    { chi: 'joey', testo: 'Serenity… sei qui davvero. Allora ne è valsa la pena, ogni singolo duello.' },
                                    { chi: 'duke', testo: 'L’ho accompagnata io, con Tristan. Quei Cacciatori Rari la stavano inseguendo per la città.' },
                                    { io: true, testo: 'Grazie, Duke. Andiamo: le finali ci aspettano.' }
                                ]
                            },
                            // L'inizio delle finali: lo stadio di Domino, gli
                            // otto finalisti e il dirigibile. Senza questa
                            // scena i quarti cominciavano dal nulla.
                            {
                                id: 'anime-3-finali', kind: 'scene', icona: '🎟️',
                                label: 'Gli otto finalisti', x: 1380, y: 440,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { chi: 'kaiba', testo: 'Sei Carte Localizzatrici, e la mappa porta qui, allo stadio di Domino. Le finali si giocano sul mio dirigibile.' },
                                    { chi: 'mokuba', testo: 'Gli otto finalisti sono: Yugi, Seto, Joey, Mai, Bakura, Marik… un certo Namu, e l’ottavo posto è ancora vuoto.' },
                                    { chi: 'ishizu', testo: 'L’ottavo posto è mio, Kaiba. Te l’avevo detto che ci saremmo rivisti.' },
                                    { io: true, testo: 'Namu… quel ragazzo era con noi da giorni. Perché ho la sensazione che ci stia nascondendo qualcosa?' },
                                    { chi: 'mokuba', testo: 'Gli abbinamenti li decide il sorteggio. Primo quarto di finale: Yugi contro Bakura!' }
                                ]
                            },
                            {
                                id: 'anime-3-bakura', kind: 'duel', icona: '💍',
                                label: 'Ryo Bakura', x: 1185, y: 115,
                                characterId: 'bakura',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                dialogo: [
                                    { chi: 'bakura', testo: 'Il mio Tavolo del Destino scandirà le cinque lettere della tua sconfitta. Nei quarti voglio il tuo Puzzle e il potere di Marik.' },
                                    { io: true, testo: 'Lo spirito dell’Anello sta usando ancora il corpo di Bakura. Vincerò prima che il Gioco delle Ombre consumi il mio amico.' }
                                ]
                            },
                            {
                                id: 'anime-3-bakura-bonz', kind: 'duel', icona: '🪦',
                                label: 'Bakura contro Bonz', x: 900, y: 575,
                                parallelo: true, sbloccaDopo: 'anime-3-marik-molo',
                                characterId: 'bonz',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                protagonista: { name: 'Yami Bakura', title: 'Lo spirito dell’Anello', image: 'images/characters/yamiBakura.jpg', icon: '💍' },
                                dialogo: [
                                    { chi: 'bonz', testo: 'Abbiamo tre Carte Localizzatrici e non le cederemo a uno sconosciuto incontrato nel cimitero.' },
                                    { io: true, testo: 'Non mi servono i vostri nomi. Mi servono soltanto una Carta Localizzatrice e tre anime da spedire nel Regno delle Ombre.' }
                                ]
                            },
                            {
                                id: 'anime-3-bakura-marik', kind: 'duel', icona: '🌑',
                                // Sul dirigibile, dopo Mai contro Marik (episodi
                                // 47-48). Nell'anime vince il Marik oscuro, e
                                // Bakura sparisce nell'Ombra: si gioca dalla sua
                                // parte.
                                label: 'Marik contro Bakura', x: 1560, y: 185,
                                parallelo: true, sbloccaDopo: 'anime-3-mai-marik',
                                characterId: 'bakura',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                protagonista: { name: 'Yami Marik', title: 'Il Padrone delle Ombre', image: 'images/characters/yamiMarik.jpg', icon: '🌑' },
                                dialogo: [
                                    { chi: 'bakura', testo: 'Il ragazzo mi ha rivelato il segreto di Ra. Quando avrò sconfitto la tua parte oscura, prenderò anche la Barra del Millennio.' },
                                    { io: true, testo: 'La mia parte debole si è alleata con te, Bakura. Quando perderai, sarete cancellati entrambi dal Gioco delle Ombre.' }
                                ]
                            },
                            {
                                id: 'anime-3-ishizu', kind: 'duel', icona: '📿',
                                label: 'Ishizu Ishtar', x: 1250, y: 215,
                                parallelo: true, sbloccaDopo: 'anime-3-bakura',
                                characterId: 'ishizu',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                protagonista: { name: 'Seto Kaiba', title: 'Organizzatore di Battle City', image: 'images/characters/setoKaiba.jpg', icon: '🐉' },
                                dialogo: [
                                    { chi: 'ishizu', testo: 'La Collana del Millennio mi ha già mostrato la conclusione: Obelisk provocherà la tua sconfitta e io fermerò Marik.' },
                                    { io: true, testo: 'Non accetto un futuro deciso da una reliquia. Se una visione dice che perderò, sarà la mia carta a smentirla.' }
                                ]
                            },
                            {
                                id: 'anime-3-odion', kind: 'duel', icona: '🔥',
                                label: 'Odion', x: 1350, y: 245,
                                parallelo: true, sbloccaDopo: 'anime-3-bakura',
                                characterId: 'odion',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                protagonista: { name: 'Joey Wheeler', title: 'Finalista di Battle City', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'odion', testo: 'Per ordine del vero Marik, porterò il suo nome e il suo volto durante questo quarto di finale.' },
                                    { io: true, testo: 'Puoi chiamarti Marik quanto vuoi. Scoprirò chi sei davvero e mi guadagnerò la semifinale.' }
                                ]
                            },
                            {
                                id: 'anime-3-mai-marik', kind: 'duel', icona: '🌑',
                                // Nell'anime vince il Marik oscuro, e Mai finisce
                                // nel Regno delle Ombre (episodi 41-43): si gioca
                                // dalla sua parte.
                                label: 'Marik contro Mai', x: 1460, y: 225,
                                parallelo: true, sbloccaDopo: 'anime-3-bakura',
                                characterId: 'mai',
                                music: '31. Finals.mp3',
                                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                                protagonista: { name: 'Yami Marik', title: 'Il Padrone delle Ombre', image: 'images/characters/yamiMarik.jpg', icon: '🌑' },
                                dialogo: [
                                    { chi: 'mai', testo: 'Non sono arrivata alle finali per essere una comparsa. Prenderò Ra e dimostrerò che non ho bisogno di nessuno che mi salvi.' },
                                    { io: true, testo: 'Nel mio Gioco delle Ombre ogni mostro perduto cancellerà un ricordo. Alla fine non saprai più nemmeno perché duelli.' }
                                ]
                            },
                            {
                                id: 'anime-3-sei-carte', kind: 'scene', icona: '🃏',
                                label: 'I finalisti', x: 1275, y: 55,
                                chi: 'Yami Yugi', chiId: 'yamiYugi',
                                testo: [
                                    { chi: 'kaiba', testo: 'I quarti di finale sono finiti. Restano quattro duellanti: Yugi, Joey, Marik… e io.' },
                                    { io: true, testo: 'E Namu era Marik fin dall’inizio. Ha viaggiato con noi per giorni, e noi gli abbiamo raccontato tutto.' },
                                    // Gli abbinamenti delle semifinali NON si
                                    // decidono qui: li decide la battaglia a
                                    // quattro sulla Torre dei Duelli (Parte 2).
                                    { chi: 'mokuba', testo: 'Le semifinali si giocheranno alla Torre dei Duelli, Seto. E gli abbinamenti li deciderà una battaglia a quattro.' },
                                    { io: true, testo: 'Marik ha ridotto Mai in quello stato. Questa volta non gli lascerò altre vittime.' },
                                    { chi: 'kaiba', testo: 'Bada ai tuoi duelli, Yugi. Il torneo è mio, non lo rovinerai con le tue crociate.' },
                                    { chi: 'mokuba', testo: 'Seto… i comandi non rispondono! Qualcosa sta prendendo il controllo del dirigibile!' }
                                ]
                            },
                            // Chiude la Parte 1: si sale sul dirigibile per
                            // le semifinali — ma il torneo vero riprenderà
                            // solo in "Battle City - Parte 2", DOPO il
                            // Mondo Virtuale: sul dirigibile, prima ancora
                            // che i duelli comincino, Noah trascina tutti
                            // dentro la sua rete. Vedi il commento
                            // sull'area 'virtuale' qui sotto.
                            {
                                id: 'anime-4-scena', kind: 'scene', icona: '🛩️',
                                label: 'Sul dirigibile', x: 1440, y: 100,
                                io: true,
                                testo: [
                                    { chi: 'mokuba', testo: 'Seto, guarda! Una fortezza è uscita dal mare e ha agganciato il dirigibile!' },
                                    { chi: 'noah', testo: 'Salve a tutti. Mi chiamo Noah Kaiba, e da questo momento siete miei ospiti.' },
                                    { chi: 'kaiba', testo: 'Noah? Non conosco nessun Noah!' },
                                    { chi: 'noah', testo: 'Eppure condividiamo un cognome, Seto. Vi porto nel mondo che ho costruito: nel frattempo i vostri corpi dormiranno.' },
                                    { io: true, testo: 'Le nostre coscienze sono state separate dai corpi… dobbiamo uscire da qui.' },
                                    { chi: 'kaiba', testo: 'Conosco questo sistema. Se è la KaibaCorp ad averlo costruito, c’è un modo per distruggerlo.' }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'virtuale',
                nome: 'Il Mondo Virtuale',
                field: 'images/fields/mobile/mondoVirtualeArenaGozaburo.jpg',
                music: '06. Inside the Puzzle.mp3',
                testo: 'Il dirigibile non è ancora atterrato che il pavimento sparisce: dentro la rete le regole le scrive un ragazzo che non è mai cresciuto.',
                tappe: [
                    {
                        id: 'anime-area-virtuale', kind: 'area', icona: '🧊',
                        label: 'Il Mondo Virtuale', x: 1120, y: 335,
                        nome: 'Il Mondo Virtuale',
                        testo: 'Nessun corpo, nessun Duel Disk: qui si perde l\'anima e basta. Prima i Cinque, poi Noah, poi chi comanda davvero.',
                        mappa: { sfondo: ['images/maps/storia_anime_virtuale.jpg'], larghezza: 1536, altezza: 1024 },
                        tappe: [
                            {
                                id: 'anime-6-scena', kind: 'scene', icona: '🧊',
                                label: 'Dentro la rete', x: 790, y: 540,
                                chi: 'Noah Kaiba', chiId: 'noah',
                                testo: [
                                    { chi: 'noah', testo: 'Benvenuti nel mio mondo. Non è un modo di dire: l’ho costruito io, e qui dentro decido io cosa è vero.' },
                                    { chi: 'kaiba', testo: 'Chi sei, esattamente? E perché il tuo cognome è Kaiba?' },
                                    { chi: 'noah', testo: 'Sono il figlio di Gozaburo. Mio padre mi ha chiuso in una macchina dopo il mio incidente, e poi ha adottato te, Seto.' },
                                    { chi: 'kaiba', testo: 'Un orfano preso a caso. È questo che sono per lui?' },
                                    { chi: 'noah', testo: 'Un orfano a cui ha dato tutto quello che a me non poteva dare più. Prima di arrivare a me dovrete battere i Cinque: erano il consiglio di mio padre.' },
                                    { chi: 'mokuba', testo: 'Seto… quel ragazzo parla come uno che non è cresciuto mai.' }
                                ]
                            },
                            // I cinque dirigenti/Big Five, uno alla volta.
                            {
                                id: 'anime-6-gansley', kind: 'duel', icona: '🎩',
                                label: 'Gansley', x: 250, y: 250,
                                characterId: 'gansley',
                                field: 'images/fields/mobile/campoAcquatico.jpg',
                                music: '35. High Mages.mp3',
                                dialogo: [
                                    { chi: 'gansley', testo: 'Nel mondo virtuale il Deck Master combatte al tuo fianco. Il mio Guerriero degli Abissi trasformerà ogni tua scelta in un costo.' },
                                    { io: true, testo: 'Le vostre regole tengono prigioniere le anime dei miei amici. Le imparerò e userò il mio Deck Master per liberarli.' }
                                ]
                            },
                            {
                                id: 'anime-6-johnson', kind: 'duel', icona: '🦁',
                                label: 'Johnson', x: 330, y: 590,
                                parallelo: true, sbloccaDopo: 'anime-6-scena',
                                characterId: 'johnson',
                                field: 'images/fields/mobile/rovineAntiche.jpg',
                                music: '35. High Mages.mp3',
                                protagonista: { name: 'Joey Wheeler', title: 'Prigioniero del mondo virtuale', image: 'images/characters/joeyWheeler.jpg', icon: '🎲' },
                                dialogo: [
                                    { chi: 'johnson', testo: 'Ero il miglior avvocato della KaibaCorp. Qui sono giudice, giuria e duellante, e la sentenza è già scritta.' },
                                    { io: true, testo: 'Hai truccato perfino la roulette del tuo Deck Master. Io non ho bisogno di una sentenza comprata per vincere.' }
                                ]
                            },
                            {
                                id: 'anime-6-nesbitt', kind: 'duel', icona: '🏗️',
                                label: 'Nesbitt', x: 760, y: 830,
                                parallelo: true, sbloccaDopo: 'anime-6-scena',
                                characterId: 'nesbitt',
                                field: 'images/fields/mobile/industriaKaibaCorp.jpg',
                                music: '35. High Mages.mp3',
                                // Nell'anime è un tre contro uno: Tristan cade per
                                // primo, e a battere Nesbitt sono Duke e Serenity.
                                // Si gioca con Serenity, che chiude il duello.
                                protagonista: { name: 'Serenity Wheeler', title: 'Prigioniera del mondo virtuale', image: 'images/characters/serenityWheeler.jpg', icon: '🌸' },
                                dialogo: [
                                    { chi: 'nesbitt', testo: 'Il vostro amico Tristan è già caduto. Quando avrò finito con voi due, prenderò il tuo corpo e abbandonerò per sempre questa macchina.' },
                                    { chi: 'duke', testo: 'Non sei sola, Serenity. Io copro le tue spalle: tu pensa a vincere.' },
                                    { io: true, testo: 'Mio fratello non si arrende mai, e io sono sua sorella. Riprenderemo anche il corpo di Tristan.' }
                                ]
                            },
                            {
                                id: 'anime-6-crump', kind: 'duel', icona: '⚙️',
                                label: 'Crump', x: 1270, y: 440,
                                parallelo: true, sbloccaDopo: 'anime-6-scena',
                                characterId: 'crump',
                                field: 'images/fields/mobile/campoGhiaccio.jpg',
                                music: '35. High Mages.mp3',
                                protagonista: { name: 'Téa Gardner', title: 'Prigioniera del mondo virtuale', image: 'images/characters/teaGardner.jpg', icon: '💫' },
                                dialogo: [
                                    { chi: 'crump', testo: 'Nel mio regno di ghiaccio i pinguini comandano e il tuo corpo sarà il biglietto con cui tornerò nel mondo reale.' },
                                    { io: true, testo: 'Ridicolizzare il mio mazzo non ti renderà meno pericoloso. Dark Magician Girl ed io usciremo da qui insieme.' }
                                ]
                            },
                            {
                                id: 'anime-6-lector', kind: 'duel', icona: '🎭',
                                label: 'Lector', x: 1230, y: 690,
                                parallelo: true, sbloccaDopo: 'anime-6-scena',
                                characterId: 'lector',
                                field: 'images/fields/mobile/citta.jpg',
                                music: '35. High Mages.mp3',
                                protagonista: { name: 'Seto Kaiba', title: 'Presidente della KaibaCorp', image: 'images/characters/setoKaiba.jpg', icon: '🐉' },
                                dialogo: [
                                    { chi: 'lector', testo: 'Hai estromesso noi Cinque dalla KaibaCorp. Con Jinzo come Deck Master prenderò il tuo corpo e anche l’azienda.' },
                                    { io: true, testo: 'Vi ho licenziati perché avete tradito la società. Ora cancellerò anche le vostre copie digitali.' }
                                ]
                            },
                            // Battuti uno per uno, i Cinque si fondono nel Drago
                            // a Cinque Teste e sfidano Yugi e Joey insieme.
                            // Parla Gansley, che era il loro capo: è lui
                            // l'avversario sul tavolo.
                            {
                                id: 'anime-6-cinque-uniti', kind: 'duel', icona: '🐲',
                                label: 'I Cinque uniti', x: 905, y: 575,
                                field: 'images/fields/mobile/campoPrato.jpg',
                                music: '35. High Mages.mp3',
                                characterId: 'gansley',
                                dialogo: [
                                    { nome: 'I Cinque', icona: '🐲', testo: 'Separati ci avete battuti. Uniti siamo il Drago a Cinque Teste, e nessun mostro con un solo cuore può fermarlo.' },
                                    { chi: 'joey', testo: 'Cinque contro due? Tipico di voi dirigenti. Yugi, io ci sono.' },
                                    { io: true, testo: 'Il vostro drago ha cinque teste e nessuna amicizia, Gansley. Joey ed io ne abbiamo abbastanza per tutti e due.' }
                                ]
                            },
                            {
                                id: 'anime-6-anime-prigioni', kind: 'scene', icona: '🔗',
                                label: 'Anime prigioniere', x: 1010, y: 455,
                                chi: 'Téa Gardner', chiId: 'tea',
                                testo: [
                                    { chi: 'tea', testo: 'Non si sveglia nessuno. I Cinque sono caduti ma i nostri corpi sul dirigibile dormono ancora.' },
                                    { chi: 'mokuba', testo: 'Perché Noah non vuole solo vendicarsi di Seto: vuole il mio corpo per tornare nel mondo reale!' },
                                    { io: true, testo: 'Le isole virtuali si stanno spegnendo. Noah è rimasto da solo, nella torre centrale.' },
                                    { chi: 'tea', testo: 'Se vince il prossimo duello, uno di noi uscirà da qui con il volto sbagliato.' },
                                    { chi: 'mokuba', testo: 'Non lo permetterò. Mio fratello l’ha già affrontato una volta.' }
                                ]
                            },
                            // Superati i Cinque, resta Noah.
                            {
                                id: 'anime-6-noah', kind: 'duel', icona: '🧊',
                                label: 'Noah Kaiba', x: 775, y: 230,
                                characterId: 'noah',
                                field: 'images/fields/mobile/campoForesta.jpg',
                                music: '35. High Mages.mp3',
                                dialogo: [
                                    { chi: 'noah', testo: 'Ho già sconfitto Seto e trasformato Mokuba in pietra. Con il potere di Shinato assorbirò anche le anime che hai liberato.' },
                                    { io: true, testo: 'Riprenderò i Life Point rimasti a Kaiba e continuerò il suo duello. Tutte le anime che hai imprigionato combatteranno con me.' }
                                ]
                            },
                            {
                                id: 'anime-6-kaiba-noah', kind: 'duel', icona: '🐉',
                                // Nell'anime vince Noah: Kaiba e Mokuba finiscono
                                // di pietra, e Yugi riprende il duello coi Life
                                // Point rimasti a Kaiba. Si gioca dalla parte di
                                // Noah.
                                label: 'Noah contro Kaiba', x: 920, y: 210,
                                parallelo: true, sbloccaDopo: 'anime-6-anime-prigioni',
                                characterId: 'kaiba',
                                field: 'images/fields/mobile/campoForesta.jpg',
                                music: '35. High Mages.mp3',
                                protagonista: { name: 'Noah Kaiba', title: 'Il ragazzo del mondo virtuale', image: 'images/characters/noah.jpg', icon: '🧊' },
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Non sei mio fratello e non sei il mio successore. Libera Mokuba: regoleremo questa faccenda nel duello che volevi.' },
                                    { io: true, testo: 'Sono il vero erede di Gozaburo, Seto. Userò Mokuba contro di te e dimostrerò che la KaibaCorp avrebbe dovuto appartenere a me.' }
                                ]
                            },
                            {
                                id: 'anime-6-scena2', kind: 'scene', icona: '🏢',
                                label: 'Il vero padrone', x: 1060, y: 300,
                                chi: 'Gozaburo Kaiba', chiId: 'gozaburo',
                                testo: [
                                    { chi: 'gozaburo', testo: 'Noah, figlio mio, mi sei stato utile. Credevi davvero che ti avrei dato il corpo di Seto?' },
                                    { chi: 'noah', testo: 'Padre… ma mi avevi promesso…' },
                                    { chi: 'gozaburo', testo: 'Eri solo lo strumento per intrappolarli qui. La mia coscienza si diffonderà in tutta la rete e prenderà il posto di ogni mente collegata.' },
                                    { chi: 'kaiba', testo: 'Gozaburo. Credevo di averti battuto una volta per tutte.' },
                                    { chi: 'gozaburo', testo: 'Hai preso la mia azienda e l’hai trasformata in una fabbrica di giochi. Cancellerò tutto ciò che hai costruito, Seto, e il mondo reale sarà il mio nuovo corpo.' },
                                    { chi: 'kaiba', testo: 'Allora regoliamo i conti come si deve, vecchio. Con un duello.' }
                                ]
                            },
                            // Nell'anime Gozaburo lo affronta Kaiba, da solo, e
                            // vince (Exodia Necross contro i suoi Draghi). Era
                            // una scena di fuga: è un duello vero, ed è il
                            // momento in cui Kaiba chiude i conti col padre.
                            {
                                id: 'anime-6-kaiba-gozaburo', kind: 'duel', icona: '🏢',
                                label: 'Kaiba contro Gozaburo', x: 1250, y: 175,
                                characterId: 'gozaburo',
                                field: 'images/fields/mobile/mondoVirtualeArenaGozaburo.jpg',
                                music: '43. Darknite-Nitemare (3D).mp3',
                                protagonista: { name: 'Seto Kaiba', title: 'Presidente della KaibaCorp', image: 'images/characters/setoKaiba.jpg', icon: '🐉' },
                                dialogo: [
                                    { chi: 'gozaburo', testo: 'Ti ho insegnato tutto, Seto: a schiacciare chi è debole, a non perdonare. Exodia Necross non si può distruggere, come il mio impero.' },
                                    { io: true, testo: 'Mi hai insegnato a vincere. Ed è esattamente quello che farò, l’ultima volta che ti vedo.' }
                                ]
                            },
                            // Dopo la sconfitta di Gozaburo è Noah a salvarli: ha
                            // visto chi era davvero suo padre, e resta indietro
                            // per distruggere la rete mentre gli altri scappano.
                            {
                                id: 'anime-6-gozaburo', kind: 'scene', icona: '🛩️',
                                label: 'La scelta di Noah', x: 430, y: 95,
                                chi: 'Noah Kaiba', chiId: 'noah',
                                testo: [
                                    { chi: 'noah', testo: 'Andate. Il dirigibile risponde di nuovo ai comandi: vi ho riaperto la strada verso i vostri corpi.' },
                                    { chi: 'mokuba', testo: 'E tu, Noah? Vieni con noi!' },
                                    { chi: 'noah', testo: 'Io non ho un corpo a cui tornare, Mokuba. Ma posso fare una cosa giusta: resto qui e cancello la rete, con mio padre dentro.' },
                                    { chi: 'kaiba', testo: 'Noah…' },
                                    { chi: 'noah', testo: 'Prenditi cura di tuo fratello, Seto. Io non ho avuto nessuno che lo facesse con me.' },
                                    { io: true, testo: 'Grazie, Noah. Non dimenticheremo quello che hai fatto.' }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'battlecity2',
                nome: 'Battle City - Parte 2',
                field: 'images/fields/mobile/dirigibileKaibaCorp.jpg',
                music: '08. Finals Face-Off.mp3',
                testo: 'Il dirigibile è ancora lì dove l\'avevano lasciato: il torneo riprende da dove Noah l\'aveva interrotto.',
                tappe: [
                    {
                        id: 'anime-area-battlecity2', kind: 'area', icona: '🏆',
                        label: 'Battle City - Parte 2', x: 1400, y: 355,
                        nome: 'Battle City - Parte 2',
                        testo: 'Le finali riprendono da dove Noah le aveva interrotte: mancano solo i duelli veri.',
                        mappa: { sfondo: ['images/maps/storia_anime_battlecity2.jpg'], larghezza: 1672, altezza: 941 },
                        tappe: [
                            {
                                id: 'anime-4b-scena', kind: 'scene', icona: '🛩️',
                                label: 'Il ritorno', x: 1370, y: 140,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { chi: 'kaiba', testo: 'Siamo tornati nei nostri corpi, e la fortezza è precipitata prima che Gozaburo potesse invadere la rete mondiale.' },
                                    { chi: 'mokuba', testo: 'Il dirigibile ha ripreso la rotta: stiamo arrivando alla Torre dei Duelli!' },
                                    { chi: 'joey', testo: 'Finalmente! Pensavo che quel Noah ci tenesse chiusi lì dentro per sempre.' },
                                    { chi: 'kaiba', testo: 'Basta chiacchiere. Prima delle semifinali, una battaglia a quattro sulla cima della torre: io, Yugi, Wheeler e Marik, tutti contro tutti. L’ordine in cui cadiamo deciderà gli abbinamenti.' },
                                    { io: true, testo: 'Nessun altro dirottamento, Kaiba?' },
                                    { chi: 'kaiba', testo: 'Nessuna scusa, stavolta. Il torneo riprende adesso.' }
                                ]
                            },
                            // La battaglia reale a quattro (Yugi, Kaiba, Joey,
                            // Marik) che decide le semifinali. Sul tavolo è un
                            // duello contro Marik, il rivale che conta.
                            {
                                id: 'anime-4b-battaglia-reale', kind: 'duel', icona: '⚔️',
                                label: 'La battaglia a quattro', x: 1300, y: 615,
                                field: 'images/fields/mobile/torreDeiDuelli.jpg',
                                music: '37. Seto.mp3',
                                characterId: 'marik',
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Quattro duellanti, un campo solo. Ognuno attacca chi vuole, e nessuno fa favori a nessuno.' },
                                    { chi: 'marik', testo: 'Che vi alleiate o no, il Faraone cadrà. Ra ha già visto come finisce questa notte.' },
                                    { io: true, testo: 'Ra non ha visto niente, Marik. Stanotte decidiamo noi chi resta in piedi.' }
                                ]
                            },
                            // Nell'anime è Marik a vincere: Joey crolla un istante
                            // prima di dichiarare l'ultimo attacco. Si gioca dalla
                            // parte di Marik.
                            {
                                id: 'anime-4-joey', kind: 'duel', icona: '🌑',
                                label: 'Semifinale: Marik contro Joey', x: 1180, y: 705,
                                parallelo: true, sbloccaDopo: 'anime-4b-battaglia-reale',
                                characterId: 'joey',
                                field: 'images/fields/mobile/torreDeiDuelli.jpg',
                                music: '37. Seto.mp3',
                                protagonista: { name: 'Yami Marik', title: 'Il Padrone delle Ombre', image: 'images/characters/yamiMarik.jpg', icon: '🌑' },
                                dialogo: [
                                    { chi: 'joey', testo: 'Puoi trasformare il duello in un incubo, ma non mi farai abbandonare. Ho promesso a Yugi che sarei arrivato fino in fondo.' },
                                    { io: true, testo: 'Ogni mostro distrutto farà soffrire il suo proprietario. Prima della fine, Ra cancellerà il tuo corpo e la tua mente.' }
                                ]
                            },
                            {
                                id: 'anime-4b-amicizia', kind: 'scene', icona: '🤝',
                                label: 'Al capezzale di Joey', x: 1120, y: 610,
                                chi: 'Serenity Wheeler', chiId: 'serenity',
                                // Dopo la semifinale Joey resta privo di sensi
                                // (si risveglia solo durante Yugi contro Kaiba):
                                // a parlare sono gli altri, al suo capezzale.
                                testo: [
                                    { chi: 'serenity', testo: 'Non si sveglia, Yugi. Stava per dichiarare l’ultimo attacco, e il suo corpo ha ceduto un istante prima.' },
                                    { chi: 'tea', testo: 'Marik lo ha trascinato in un Gioco delle Ombre. Joey ha resistito fino alla fine, pur di non arrendersi.' },
                                    { io: true, testo: 'Marik non lo ha battuto nello spirito, Serenity. Joey tornerà: ha promesso che sarebbe arrivato fino in fondo, e mantiene sempre le promesse.' },
                                    { chi: 'tristan', testo: 'Kaiba ti aspetta sulla cima della torre. Vai, Yugi: restiamo noi con lui.' },
                                    { io: true, testo: 'Vincerò anche per lui. Quando aprirà gli occhi, voglio che veda la finale.' }
                                ]
                            },
                            {
                                id: 'anime-4-kaiba', kind: 'duel', icona: '🐉',
                                label: 'Seto Kaiba', x: 995, y: 520,
                                characterId: 'kaiba',
                                field: 'images/fields/mobile/torreDeiDuelliColosseo.jpg',
                                music: '32. Seto Kaiba (Tournament Final) HD.mp3',
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Obelisk contro Slifer. Il vincitore prenderà la carta divina dello sconfitto e affronterà Marik nella finale che ho costruito.' },
                                    { io: true, testo: 'La tavola egizia raffigura questo scontro da tremila anni. Oggi non sarà il passato a deciderne il risultato.' }
                                ]
                            },
                            // Il terzo posto: chi ha perso le due semifinali.
                            // Nell'anime vince Kaiba, e si gioca dalla sua parte.
                            // Ramo morto: non fa avanzare la storia.
                            {
                                id: 'anime-4b-terzo-posto', kind: 'duel', icona: '🥉',
                                label: 'Terzo posto: Kaiba contro Joey', x: 1010, y: 425,
                                parallelo: true, sbloccaDopo: 'anime-4-kaiba',
                                characterId: 'joey',
                                field: 'images/fields/mobile/torreDeiDuelli.jpg',
                                music: '32. Seto Kaiba (Tournament Final) HD.mp3',
                                protagonista: { name: 'Seto Kaiba', title: 'Organizzatore di Battle City', image: 'images/characters/setoKaiba.jpg', icon: '🐉' },
                                dialogo: [
                                    { chi: 'joey', testo: 'Mi sono appena svegliato e mi fa male tutto, ma questo duello non me lo perdo, Kaiba. Da quando mi hai chiamato dilettante aspetto questo momento.' },
                                    { io: true, testo: 'Il terzo posto non mi interessa, Wheeler. Mi interessa ricordarti la differenza fra un cane e un campione.' }
                                ]
                            },
                            {
                                id: 'anime-4b-tre-dei', kind: 'scene', icona: '⚡',
                                label: 'I tre Dei', x: 875, y: 360,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { chi: 'kaiba', testo: 'Hai vinto la semifinale, Yugi. Non significa che il destino esista: oggi il tuo mazzo è stato meno mediocre del solito.' },
                                    { io: true, testo: 'Hai combattuto con tutto te stesso, Kaiba. Lo sai anche tu.' },
                                    { chi: 'kaiba', testo: 'Obelisk è tuo, secondo la regola dell’ante. Ma contro Marik avrai bisogno di tutti e tre gli Dei.' },
                                    { io: true, testo: 'Marik ha trasformato il torneo in un Gioco delle Ombre. Lo fermerò.' },
                                    { chi: 'kaiba', testo: 'La cima della torre è davanti a te. Vinci, Yugi. Non per il destino: perché questa è la mia Battle City.' }
                                ]
                            },
                            {
                                id: 'anime-4-marik', kind: 'duel', icona: '🌑',
                                label: 'Marik Ishtar', x: 790, y: 220,
                                characterId: 'marik',
                                field: 'images/fields/mobile/torreDeiDuelliShadow.jpg',
                                music: "58. Yugi vs. Marik – Wrath of the Shadow Realm.mp3",
                                dialogo: [
                                    { chi: 'marik', testo: 'Ra diventerà una Fenice immortale e consumerà ogni ricordo del Faraone. La mia parte debole sparirà insieme a lui.' },
                                    { io: true, testo: 'Combatterò per Joey, Mai e per il vero Marik che hai imprigionato. I tre Dei porranno fine al tuo Gioco delle Ombre.' }
                                ]
                            },
                            // Dopo la finale: il vero Marik si libera della sua
                            // parte oscura e si arrende, Mai e Joey tornano dal
                            // Regno delle Ombre, Kaiba se ne va. Prima la storia
                            // saltava dritta al Mondo dei Ricordi.
                            {
                                id: 'anime-4b-epilogo', kind: 'scene', icona: '🌅',
                                label: 'L’alba su Battle City', x: 615, y: 300,
                                chi: 'Marik Ishtar', chiId: 'marik',
                                testo: [
                                    { testo: 'L’oscurità si ritira dal campo. Al centro resta un ragazzo stremato: il vero Marik, finalmente padrone di sé.' },
                                    { nome: 'Marik', icona: '☥', testo: 'Mi arrendo, Faraone. La mia parte oscura è sparita con quell’ultimo attacco… e con lei tutto il male che ho fatto.' },
                                    { chi: 'ishizu', testo: 'Fratello, sei tornato.' },
                                    { nome: 'Marik', icona: '☥', testo: 'Ra è tuo, e anche la Barra del Millennio. Tutta la mia famiglia ha custodito un segreto per te: il modo per ritrovare la tua memoria.' },
                                    { chi: 'joey', testo: 'Ehi… mi gira la testa, ma sono tutto intero. E anche Mai si è svegliata!' },
                                    { chi: 'kaiba', testo: 'Il torneo è finito, e la torre salterà fra pochi minuti. Tieniti i tuoi Dei, Yugi. Quello che ci siamo detti oggi non cambia niente.' },
                                    { io: true, testo: 'Ho i tre Dei Egizi. Adesso so dove andare: in Egitto, a cercare il mio nome.' }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'cerimoniale',
                nome: 'Il Mondo dei Ricordi',
                field: 'images/fields/mobile/arenaAnticoEgittoGiorno.jpg',
                music: '56. Battle for the Millennium.mp3',
                testo: 'Battle City è finita. Resta il viaggio nel passato, per la battaglia che conta davvero.',
                tappe: [
                    {
                        id: 'anime-area-cerimoniale', kind: 'area', icona: '👁️',
                        label: 'Il Mondo dei Ricordi', x: 1765, y: 350,
                        nome: 'Il Mondo dei Ricordi',
                        testo: 'L\'ultimo duello non si gioca per vincere: si gioca per lasciarlo andare.',
                        mappa: { sfondo: ['images/maps/storia_anime_cerimoniale.jpg'], larghezza: 1536, altezza: 1024 },
                        tappe: [
                            {
                                id: 'anime-9-prologo', kind: 'scene', icona: '◉',
                                label: 'L’ultimo Gioco delle Ombre', x: 170, y: 165,
                                chi: 'Bakura', chiId: 'bakura',
                                testo: [
                                    { chi: 'bakura', testo: 'Porta le tre Divinità in Egitto, Faraone. Nel luogo dove riposano i tuoi ricordi comincerà il nostro ultimo Gioco delle Ombre.' },
                                    { io: true, testo: 'Se il mio passato è la posta in gioco, verrò. Ma questa volta non userai i miei amici contro di me.' },
                                    { chi: 'kaiba', testo: 'Ancora favole sul Faraone? Dimostrami almeno che il tuo mostro merita la mia attenzione.' },
                                    { chi: 'bakura', testo: 'Volentieri, Kaiba. Diabound ricorderà il potere del tuo Drago Bianco molto più a lungo di te.' }
                                ]
                            },
                            {
                                id: 'anime-9-kaiba-bakura', kind: 'duel', icona: '🐉',
                                label: 'Kaiba contro Bakura', x: 300, y: 245,
                                parallelo: true, sbloccaDopo: 'anime-9-prologo',
                                characterId: 'bakura',
                                protagonista: { name: 'Seto Kaiba', title: 'Presidente della Kaiba Corporation', image: 'images/characters/setoKaiba.jpg', icon: '🐉' },
                                dialogo: [
                                    { chi: 'bakura', testo: 'Il tuo Drago Bianco sarà un ottimo nutrimento per Diabound.' },
                                    { io: true, testo: 'Prova a toccarlo e scoprirai perché nessuno umilia Seto Kaiba due volte.' }
                                ]
                            },
                            {
                                id: 'anime-9-scena', kind: 'scene', icona: '🏜️',
                                label: 'Arrivo al Cairo', x: 245, y: 820,
                                chi: 'Ishizu Ishtar', chiId: 'ishizu',
                                testo: [
                                    { testo: 'Yugi, Joey, Téa e Tristan arrivano al Cairo, dove Ishizu, Marik e Odion li conducono alla Tavola delle Memorie Perdute.' },
                                    { chi: 'tea', testo: 'Ho preso questo cartiglio per te, Atem. Quando ritroverai il tuo nome potrai inciderlo qui e non perderlo mai più.' },
                                    { io: true, testo: 'Grazie, Téa. Le tre Divinità apriranno la porta dei ricordi; qualunque cosa trovi oltre quella soglia, tornerò da voi.' },
                                    { chi: 'ishizu', testo: 'Il Faraone dovrà rivivere il proprio destino. Voi potrete aiutarlo soltanto trovando il suo vero nome.' }
                                ]
                            },
                            {
                                id: 'anime-9-porta', kind: 'scene', icona: '🧩',
                                label: 'La vera porta', x: 620, y: 205,
                                chi: 'Shadi',
                                testo: [
                                    { testo: 'Atem presenta le tre Divinità alla tavola e viene trascinato nel proprio passato. Lo spirito di Bakura lo segue, lasciando a terra il corpo di Ryo.' },
                                    { nome: 'Shadi', testo: 'Nel Labirinto del Puzzle esiste una sola porta vera. Oltre quella porta il Faraone sta rivivendo la notte in cui perdette il nome.' },
                                    { chi: 'yugiMuto', testo: 'Allora troveremo quella porta e il suo cartiglio. Non lasceremo che affronti Bakura da solo.' },
                                    { chi: 'joey', testo: 'Insieme, come sempre. Andiamo a riprenderci il nostro amico.' }
                                ]
                            },
                            {
                                id: 'anime-9-incoronazione', kind: 'scene', icona: '👑',
                                label: 'Il giovane Faraone', x: 1190, y: 145,
                                chi: 'Il Faraone',
                                testo: [
                                    { testo: 'Nel Mondo dei Ricordi Atem riprende il posto del giovane sovrano durante la propria incoronazione.' },
                                    { nome: 'Shimon Muran', testo: 'Mio Faraone, questi sono i sei sacerdoti custodi degli Oggetti del Millennio: Seto, Mahad, Isis, Shada, Karim e Aknadin.' },
                                    { chi: 'priestSeto', testo: 'Le Tavole di Pietra imprigionano i Ka nati dal cuore degli uomini. Saranno la difesa dell’Egitto.' },
                                    { io: true, testo: 'Conosco i loro volti senza ricordare le loro vite. Devo scoprire che cosa accadde prima che questa memoria giunga alla fine.' }
                                ]
                            },
                            // --- Dentro i ricordi: il Re dei Ladri ---
                            // L'arco del Mondo dei Ricordi (Dawn of the Duel
                            // nell'anime) È lo scontro fra il Faraone e
                            // Bakura: prima come Re dei Ladri, che fa
                            // irruzione a palazzo col sarcofago del padre del
                            // Faraone, poi come padrone del Gioco delle Ombre
                            // che risveglia Zorc. Mancava del tutto, e l'arco
                            // saltava da "entra nei ricordi" a "ha ritrovato
                            // il nome" senza che succedesse niente in mezzo.
                            // Queste quattro tappe sono nate DOPO: vedi la
                            // voce 'cerimoniale-bakura' in `separazioni`.
                            // In questi duelli si gioca nei panni del
                            // Faraone (il protagonista della campagna).
                            {
                                id: 'anime-9-bakura-scena', kind: 'scene', icona: '🗝️',
                                label: 'Il Re dei Ladri', x: 1410, y: 220,
                                chi: 'Bakura', chiId: 'bakura',
                                testo: [
                                    { chi: 'bakura', testo: 'Tremila anni fa ero un ragazzo di Kul Elna, e Kul Elna non esiste più. L’hanno fusa, casa per casa, per forgiare i vostri sette Oggetti d’oro.' },
                                    { io: true, testo: 'Quello che dici è terribile, ma non ti dà il diritto di profanare la tomba di mio padre.' },
                                    { chi: 'bakura', testo: 'Profanare? Stanotte l’ho portato fin qui, nel tuo palazzo, il sarcofago del Faraone. Volevo vedere la tua faccia mentre lo aprivo.' },
                                    { io: true, testo: 'Allora vedrai che il sangue reale non si piega all’odio.' },
                                    { chi: 'bakura', testo: 'Vediamo quanto vale il tuo sangue contro l’odio di un villaggio intero.' }
                                ]
                            },
                            {
                                id: 'anime-9-bakura', kind: 'duel', icona: '🗝️',
                                label: 'Obelisk contro Diabound', x: 1280, y: 300,
                                characterId: 'bakura',
                                dialogo: [
                                    { chi: 'bakura', testo: 'Diabound ha copiato il potere del Drago Bianco di Kaiba. Neppure Obelisk riuscirà a schiacciarlo.' },
                                    { io: true, testo: 'Questo palazzo e il mio popolo non saranno le pedine della tua vendetta. Obelisk, mostrargli la forza del Faraone!' }
                                ]
                            },
                            {
                                id: 'anime-9-mahad', kind: 'scene', icona: '🪄',
                                // Sotto il palazzo, dove il ladro è sceso nella
                                // tomba del padre del Faraone: i fatti di
                                // palazzo stanno tutti nella città in alto a
                                // destra, così il sentiero non si aggroviglia.
                                label: 'Il sacrificio di Mahad', x: 1110, y: 270,
                                chi: 'Mahad',
                                testo: [
                                    { nome: 'Mahad', testo: 'Bakura cercherà il mio Anello del Millennio. Lo attirerò nel santuario e lo affronterò lontano dal palazzo.' },
                                    { io: true, testo: 'Non combatterlo da solo, Mahad. Diabound diventa più forte con ogni Ka che distrugge.' },
                                    { testo: 'Nel santuario, Diabound assorbe l’abilità dello Shadow Ghoul e porta Mahad al limite.' },
                                    { nome: 'Mahad', testo: 'Non posso vincere conservando la mia vita. Unirò il mio Ba al mio Ka e servirò il Faraone oltre la morte.' },
                                    { testo: 'Mahad si fonde con il Mago dell’Illusione. Nasce il Mago Nero: il suo ultimo attacco abbatte Diabound e fa crollare il santuario, ma Bakura fugge con l’Anello.' },
                                    { io: true, testo: 'Mahad… il tuo nome e la tua lealtà non saranno dimenticati.' }
                                ]
                            },
                            {
                                id: 'anime-9-caccia-ka', kind: 'scene', icona: '⚖️',
                                label: 'La caccia ai Ka', x: 1390, y: 350,
                                chi: 'Sacerdote Seto', chiId: 'priestSeto',
                                testo: [
                                    { chi: 'priestSeto', testo: 'Per opporci a Diabound cercheremo fra il popolo un Ka abbastanza potente da difendere l’Egitto.' },
                                    { nome: 'Aknadin', testo: 'Non limitarti a cercare, Seto. Costringi quei prigionieri a combattere: l’odio renderà più forti i loro mostri.' },
                                    { nome: 'Kisara', testo: 'Non voglio combattere nessuno. Il drago dentro di me appare soltanto per proteggere.' },
                                    { chi: 'priestSeto', testo: 'Questa ragazza non è un’arma. Liberatela. Se il suo Ka è davvero così grande, non nascerà dalla crudeltà.' },
                                    { testo: 'Bakura ha però lasciato una parte della propria oscurità dentro Aknadin. Il sacerdote comincia a desiderare il trono per suo figlio Seto.' }
                                ]
                            },
                            {
                                id: 'anime-9-inseguimento', kind: 'scene', icona: '🐍',
                                label: 'Slifer cade', x: 1210, y: 410,
                                chi: 'Il Faraone',
                                testo: [
                                    { testo: 'Bakura incendia la città e Atem lo insegue evocando Slifer. Aknadin interviene nell’ombra e permette a Diabound di abbattere la Divinità.' },
                                    { chi: 'yugiMuto', testo: 'Atem! Siamo riusciti a raggiungerti. Prendi la nostra forza!' },
                                    { testo: 'Con l’aiuto degli amici Atem richiama Ra nella forma della Fenice e distrugge Diabound.' },
                                    { chi: 'bakura', testo: 'Hai vinto questo momento, Faraone. Ma sono io a muovere la clessidra del gioco.' }
                                ]
                            },
                            {
                                id: 'anime-9-tempo', kind: 'scene', icona: '⌛',
                                label: 'Il tempo riavvolto', x: 1050, y: 455,
                                chi: 'Bakura', chiId: 'bakura',
                                testo: [
                                    { testo: 'Bakura rovescia la Clessidra del Tempo. Gli ultimi eventi vengono cancellati e gli amici non raggiungono più Atem.' },
                                    { chi: 'bakura', testo: 'Senza il tuo piccolo Yugi non puoi evocare Ra. Questa volta Diabound completerà l’attacco.' },
                                    { testo: 'Atem viene sconfitto e scompare dal Mondo dei Ricordi. Bakura prende il Puzzle e la memoria continua senza il suo Faraone.' },
                                    { chi: 'yugiMuto', testo: 'La storia è cambiata, ma Atem è ancora qui da qualche parte. Troveremo il suo nome e lo riporteremo indietro.' }
                                ]
                            },
                            {
                                id: 'anime-9-kul-elna', kind: 'scene', icona: '💀',
                                label: 'Kul Elna', x: 835, y: 445,
                                chi: 'Bakura', chiId: 'bakura',
                                testo: [
                                    { testo: 'A Kul Elna, gli spiriti delle vittime proteggono la Tavola del Mondo dei Morti. Mana scopre il proprio Ka: la Maga Nera.' },
                                    { chi: 'bakura', testo: 'Questo villaggio fu sacrificato per creare gli Oggetti del Millennio. Ora quelle anime apriranno la porta a Zorc.' },
                                    { nome: 'Mahad', testo: 'Il dolore di Kul Elna non giustifica la distruzione dell’intero mondo. Mana, combatti al mio fianco.' },
                                    { testo: 'Mago Nero e Maga Nera abbattono Diabound. Il Re dei Ladri cade, ma Aknadin raccoglie gli Oggetti e li inserisce nella tavola.' },
                                    { testo: 'L’oscurità assume una forma immensa: Zorc Necrophades è tornato.' }
                                ]
                            },
                            // Il sacerdote Seto, Kisara e Aknadin: l'origine del
                            // Drago Bianco Occhi Blu e degli Oggetti del
                            // Millennio. Senza questa scena, Kul Elna (nominata
                            // da Bakura) restava un nome senza spiegazione.
                            {
                                id: 'anime-9-kisara', kind: 'scene', icona: '🐉',
                                label: 'Il Drago di Kisara', x: 1010, y: 535,
                                chi: 'Sacerdote Seto', chiId: 'priestSeto',
                                testo: [
                                    { nome: 'Aknadin', testo: 'Seto, tu sei mio figlio. Con il Drago Bianco e il potere di Zorc prenderai il trono che ti spetta.' },
                                    { chi: 'priestSeto', testo: 'Non voglio un trono costruito sul sangue. Kisara non sarà sacrificata per la tua ambizione.' },
                                    { testo: 'Aknadin attacca Seto. Kisara si frappone e riceve il colpo destinato a lui.' },
                                    { nome: 'Kisara', testo: 'Il mio drago vi ha sempre protetto, sacerdote Seto. Continuerà a farlo anche quando io non ci sarò più.' },
                                    { testo: 'Lo spirito di Kisara assume la forma del Drago Bianco Occhi Blu e spezza il dominio di Aknadin su Seto.' },
                                    { chi: 'priestSeto', testo: 'Kisara… il tuo potere non servirà mai l’odio. Combatterà per proteggere ciò che tu hai salvato.' }
                                ]
                            },
                            // Lo scontro è una traduzione nel motore TCG della
                            // battaglia fra Atem e Seto posseduto da Aknadin.
                            // L'id storico resta invariato per non perdere le
                            // vittorie laterali già salvate nelle partite.
                            {
                                id: 'anime-9-seto-bakura', kind: 'duel', icona: '🐉',
                                label: 'Aknadin possiede Seto', x: 920, y: 560,
                                parallelo: true, sbloccaDopo: 'anime-9-kisara',
                                characterId: 'priestSeto',
                                protagonista: { name: 'Atem', title: 'Il Faraone', image: 'images/characters/yamiYugi.jpg', icon: '👑' },
                                dialogo: [
                                    { chi: 'priestSeto', testo: 'La volontà di Aknadin comanda questo corpo. Il Drago Bianco abbatterà il Faraone e mi consegnerà il trono.' },
                                    { io: true, testo: 'Seto non è la tua pedina. Kisara gli ha affidato il proprio spirito e sarà lei a liberarlo dalla tua oscurità.' }
                                ]
                            },
                            {
                                id: 'anime-9-cartiglio', kind: 'scene', icona: '📜',
                                label: 'La stanza del nome', x: 690, y: 610,
                                chi: 'Yugi Muto', chiId: 'yugiMuto',
                                testo: [
                                    { testo: 'Yugi, Joey e Téa cercano il cartiglio nel palazzo mentre lo spirito di Bakura prende possesso di Tristan e tenta di depistarli.' },
                                    { chi: 'joey', testo: 'Quel sorriso non è di Tristan. Bakura è sempre stato con noi!' },
                                    { chi: 'yugiMuto', testo: 'Il nome è inciso qui, ma non sappiamo leggere i geroglifici. Memorizziamo ogni simbolo e torniamo da Atem.' },
                                    { chi: 'bakura', testo: 'Prima dovrai battermi senza il Faraone che ti protegga. Vediamo quanto vale davvero Yugi Muto.' }
                                ]
                            },
                            // Il Gioco delle Ombre: la partita che Bakura ha
                            // preparato da tremila anni, con l'Egitto come
                            // tabellone e Zorc come ultima pedina. Lo stesso
                            // avversario del duello a palazzo, un altro
                            // scontro — il `label` dice quale.
                            {
                                id: 'anime-9-zorc', kind: 'duel', icona: '🌑',
                                label: 'Yugi contro Bakura', x: 610, y: 675,
                                characterId: 'bakura',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                dialogo: [
                                    { chi: 'bakura', testo: 'Il tuo Deck finirà prima che tu possa portare quei simboli al Faraone. Senza di lui sei soltanto il contenitore del Puzzle.' },
                                    { io: true, testo: 'Atem mi ha insegnato a credere nelle mie carte, non a nascondermi dietro di lui. Gandora aprirà la strada al suo nome.' }
                                ]
                            },
                            {
                                id: 'anime-9-battaglia-zorc', kind: 'scene', icona: '🌑',
                                label: 'La notte di Zorc', x: 775, y: 500,
                                chi: 'Il Faraone',
                                testo: [
                                    { testo: 'Zorc devasta la capitale. Shada e Isis sacrificano la vita per proteggere il Faraone; Shimon libera Exodia, ma persino il Proibito viene sconfitto.' },
                                    { nome: 'Shimon Muran', testo: 'Exodia può trattenere l’oscurità soltanto per poco. Ritrova il tuo nome, mio Faraone.' },
                                    { testo: 'Atem richiama Obelisk, Slifer e Ra. Zorc resiste e distrugge anche le tre Divinità.' },
                                    { chi: 'kaiba', testo: 'Tre Draghi Bianchi non bastano? Allora guarda il Drago Bianco Occhi Blu Finale!' },
                                    { testo: 'Kaiba porta nel Mondo dei Ricordi il proprio Deck. Il Drago Finale si fonde con la forza di Atem nel Cavaliere del Destino, ma Zorc sopravvive ancora.' },
                                    { chi: 'yugiMuto', testo: 'Non serve un mostro più forte. Serve il nome che unisce il Faraone alla sua vera anima.' }
                                ]
                            },
                            {
                                id: 'anime-9-nome', kind: 'scene', icona: '👑',
                                // Sotto la scacchiera di Zorc, verso il tempio:
                                // il nome ritrovato apre la strada all'ultima porta.
                                label: 'Atem', x: 860, y: 620,
                                chi: 'Il Faraone',
                                testo: [
                                    { chi: 'yugiMuto', testo: 'Il tuo nome, Faraone! L’ho trovato! Atem!' },
                                    { io: true, testo: 'Atem… Sì. Ora ricordo chi sono.' },
                                    { chi: 'bakura', testo: 'No! Zorc non può perdere! Il mio tabellone…' },
                                    { testo: 'Con il suo vero nome Atem richiama nuovamente le tre Divinità. Obelisk, Slifer e Ra si uniscono in Horakhty, la Creatrice della Luce.' },
                                    { nome: 'Horakhty', testo: 'L’oscurità non può esistere davanti alla luce della creazione.' },
                                    { testo: 'Horakhty cancella Zorc e con lui lo spirito oscuro di Bakura. Il Mondo dei Ricordi ha raggiunto finalmente la sua conclusione.' },
                                    { chi: 'yugiMuto', testo: 'Ce l’hai fatta, Atem. La porta dell’aldilà si sta aprendo.' },
                                    { io: true, testo: 'Per attraversarla devo ancora dimostrare di essere pronto a lasciare tutto ciò che mi lega al presente.' }
                                ]
                            },
                            {
                                id: 'anime-9-ritorno', kind: 'scene', icona: '☀️',
                                label: 'Fuori dai ricordi', x: 990, y: 705,
                                chi: 'Il Faraone',
                                testo: [
                                    { testo: 'Il gioco termina. Atem affida l’Egitto al sacerdote Seto e torna nel presente insieme a Yugi e agli altri.' },
                                    { chi: 'yugiMuto', testo: 'Ora conosciamo il tuo nome, ma questo significa che possiamo compiere il rito che libererà la tua anima.' },
                                    { io: true, testo: 'È ciò che ho cercato per tutto questo tempo. Eppure separarmi da voi sarà la prova più difficile.' },
                                    { chi: 'joey', testo: 'Qualunque cosa chieda quel rito, la affronteremo tutti insieme.' }
                                ]
                            },
                            {
                                id: 'anime-9-luxor', kind: 'scene', icona: '✈️',
                                label: 'Verso il tempio', x: 1090, y: 855,
                                chi: 'Seto Kaiba', chiId: 'kaiba',
                                testo: [
                                    { testo: 'Una tempesta di sabbia blocca il volo dal Cairo a Luxor. Kaiba raggiunge il gruppo con il Blue-Eyes White Dragon Jet.' },
                                    { chi: 'kaiba', testo: 'Non ho attraversato mezzo mondo per vedervi fermati dal meteo. Salite: vi porterò io al tempio.' },
                                    { chi: 'yugiMuto', testo: 'Il rito richiederà che uno di noi sconfigga Atem. Devo essere io.' },
                                    { chi: 'kaiba', testo: 'Se credi davvero di poter battere il Re dei Giochi, dimostralo. Io non accetterò trucchi né addii preparati.' }
                                ]
                            },
                            {
                                id: 'anime-5-scena', kind: 'scene', icona: '🏛️',
                                label: 'L\'ultima porta', x: 1165, y: 790,
                                chi: 'Il Faraone',
                                testo: [
                                    { chi: 'yugiMuto', testo: 'Atem… manca un solo duello. E non è contro un nemico.' },
                                    { io: true, testo: 'Lo so. Per lasciarmi andare, devi battermi.' },
                                    { chi: 'yugiMuto', testo: 'Non c’è un rito, non c’è una formula. C’è una partita, giocata sul serio, come tutte le altre.' },
                                    { io: true, testo: 'E dovrai giocarla per vincere. Se ti lasci battere, mi tieni qui, ed è l’unica cosa che non puoi farmi.' },
                                    { chi: 'yugiMuto', testo: 'Va bene. Ti prometto che non mi tratterrò. Mi hai insegnato tu a giocare questo duello.' }
                                ]
                            },
                            // Il Duello Cerimoniale: qui non si è il Faraone,
                            // lo si AFFRONTA. `protagonista` sulla prova vince
                            // su quello della campagna (vedi resolvePlayer in
                            // js/duel-session.js).
                            {
                                id: 'anime-5-yamiyugi', kind: 'duel', icona: '👑',
                                label: 'Il Duello Cerimoniale', x: 1280, y: 745,
                                characterId: 'yamiYugi',
                                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                                dialogo: [
                                    { chi: 'yamiYugi', testo: 'Per aprirmi la porta dell’aldilà devi sconfiggermi mentre combatto con tutta la mia forza, compresi i tre Dei Egizi.' },
                                    { io: true, testo: 'Non proverò a trattenerti e non ti chiederò di lasciarmi vincere. Questo sarà il duello che dimostrerà quanto siamo cresciuti entrambi.' }
                                ]
                            },
                            // La fine della serie: Atem attraversa la porta.
                            // Era l'ultima cosa che mancava — la campagna finiva
                            // sul duello, senza il saluto.
                            {
                                id: 'anime-5-addio', kind: 'scene', icona: '🌟',
                                label: 'La porta si apre', x: 1375, y: 650,
                                chi: 'Il Faraone',
                                testo: [
                                    { chi: 'yugiMuto', testo: 'Ho vinto… ho vinto davvero. Allora è finita, vero?' },
                                    { chi: 'yamiYugi', testo: 'Sì, Yugi. Hai dimostrato di non avere più bisogno di me. Sei diventato forte, e ora tocca a te camminare da solo.' },
                                    { chi: 'joey', testo: 'Ehi, non puoi andartene così! Siamo una squadra!' },
                                    { chi: 'yamiYugi', testo: 'E lo resteremo, Joey. Gli amici non smettono di esserlo solo perché non si vedono più.' },
                                    { testo: 'L’Occhio di Wedjat si accende sulla porta. Atem la attraversa senza voltarsi: dall’altra parte lo aspettano i suoi sacerdoti, e Mahad, e suo padre.' },
                                    { chi: 'yugiMuto', testo: 'Addio, Faraone. Grazie di tutto.' },
                                    { testo: 'Il tempio crolla, e gli Oggetti del Millennio sprofondano con lui. È finita: il Re dei Giochi ha trovato la pace.' }
                                ]
                            },
                            {
                                id: 'anime-5-aeroporto', kind: 'scene', icona: '✈️',
                                label: 'Ritorno a Domino', x: 1410, y: 910,
                                chi: 'Yugi Muto', chiId: 'yugiMuto',
                                testo: [
                                    { testo: 'Durante il volo verso il Giappone, il Blue-Eyes White Dragon Jet di Kaiba supera l’aereo del gruppo. Atem non è più con loro, ma il silenzio non pesa come una sconfitta.' },
                                    { chi: 'tea', testo: 'Mi mancherà. Però credo che sia questo che voleva: vederci andare avanti.' },
                                    { chi: 'joey', testo: 'E allora andiamo avanti insieme. Ma appena torniamo a Domino voglio la rivincita, Yugi!' },
                                    { chi: 'tristan', testo: 'Siamo quasi a casa. E stavolta nessun Gioco delle Ombre ci aspetta all’atterraggio… spero.' },
                                    { chi: 'yugiMuto', testo: 'Atem ha trovato la sua strada. Ora tocca a noi continuare la nostra.' },
                                    { testo: 'In aeroporto Rebecca corre ad abbracciare Yugi mentre Arthur Hawkins saluta il gruppo. Il viaggio del Faraone è concluso; quello di Yugi e dei suoi amici continua.' }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        // Le aree nate STACCANDO le prime tappe di un'area che esisteva già.
        // L'avanzamento si salva per POSIZIONE (vedi story-progress.js), e
        // una tappa in più in testa sposterebbe di uno tutto quello che
        // viene dopo: chi era a metà del Regno si ritroverebbe altrove. Ogni
        // voce dice quale area è stata staccata da quale, e quante tappe si
        // è portata via; StoryProgress la applica UNA volta ai salvataggi
        // scritti prima (che non ne portano l'id) e la timbra su tutti
        // quelli scritti dopo. L'`id` non va mai cambiato né riusato.
        //
        // SALVATAGGI VECCHI: un avanzamento scritto PRIMA di questa voce
        // (cioè prima che i contatori delle aree contassero le sole prove
        // principali) non si migra più, si AZZERA: le migrazioni in
        // sequenza, applicate a salvataggi così vecchi, li riportavano in
        // un punto sbagliato della mappa (misurato: un salvataggio "davanti
        // a Pegasus" ripartiva da metà Regno). Resta salvato solo il fatto
        // di aver già ritirato il premio finale, così non si paga due volte.
        // Da questa voce in poi vale la migrazione di sempre.
        azzeraSeSenzaTimbro: 'anime-rami-paralleli',
        separazioni: [
            // Le migrazioni delle forme PIÙ VECCHIE del catalogo (staccare il
            // prologo dal Regno, il castello come area e poi come seconda
            // mappa, le tappe inserite nel Regno, a Battle City, nel
            // Prologo e nel Mondo dei Ricordi) sono state tolte: i salvataggi
            // scritti prima di 'anime-rami-paralleli' ora si azzerano
            // (`azzeraSeSenzaTimbro`), quindi nessuna di quelle voci poteva
            // più applicarsi. I loro id restano storici e NON vanno riusati.
            // Le voci da 'anime-rami-paralleli' in giù si applicano ancora ai
            // salvataggi che portano il timbro di base.
            // 'anime-rami-paralleli' resta come MARCATORE del timbro di base:
            // chi scrive oggi lo porta, e senza di lui verrebbe azzerato. La
            // sua conversione non si applica più (i salvataggi senza timbro
            // sono già azzerati prima), ma l'id deve restare in lista.
            { id: 'anime-rami-paralleli', dalla: 'laterali', aree: ['anime-area-regno', 'anime-area-battlecity1', 'anime-area-virtuale', 'anime-area-battlecity2'] },
            { id: 'anime-duello-video-pegasus', dalla: 'principali-fine', area: 'anime-area-prologo', quante: 1 },
            { id: 'anime-bakura-isola', dalla: 'principali-inserite', area: 'anime-area-regno', prima: 'anime-2-mai', quante: 1 },
            { id: 'anime-falso-kaiba', dalla: 'principali-inserite', area: 'anime-area-regno', prima: 'anime-2-mai', quante: 1 },
            { id: 'anime-duello-joey-molo', dalla: 'principali-inserite', area: 'anime-area-battlecity1', prima: 'anime-3-marik-molo', quante: 1 },
            // Revisione di fedeltà all'anime (2026-10-11). Con `ids` la voce
            // dice ESATTAMENTE quali tappe sono nate, e la posizione si ricava
            // da loro: vedi applicaSeparazioni in js/story/story-progress.js.
            // Nella stessa area vanno in ordine di posizione.
            { id: 'anime-fedelta-tempo-scaduto', dalla: 'principali-fine', area: 'anime-area-prologo', ids: ['anime-1-tempo-scaduto'] },
            { id: 'anime-fedelta-parapetto', dalla: 'principali-inserite', area: 'anime-area-regno', ids: ['anime-2-kaiba-torre'] },
            { id: 'anime-fedelta-otto-finalisti', dalla: 'principali-inserite', area: 'anime-area-battlecity1', ids: ['anime-3-finali'] },
            { id: 'anime-fedelta-cinque-uniti', dalla: 'principali-inserite', area: 'anime-area-virtuale', ids: ['anime-6-cinque-uniti'] },
            { id: 'anime-fedelta-gozaburo', dalla: 'principali-inserite', area: 'anime-area-virtuale', ids: ['anime-6-kaiba-gozaburo'] },
            { id: 'anime-fedelta-battaglia-reale', dalla: 'principali-inserite', area: 'anime-area-battlecity2', ids: ['anime-4b-battaglia-reale'] },
            { id: 'anime-fedelta-epilogo-bc', dalla: 'principali-fine', area: 'anime-area-battlecity2', ids: ['anime-4b-epilogo'] },
            { id: 'anime-fedelta-kisara', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-kisara'] },
            { id: 'anime-fedelta-addio', dalla: 'principali-fine', area: 'anime-area-cerimoniale', ids: ['anime-5-addio'] },
            { id: 'anime-fedelta-aeroporto', dalla: 'principali-fine', area: 'anime-area-cerimoniale', ids: ['anime-5-aeroporto'] },
            // Rework completo del Mondo dei Ricordi. Le tappe sono timbrate
            // separatamente perché sono distribuite fra nodi storici già
            // esistenti: una sola quantità non conserverebbe correttamente
            // il punto preciso di un salvataggio a metà dell'area.
            { id: 'anime-fedelta-memoria-prologo', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-prologo'] },
            { id: 'anime-fedelta-memoria-porta', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-porta'] },
            { id: 'anime-fedelta-memoria-incoronazione', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-incoronazione'] },
            { id: 'anime-fedelta-memoria-caccia-ka', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-caccia-ka'] },
            { id: 'anime-fedelta-memoria-inseguimento', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-inseguimento'] },
            { id: 'anime-fedelta-memoria-tempo', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-tempo'] },
            { id: 'anime-fedelta-memoria-kul-elna', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-kul-elna'] },
            { id: 'anime-fedelta-memoria-cartiglio', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-cartiglio'] },
            { id: 'anime-fedelta-memoria-zorc', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-battaglia-zorc'] },
            { id: 'anime-fedelta-memoria-ritorno', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-ritorno'] },
            { id: 'anime-fedelta-memoria-luxor', dalla: 'principali-inserite', area: 'anime-area-cerimoniale', ids: ['anime-9-luxor'] }
        ],
        // Premio per aver finito la campagna. Accreditato una volta sola
        // (vedi story-progress.js): rigiocarla è permesso, ripagarla no.
        premioFinale: { credits: 3000, starChips: 5, locatorCards: 5, millenniumCards: 3 }
    },

    {
        id: 'forbiddenMemories',
        nome: 'Memorie Proibite',
        sottotitolo: 'Il Principe e i Cinque Maghi Guerrieri',
        icona: '🏺',
        sfondo: ['images/maps/storia_forbidden_memories_1.jpg', 'images/fields/mobile/anticoEgittoGiorno_2.jpg'],
        // Due brani della colonna sonora del gioco originale, scelti per
        // ora e da rivedere: la campagna li ha per non suonare come il
        // menu, non perché siano definitivi.
        musica: '02. Input Name.mp3',
        musicaDuello: '39. Free Duel.mp3',
        // ATEM, non "il Principe": nel gioco originale resta senza nome
        // per tutta la storia perché il nome se l'è dimenticato lui, non
        // perché non ce l'abbia. Chi gioca lo sa, e chiamarlo col suo nome
        // è la stessa cosa che chiamare Yami Yugi col suo.
        // Ritratto SUO e non quello di Yami Yugi: qui e' il faraone in
        // Egitto, cinquemila anni prima di finire dentro il Puzzle. Nel
        // capitolo del presente resta comunque Yugi Muto, che ha il
        // proprio `protagonista` a livello di capitolo e vince su questo.
        protagonista: { name: 'Atem', title: 'Il Faraone senza memoria', image: 'images/characters/atem.jpg', icon: '👑' },
        descrizione: 'La trama di Yu-Gi-Oh! Forbidden Memories, seguita da vicino: il colpo di stato di Heishin, il sigillo nel Puzzle del Millennio, il risveglio cinquemila anni dopo e il ritorno nel passato per riprendersi gli Oggetti, uno alla volta.',
        carteAmmesse: { origini: ['yu-gi-oh'] },
        larghezza: 3200,
        altezza: 1800,
        capitoli: [
            {
                id: 'fm-principe',
                nome: 'Il Regno del Principe',
                // Cinquemila anni, come nel gioco e come nel resto di questa
                // campagna (qui c'era scritto "tremila").
                testo: 'Cinquemila anni prima di tutto: un regno in pace, un maestro severo, e un principe che scappa dal palazzo per duellare in paese.',
                tappe: [
                    {
                        id: 'fm-1-scena', kind: 'scene', icona: '🏛️',
                        label: 'La lezione', x: 1640, y: 350,
                        chi: 'Simon Muran', chiId: 'simonMuran',
                        testo: [
                            'Mio principe, le guardie ti hanno visto scavalcare di nuovo il muro del giardino. A duellare in paese, con la gente del mercato.',
                            'Tuo padre mi ha affidato due cose: te e i Sette Oggetti del Millennio. Della seconda si occupano i sacerdoti; della prima, purtroppo, io.',
                            'Non ti proibirò di giocare: questo gioco è vecchio quanto il regno, e insegna a leggere l\'avversario prima che muova.',
                            'Ti chiedo solo di battere prima me. Finché mi batti, so che fuori da queste mura sai cavartela.',
                            'E un giorno ti servirà saperlo fare contro qualcuno che non ti vuole bene.'
                        ]
                    },
                    {
                        id: 'fm-1-simon', kind: 'duel', icona: '📜',
                        label: 'Simon Muran', x: 1470, y: 520,
                        characterId: 'simonMuran',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
,
                        dialogo: [
                            { chi: 'simonMuran', testo: 'Regola prima: un duello non si vince con le carte che hai, ma con quelle che l\'altro crede che tu abbia.' },
                            { chi: 'simonMuran', testo: 'Regola seconda, e piu\' importante: se perdi contro il tuo tutore non succede niente. Fuori da questa stanza non e\' cosi\'.' },
                            { io: true, testo: 'Allora facciamo in modo che la seconda non mi serva mai.' }
                        ]
                    },
                    // Nel gioco il principe incontra Teana e Jono all'arena del
                    // paese, non a palazzo: è lì che scappa a duellare. Teana
                    // viene prima di Jono, come nell'ordine originale.
                    {
                        id: 'fm-1-teana', kind: 'duel', icona: '🌾',
                        label: 'Teana', x: 1450, y: 900,
                        characterId: 'teana',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg'
,
                        dialogo: [
                            { chi: 'teana', testo: 'Un ragazzo col mantello troppo bello per il mercato… e scommetto che fuggi da qualche maestro.' },
                            { chi: 'teana', testo: 'Qui all\'arena nessuno ti fa vincere perché sei di buona famiglia. E non fare quella faccia: lo vedo, quando qualcuno si trattiene.' },
                            { io: true, testo: 'Non ho intenzione di trattenermi.' }
                        ]
                    },
                    {
                        id: 'fm-1-jono', kind: 'duel', icona: '🗡️',
                        label: 'Jono', x: 1640, y: 960,
                        characterId: 'jono',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg'
,
                        dialogo: [
                            { chi: 'jono', testo: 'Hai battuto Teana? Allora tocca a me. Io non ho un tutore che mi insegna le regole: ho imparato qui, dove chi perde paga davvero.' },
                            { chi: 'jono', testo: 'E stasera c\'è la festa: se vinco, mi offri da bere. Se vinci tu, ti porto a vedere i duelli dei sacerdoti.' },
                            { io: true, testo: 'Allora preparati a portarmi alla festa.' }
                        ]
                    },
                    // Alla festa del paese il sacerdote Seto umilia Jono, e il
                    // principe lo sfida. Nel gioco è qui che Seto compare, ed
                    // è qui che promette di rivedere il principe. Prendeva il
                    // posto di un duello con la Sacerdotessa Isis, che nel
                    // passato non c'è: la si incontra solo nel torneo di Kaiba.
                    {
                        id: 'fm-1-seto-festa', kind: 'duel', icona: '🔺',
                        label: 'Seto alla festa', x: 1850, y: 880,
                        characterId: 'priestSeto',
                        field: 'images/fields/mobile/anticoEgittoNotte_1.jpg'
,
                        dialogo: [
                            { chi: 'jono', testo: 'Ahi… quel sacerdote mi ha spazzato via in tre turni. E ride pure.' },
                            { chi: 'priestSeto', testo: 'Un mendicante che gioca con le carte dei re. E tu chi saresti, ragazzino, per difenderlo?' },
                            { io: true, testo: 'Uno che non ride di chi ha appena battuto. Sfido te, sacerdote.' },
                            { chi: 'priestSeto', testo: 'Come vuoi. Ma ricordati la mia faccia: chi mi batte, prima o poi, mi rivede.' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-caduta',
                nome: 'La Caduta',
                testo: 'Heishin prende i Sette Oggetti in una notte sola. A Simon resta una cosa da fare, e la fa.',
                tappe: [
                    {
                        id: 'fm-2-presagio', kind: 'scene', icona: '🌘',
                        label: 'Il potere oscuro', x: 1880, y: 440,
                        chi: 'Simon Muran', chiId: 'simonMuran',
                        testo: [
                            'Ho trovato Heishin nelle rovine proibite. Dice di aver scoperto un Potere Oscuro e brandisce la Barra del Millennio come se gli appartenesse.',
                            'Quando gli ho chiesto di fermarsi mi ha colpito con la Barra. Non vuole soltanto il trono: sta cercando gli altri sei Oggetti.',
                            'I suoi uomini stanno entrando nel palazzo. Il Re e la Regina sono prigionieri, e Heishin userà le loro vite per costringerti a consegnare il Puzzle.',
                            'Se non potremo fermarlo, dovrai spezzare il Puzzle. Le nostre anime resteranno sigillate al suo interno finché qualcuno non lo ricomporrà.'
                        ]
                    },
                    {
                        id: 'fm-2-scena', kind: 'scene', icona: '⚔️',
                        label: 'Il colpo di stato', x: 2000, y: 580,
                        chi: 'Heishin', chiId: 'heishin',
                        testo: [
                            'Il Faraone e la Regina sono nelle mie mani. Le guardie si sono arrese prima dell\'alba: non per paura di me, per paura di quello che ho trovato nelle Rovine Proibite.',
                            'Il tesoro degli antichi stregoni. Un potere che i vostri sacerdoti hanno sepolto perché non sapevano usarlo.',
                            'Sette Oggetti del Millennio, uno per sacerdote, e nessuno che si chiedesse mai cosa succederebbe se fossero tutti nelle stesse mani.',
                            'Ne mancano ancora. Il più prezioso lo porta il principe al collo, o lo nasconde il suo vecchio maestro.',
                            'Trovateli. Il trono viene dopo: è la parte facile.'
                        ]
                    },
                    // Nel gioco Seto è fra gli invasori, ma non duella: pretende
                    // il Puzzle in cambio di una via di fuga. Il principe
                    // rifiuta, e alle sue spalle arriva Simon, ferito, col
                    // Puzzle in mano. Il tradimento vero di Seto arriva solo
                    // alla fine della storia.
                    {
                        id: 'fm-2-seto', kind: 'scene', icona: '🔺',
                        label: 'L\'offerta di Seto', x: 1850, y: 660,
                        chi: 'Sacerdote Seto', chiId: 'priestSeto',
                        testo: [
                            { chi: 'priestSeto', testo: 'Ci rivediamo, principe. Te l\'avevo detto, alla festa.' },
                            { chi: 'priestSeto', testo: 'Dammi il Puzzle del Millennio e ti faccio uscire dal palazzo vivo. Nessuno saprà che sono stato io ad aprirti la porta.' },
                            { io: true, testo: 'Sei venuto insieme agli uomini che hanno incatenato mio padre. Il Puzzle non lo avrai, Seto.' },
                            { chi: 'priestSeto', testo: 'Come vuoi. Heishin non sarà gentile quanto me.' },
                            { chi: 'simonMuran', testo: 'Principe… di qua, presto! Il Puzzle ce l\'ho io. Heishin mi è alle calcagna.' }
                        ]
                    },
                    {
                        id: 'fm-2-heishin', kind: 'duel', icona: '🏛️',
                        label: 'Heishin', x: 1665, y: 700,
                        characterId: 'heishin',
                        field: 'images/fields/mobile/anticoEgittoNotte_1.jpg'
,
                        dialogo: [
                            { chi: 'heishin', testo: 'Il vecchio maestro col Puzzle in mano, e il principe che lo protegge. Che quadretto commovente.' },
                            { chi: 'heishin', testo: 'Facciamo così, principe: un duello. Vinci, e forse ti lascio andare. Perdi, e il Puzzle è mio.' },
                            { io: true, testo: 'Accetto. Ma non per il Puzzle: per mio padre.' }
                        ]
                    },
                    // Nel gioco questo duello si perde per forza, ed è da lì che
                    // il principe spezza il Puzzle. Qui si vince, e la scena
                    // racconta quello che succede comunque: Heishin non ha mai
                    // voluto rispettare il patto.
                    {
                        id: 'fm-2-sigillo', kind: 'scene', icona: '🧩',
                        label: 'Il sigillo', x: 1480, y: 640,
                        chi: 'Simon Muran', chiId: 'simonMuran',
                        testo: [
                            { chi: 'heishin', testo: 'Hai vinto la partita, principe. Peccato che io non abbia mai giocato per rispettarla. Guardie: prendete il Puzzle.' },
                            { chi: 'simonMuran', testo: 'Non posso salvare il regno, principe. Posso salvare te, e solo in un modo: spezza il Puzzle. Adesso, mentre li trattengo io.' },
                            { io: true, testo: 'Simon, se lo spezzo…' },
                            { chi: 'simonMuran', testo: 'Le nostre anime resteranno sigillate dentro, la tua e la mia. Dormirai finché qualcuno non avrà la pazienza di rimetterlo insieme. Non la forza: la pazienza.' },
                            { chi: 'simonMuran', testo: 'Potrebbero volerci molti anni. Non ho un numero da darti.' },
                            { testo: 'Il principe alza il Puzzle sopra la testa e lo lascia cadere. Mille pezzi d\'oro si spargono sul pavimento, e il palazzo sparisce nel buio.' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-presente',
                nome: 'Cinquemila anni dopo',
                testo: 'Il sigillo si spezza nel presente. Per tornare indietro manca un pezzo, e ce l\'ha qualcun altro.',
                // NEL PRESENTE NON SEI ATEM, SEI YUGI MUTO. Il Faraone è
                // dentro il Puzzle; a duellare nel torneo della Kaiba
                // Corporation è il ragazzo che quel Puzzle l'ha rimesso
                // insieme, e che a quel punto non sa ancora chi si porti al
                // collo. Il `protagonista` del CAPITOLO vince su quello
                // della campagna per tutte le sue tappe, torneo compreso.
                protagonista: { name: 'Yugi Muto', title: 'Il ragazzo del Puzzle', image: 'images/characters/yugiMuto.jpg', icon: '🧩' },
                tappe: [
                    // Nel gioco il presente si apre con Yugi che si sveglia da un
                    // sogno: un principe, un palazzo in fiamme, un Puzzle che si
                    // spezza. Shadi arriva solo più tardi, a torneo iniziato.
                    {
                        id: 'fm-3-scena', kind: 'scene', icona: '💡',
                        label: 'Il sogno', x: 1560, y: 1600,
                        chi: 'Yugi Muto', chiId: 'yugiMuto',
                        testo: [
                            { testo: 'Domino City, cinquemila anni dopo. Un ragazzo si sveglia di soprassalto, con il Puzzle del Millennio stretto fra le mani.' },
                            { io: true, testo: 'Ancora quel sogno… un principe, un palazzo in fiamme, un vecchio che gli dice di spezzare il Puzzle.' },
                            { io: true, testo: 'L\'ho rimesso insieme pezzo per pezzo, per anni. È come se qualcuno, là dentro, stesse aspettando proprio me.' },
                            { chi: 'solomonMuto', testo: 'Yugi, sei sveglio? Il torneo mondiale della Kaiba Corporation comincia oggi. Non vorrai arrivare tardi!' }
                        ]
                    },
                    // L'iscrizione al torneo. Era un duello con Shadi prima del
                    // torneo, che nel gioco non c'è: Shadi Yugi lo incontra dopo
                    // i preliminari, e lo affronta nelle finali.
                    {
                        id: 'fm-3-shadi', kind: 'scene', icona: '🎟️',
                        label: 'L\'iscrizione', x: 1760, y: 1690,
                        chi: 'Joey Wheeler', chiId: 'joey',
                        testo: [
                            { chi: 'joey', testo: 'Yugi! Di qua! Lo stadio di Kaiba è pieno di gente: ci sono duellanti da tutto il mondo.' },
                            { chi: 'tea', testo: 'Rex Raptor, Weevil, Mai Valentine… perfino Bandit Keith. Sei sicuro di volerti iscrivere?' },
                            { io: true, testo: 'Sicuro. Non so spiegarlo, ma sento che qui dentro troverò la risposta a quel sogno.' },
                            { chi: 'joey', testo: 'Allora vai e falli neri. Noi tifiamo dagli spalti!' }
                        ]
                    },
                    // IL TORNEO DELLA KAIBA CORPORATION.
                    // Nel gioco originale il presente non è una fila di
                    // duelli qualsiasi: è un torneo, si sale un incontro
                    // alla volta e chi perde ricomincia da capo. Qui è una
                    // tappa sola della campagna che dentro ha il proprio
                    // percorso, con la propria mappa (vedi `kind: 'torneo'`
                    // nell'intestazione di questo file).
                    {
                        id: 'fm-3-torneo', kind: 'torneo', icona: '🏟️',
                        label: 'Il torneo di Kaiba', x: 1960, y: 1620,
                        nome: 'Torneo della Kaiba Corporation',
                        testo: 'Quattro preliminari e cinque finali fino al presidente. Chi perde esce dal tabellone e ricomincia dal primo.',
                        mappa: {
                            sfondo: ['images/maps/storia_torneo_kaiba_1.jpg', 'images/fields/mobile/stadioKaiba.jpg'],
                            larghezza: 3200,
                            altezza: 1800
                        },
                        // L'ORDINE È QUELLO DEL GIOCO PS1, non una scelta:
                        // quattro preliminari (Rex, Weevil, Mai, Bandit
                        // Keith) e poi le finali (Shadi, Yami Bakura,
                        // Pegasus, Isis, Seto Kaiba). I cinque finalisti
                        // portano SEI Oggetti del Millennio (Shadi ne ha
                        // due, la Chiave e la Bilancia): con il Puzzle fanno
                        // sette, ed è il motivo per cui il torneo esiste.
                        // MARIK NON C'È, e non è una dimenticanza: in
                        // Forbidden Memories non compare affatto — il
                        // duellante oscuro di questo tabellone è Yami
                        // Bakura, che è anche quello che porta l'Anello.
                        // I nodi stanno su due file perché la mappa del
                        // tabellone non esiste ancora: quando arriverà, si
                        // poseranno sui suoi luoghi come nelle campagne.
                        tappe: [
                            {
                                id: 'fm-3t-rex', kind: 'duel', icona: '🦖',
                                label: 'Primo preliminare', x: 420, y: 560,
                                characterId: 'rex',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'rex', testo: 'Primo turno, e mi tocca il nanerottolo col ciondolo. Che fortuna.' },
                                    { chi: 'rex', testo: 'Nel mio mazzo non c\'è niente di astuto. C\'è roba grossa che passa sopra a quello che trova.' },
                                    { io: true, testo: 'Anche i dinosauri si sono estinti.' }
                                ]
                            },
                            {
                                id: 'fm-3t-weevil', kind: 'duel', icona: '🐛',
                                label: 'Secondo preliminare', x: 1000, y: 560,
                                characterId: 'weevil',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'weevil', testo: 'Hai battuto il ragazzo dei dinosauri. Roba grossa e lenta: facile.' },
                                    { chi: 'weevil', testo: 'Sai qual è il bello degli insetti? Che quando te ne accorgi hanno già mangiato tutto.' },
                                    { io: true, testo: 'Allora comincia a masticare.' }
                                ]
                            },
                            {
                                id: 'fm-3t-mai', kind: 'duel', icona: '🦋',
                                label: 'Terzo preliminare', x: 1580, y: 560,
                                characterId: 'mai',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'mai', testo: 'Terzo preliminare, tesoro. Da qui in poi non si gioca più per divertirsi.' },
                                    { chi: 'mai', testo: 'Io non leggo le carte: leggo chi le tiene in mano. E tu hai qualcosa addosso che ti pesa più del mazzo.' },
                                    { io: true, testo: 'Non è un peso. È un debito.' }
                                ]
                            },
                            {
                                id: 'fm-3t-keith', kind: 'duel', icona: '🎰',
                                label: 'Ultimo preliminare', x: 2160, y: 560,
                                characterId: 'bandit_keith',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'bandit_keith', testo: 'Ultimo preliminare. Io in questo stadio ci sono già stato, e non me ne sono andato con le mani vuote.' },
                                    { chi: 'bandit_keith', testo: 'Regola numero uno: vince chi arriva in fondo. Come ci arriva non lo chiede nessuno.' },
                                    { io: true, testo: 'Lo chiedo io.' }
                                ]
                            },
                            // Finiti i preliminari, nel gioco compare Shadi: con
                            // la Chiave del Millennio porta Yugi dentro la sua
                            // mente, dove incontra il principe, che gli dà sei
                            // carte bianche. Senza questa scena le finali "per
                            // gli Oggetti" arrivavano senza spiegazione.
                            {
                                id: 'fm-3t-dentro-il-puzzle', kind: 'scene', icona: '🗝️',
                                label: 'Dentro il Puzzle', x: 2450, y: 900,
                                chi: 'Shadi', chiId: 'shadi',
                                testo: [
                                    { chi: 'shadi', testo: 'Ti ho seguito fin qui, ragazzo. Gli Oggetti del Millennio si sono risvegliati tutti insieme, nello stesso stadio, e non è un caso.' },
                                    { chi: 'shadi', testo: 'Il principe del tuo sogno è reale: è lo spirito che dorme nel tuo Puzzle. Con la Chiave del Millennio posso aprirti la porta della tua mente. Entra.' },
                                    { testo: 'Un corridoio di pietra, mille porte, e in fondo un ragazzo che ha il volto di Yugi, ma uno sguardo più antico.' },
                                    { nome: 'Il principe', icona: '👑', testo: 'Sei tu ad avermi svegliato. Ti chiedo un ultimo favore: nelle finali ci sono sei Oggetti del Millennio. Vinci, e queste sei carte bianche li custodiranno.' },
                                    { nome: 'Il principe', icona: '👑', testo: 'Con il tuo Puzzle saranno sette. E sette Oggetti possono riportarmi a casa, dove il mio regno aspetta ancora di essere liberato.' },
                                    { io: true, testo: 'Allora vincerò per te. Lasciami solo un po\' di coraggio.' }
                                ]
                            },
                            {
                                id: 'fm-3t-shadi', kind: 'duel', icona: '🗝️',
                                label: 'Finali · la Chiave', x: 2740, y: 560,
                                characterId: 'shadi',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'shadi', testo: 'Sei arrivato alle finali. Ora la parte che conta: nessuno dei quattro che ti restano davanti è qui per il torneo.' },
                                    { io: true, testo: 'E tu perché ci sei?' },
                                    { chi: 'shadi', testo: 'Per vedere se meriti quello che stai per riprenderti. Porto due Oggetti, la Chiave e la Bilancia: la Bilancia pesa il cuore, e la Chiave apre solo a chi ha già dentro qualcosa da aprire.' },
                                    { chi: 'shadi', testo: 'Battimi, e saranno tuoi tutti e due. Perdi, e resterai un ragazzo con un bel ciondolo.' }
                                ]
                            },
                            {
                                id: 'fm-3t-bakura', kind: 'duel', icona: '💍',
                                label: 'Finali · l\'Anello', x: 2740, y: 1240,
                                characterId: 'bakura',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'bakura', testo: 'L\'Anello del Millennio mi ha portato qui. Dice che sei tu, e l\'Anello indica sempre la direzione giusta.' },
                                    { io: true, testo: 'E cosa ti aspetti di trovarci?' },
                                    { chi: 'bakura', testo: 'Quello che c\'è dentro il tuo Puzzle. Da cinquemila anni, e non è il ragazzo.' },
                                    { chi: 'bakura', testo: 'Fallo uscire. Sono venuto per lui, non per te.' }
                                ]
                            },
                            {
                                id: 'fm-3t-pegasus', kind: 'duel', icona: '👁️',
                                label: 'Finali · l\'Occhio', x: 2160, y: 1240,
                                characterId: 'pegasus',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'pegasus', testo: 'Questo gioco l\'ho inventato io, ragazzo. Ogni carta che hai in mano l\'ho disegnata io, una per una.' },
                                    { chi: 'pegasus', testo: 'E con l\'Occhio del Millennio le vedo tutte comodamente da qui, mentre le giochi. Tu invece del mio mazzo non sai niente.' },
                                    { io: true, testo: 'Sapere cosa faccio non è sapere perché lo faccio.' },
                                    { chi: 'pegasus', testo: 'Ooh. Una risposta interessante. Vediamo se regge quanto il tono.' }
                                ]
                            },
                            {
                                id: 'fm-3t-isis', kind: 'duel', icona: '📿',
                                label: 'Finali · la Collana', x: 1580, y: 1240,
                                characterId: 'ishizu',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'ishizu', testo: 'La Collana del Millennio mostra quello che deve accadere. Ho visto questo duello molto prima di sederti davanti.' },
                                    { io: true, testo: 'E come finisce?' },
                                    { chi: 'ishizu', testo: 'Con te che vinci. Ma vedere la fine non è viverla: la mia famiglia custodisce da cinquemila anni il nome che tu hai dimenticato, e te lo restituisco solo se arrivi in fondo da solo.' },
                                    { chi: 'ishizu', testo: 'Quindi giocherò per vincere. Sarebbe un insulto fare altrimenti.' }
                                ]
                            },
                            {
                                id: 'fm-3t-kaiba', kind: 'duel', icona: '🐉',
                                // Il Kaiba del torneo di Forbidden Memories.
                                avatar: { kaiba: 'images/characters/setoKaiba_forbiddenMemories.png' },
                                label: 'Finale · lo Scettro', x: 1000, y: 1240,
                                characterId: 'kaiba',
                                field: 'images/fields/mobile/stadioKaiba.jpg',
                                dialogo: [
                                    { chi: 'kaiba', testo: 'Finale. Questo stadio è mio, il torneo è mio, e fra un minuto lo sarà anche il tuo Puzzle.' },
                                    { chi: 'kaiba', testo: 'C\'è una carta nel mio mazzo che ho comprato a un prezzo che non ti dirò. Quando la vedrai capirai perché nessuno arriva in fondo qui dentro.' },
                                    { io: true, testo: 'Non sono venuto per il torneo, Kaiba. Sono venuto per quello scettro che tieni al fianco e di cui non sai niente.' },
                                    { chi: 'kaiba', testo: 'Un soprammobile trovato in uno scavo. Se lo vuoi, vieni a prendertelo.' }
                                ]
                            },
                            // La tappa che chiude il tabellone: vinto il
                            // torneo non si torna sulla mappa a freddo —
                            // qui si vede cos'era davvero tutto questo.
                            {
                                id: 'fm-3t-finale', kind: 'scene', icona: '🏆',
                                label: 'Sette su sette', x: 420, y: 1240,
                                io: true,
                                testo: [
                                    'Il presidente della Kaiba Corporation è a terra in mezzo al suo stadio, e non ha capito niente di quello che è appena successo.',
                                    'Non è per la coppa che sono salito su questo ring. La Chiave e la Bilancia di Shadi, l\'Anello di Bakura, l\'Occhio di Pegasus, la Collana di Isis, lo Scettro di Kaiba: sei Oggetti, e sei carte bianche che adesso non sono più bianche.',
                                    'Con il Puzzle che porto al collo fanno sette. Sette, come quelli che Heishin mi ha strappato.',
                                    'Le carte si illuminano tutte insieme. Il principe sta tornando a casa, e mi porta con sé fino alla soglia.',
                                    'Shadi aveva ragione: nessuno di loro era qui per il torneo. Nemmeno io.'
                                ]
                            }
                        ]
                    },
                    {
                        // Il ritorno nel passato: le sei carte del presente hanno
                        // riportato il principe in Egitto, ma lì gli Oggetti veri
                        // sono ancora nelle mani di Heishin, nei santuari. Simon,
                        // che sta svanendo, gli dice cosa fare (come nel gioco).
                        id: 'fm-3-ritorno', kind: 'scene', icona: '⏳',
                        label: 'Indietro', x: 2120, y: 1730,
                        chi: 'Simon Muran', chiId: 'simonMuran',
                        // Qui si torna il principe: il protagonista della tappa
                        // vince su quello del capitolo (Yugi Muto).
                        protagonista: { name: 'Atem', title: 'Il Faraone senza memoria', image: 'images/characters/atem.jpg', icon: '👑' },
                        testo: [
                            { testo: 'Sabbia, sole, e il profilo del palazzo all\'orizzonte. Il principe è tornato a casa, con il proprio corpo e il proprio volto.' },
                            { chi: 'simonMuran', testo: 'Principe… ce l\'hai fatta. Il ragazzo del futuro ti ha riportato qui. Io, purtroppo, non posso restare: il sigillo mi ha consumato.' },
                            { chi: 'simonMuran', testo: 'Heishin regna sull\'Egitto, e i suoi Sommi Maghi hanno nascosto gli Oggetti del Millennio nei santuari delle terre conquistate.' },
                            { chi: 'simonMuran', testo: 'Riprendili, uno per uno, e sigillali per sempre. Nessuno deve più poterli riunire per il male.' },
                            { io: true, testo: 'Lo farò, Simon. Te lo prometto.' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-maghi',
                nome: 'I Cinque Maghi Guerrieri',
                testo: 'Cinque terre, cinque Oggetti del Millennio, e due maghi a guardia di ognuna.',
                // Cinque terre, una per riga sulla mappa: ogni riga si apre
                // con la voce del Mago Supremo che la custodisce, poi il suo
                // guardiano, poi lui. Prima erano dieci duelli di fila senza
                // una parola in mezzo — la sola sequenza del gioco in cui non
                // si capiva più per cosa si stesse duellando, che è
                // esattamente ciò che questo file dice di non fare.
                tappe: [
                    // --- Il ritorno, come nel gioco ---
                    // Prima dei santuari il principe ritrova Sadin nella Valle
                    // dei Re, si scontra con la ronda di Heishin, ritrova Jono e
                    // Teana in una nuova arena, e fra le rovine del palazzo Seto
                    // gli indica la strada. Queste cinque tappe sono nate dopo:
                    // vedi 'fm-ritorno-in-egitto' in `separazioni`.
                    {
                        id: 'fm-4-valle', kind: 'scene', icona: '🏺',
                        label: 'La Valle dei Re', x: 2240, y: 640,
                        chi: 'Sadin', chiId: 'shadi',
                        testo: [
                            { nome: 'Sadin', icona: '🗝️', testo: 'Principe. Ti ho riconosciuto dal passo, prima ancora che dal volto. Custodisco queste tombe da quando sei sparito.' },
                            { io: true, testo: 'Sadin… quanto tempo è passato?' },
                            { nome: 'Sadin', icona: '🗝️', testo: 'Abbastanza perché Heishin si sia preso tutto l\'Egitto. Le sue ronde battono ogni strada, e cercano chiunque somigli a te.' },
                            { nome: 'Sadin', icona: '🗝️', testo: 'Va\' in città, ma tieni gli occhi aperti. E se ti chiedono chi sei, non dire il tuo nome.' }
                        ]
                    },
                    {
                        id: 'fm-4-mage-soldier', kind: 'duel', icona: '🪖',
                        label: 'Mage Soldier', x: 2050, y: 800,
                        characterId: 'mageSoldier',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg',
                        dialogo: [
                            { chi: 'mageSoldier', testo: 'Fermo lì, straniero. Per ordine del Sommo Heishin nessuno entra in città senza dire il proprio nome.' },
                            { chi: 'mageSoldier', testo: 'E quel volto… somigli al principe scomparso. Se sei lui, Heishin mi coprirà d\'oro.' },
                            { io: true, testo: 'Allora dovrai battermi per scoprirlo.' }
                        ]
                    },
                    {
                        id: 'fm-4-jono2', kind: 'duel', icona: '🗡️',
                        label: 'Jono, di nuovo', x: 2080, y: 960,
                        characterId: 'jono',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg',
                        dialogo: [
                            { chi: 'jono', testo: 'No… non può essere. Sei tu! Ti credevamo morto da anni! La vecchia arena l\'hanno chiusa i soldati: ci siamo spostati qui.' },
                            { chi: 'jono', testo: 'Vediamo se sei davvero tu: un duello, come ai vecchi tempi. Se giochi come allora, ti credo.' },
                            { io: true, testo: 'Come ai vecchi tempi, Jono.' }
                        ]
                    },
                    {
                        id: 'fm-4-teana2', kind: 'duel', icona: '🌾',
                        label: 'Teana, di nuovo', x: 1930, y: 1060,
                        characterId: 'teana',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg',
                        dialogo: [
                            { chi: 'teana', testo: 'Jono dice che sei tornato. Io non ci credo finché non lo vedo con i miei occhi… e con le mie carte.' },
                            { chi: 'teana', testo: 'Sono passati anni, e Heishin ci ha tolto tutto. Se vuoi sfidarlo, prima devi battere me.' },
                            { io: true, testo: 'Allora gioca sul serio, Teana. Come sempre.' }
                        ]
                    },
                    {
                        id: 'fm-4-seto-consiglio', kind: 'scene', icona: '🔺',
                        label: 'Le rovine del palazzo', x: 1965, y: 300,
                        chi: 'Sacerdote Seto', chiId: 'priestSeto',
                        testo: [
                            { testo: 'Il palazzo è una rovina. Fra i rotoli bruciati del tempio, una mappa: la strada per le Rovine Proibite, e sulle pareti disegnati i santuari dove sono custoditi gli Oggetti.' },
                            { chi: 'priestSeto', testo: 'Sei sopravvissuto, principe. Non avrei scommesso una moneta.' },
                            { io: true, testo: 'Seto. Eri con Heishin, quella notte.' },
                            { chi: 'priestSeto', testo: 'Ero con chi vinceva. Adesso Heishin si fida solo dei suoi Sommi Maghi, e io sono fuori dai suoi favori. Abbiamo lo stesso nemico.' },
                            { chi: 'priestSeto', testo: 'I cinque Sommi Maghi custodiscono gli Oggetti, uno per santuario. Battili, riprenditi gli Oggetti, e Heishin si indebolirà a ogni sconfitta.' },
                            { io: true, testo: 'Non mi fido di te. Ma i santuari li visiterò comunque.' }
                        ]
                    },
                    {
                        id: 'fm-4-scena-ocean', kind: 'scene', icona: '🌊',
                        label: 'Le secche', x: 2150, y: 1430,
                        chi: 'High Mage Secmeton', chiId: 'highMageSecmeton',
                        testo: [
                            'Heishin ha diviso i Sette Oggetti fra noi cinque. A me è toccato il mare, e con il mare non si discute.',
                            'Alla mia torre non arriva nessuno senza passare prima dalle secche: là ti aspetta Ocean Mage.',
                            'Se lo batti avrai guadagnato il diritto di annegare davanti a me.',
                            'Qui l\'acqua cambia strada due volte al giorno. I miei mostri sanno quando; tu no, e lo scoprirai al momento sbagliato.',
                            'Vieni avanti, Principe. La marea non aspetta che tu sia pronto.'
                        ]
                    },
                    {
                        id: 'fm-4-ocean', kind: 'duel', icona: '🐚',
                        // Le rovine sulla costa; il Sommo Mago aspetta nel
                        // tempio sommerso, più al largo.
                        label: 'Ocean Mage', x: 2230, y: 1285,
                        characterId: 'oceanMage',
                        field: 'images/fields/mobile/anticoEgittoGiorno_2.jpg'
,
                        dialogo: [
                            { chi: 'oceanMage', testo: 'Le secche sembrano basse. Lo sembrano sempre, finche\' l\'acqua non decide diversamente.' },
                            { io: true, testo: 'Passo comunque.' }
                        ]
                    },
                    {
                        id: 'fm-4-secmeton', kind: 'duel', icona: '🔱',
                        label: 'High Mage Secmeton', x: 2780, y: 1520,
                        characterId: 'highMageSecmeton',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg'
,
                        dialogo: [
                            { chi: 'highMageSecmeton', testo: 'Sei arrivato bagnato fino al collo e vuoi ancora il mio Oggetto.' },
                            { chi: 'highMageSecmeton', testo: 'Il mare non restituisce niente, principe. Io ho imparato da lui.' },
                            { io: true, testo: 'Il mare non ha mai avuto qualcosa di mio.' }
                        ]
                    },
                    {
                        id: 'fm-4-scena-mountain', kind: 'scene', icona: '⛰️',
                        label: 'Il sentiero', x: 1180, y: 1520,
                        chi: 'High Mage Atenza', chiId: 'highMageAtenza',
                        testo: [
                            'La pietra non tratta con nessuno. Sale chi ha il fiato e cade chi non ce l\'ha, e non c\'è altra regola quassù.',
                            'Heishin mi ha chiesto quale delle cinque terre volessi. Ho scelto questa perché è l\'unica che si difende da sola.',
                            'Mountain Mage sorveglia il sentiero. Io sorveglio quello che c\'è in cima — e non è roba per te.',
                            'I draghi che dormono in queste rocce sono qui da prima del tuo regno. Non sanno chi sei e non gliene importa.',
                            'Sali, se vuoi. Ogni passo è più stretto del precedente.'
                        ]
                    },
                    {
                        id: 'fm-4-mountain', kind: 'duel', icona: '🪨',
                        label: 'Mountain Mage', x: 870, y: 1620,
                        characterId: 'mountainMage',
                        field: 'images/fields/mobile/rovine_2.jpg'
,
                        dialogo: [
                            { chi: 'mountainMage', testo: 'Da qui in su l\'aria si fa corta. Chi non e\' abituato duella con meta\' fiato.' },
                            { io: true, testo: 'Allora sbrighiamoci.' }
                        ]
                    },
                    {
                        id: 'fm-4-atenza', kind: 'duel', icona: '🐲',
                        label: 'High Mage Atenza', x: 500, y: 1400,
                        characterId: 'highMageAtenza',
                        field: 'images/fields/mobile/rovine_2.jpg'
,
                        dialogo: [
                            { chi: 'highMageAtenza', testo: 'Sei salito. Bene: quasi nessuno arriva a vedermi in faccia.' },
                            { chi: 'highMageAtenza', testo: 'La pietra non tratta, te l\'avevo detto. Adesso te lo dimostro.' },
                            { io: true, testo: 'Anche la pietra si spacca.' }
                        ]
                    },
                    {
                        id: 'fm-4-scena-forest', kind: 'scene', icona: '🌲',
                        label: 'Gli alberi', x: 430, y: 640,
                        chi: 'High Mage Anubisius', chiId: 'highMageAnubisius',
                        testo: [
                            'Sotto questi alberi non si seppellisce nessuno, Principe: la foresta preferisce tenere i suoi morti in piedi.',
                            'Prima di servire Heishin ho passato trent\'anni a custodire tombe. Ho imparato che una tomba ben fatta non tiene dentro nessuno — tiene fuori i vivi.',
                            'Forest Mage li conta ogni sera. Da stasera ne avrà uno in più da contare.',
                            'Cammina pure sul sentiero. È l\'unico punto in cui le radici ti lasciano passare, e non è una gentilezza: è che di là si torna indietro peggio.'
                        ]
                    },
                    {
                        id: 'fm-4-forest', kind: 'duel', icona: '🍃',
                        label: 'Forest Mage', x: 700, y: 390,
                        characterId: 'forestMage',
                        field: 'images/fields/mobile/anticoEgittoGiorno_2.jpg'
,
                        dialogo: [
                            { chi: 'forestMage', testo: 'Gli alberi ti hanno lasciato passare. Non fanno sempre cosi\'.' },
                            { chi: 'forestMage', testo: 'Vuol dire che vogliono vedere come va a finire.' },
                            { io: true, testo: 'Anch\'io.' }
                        ]
                    },
                    {
                        id: 'fm-4-anubisius', kind: 'duel', icona: '🐺',
                        label: 'High Mage Anubisius', x: 320, y: 270,
                        characterId: 'highMageAnubisius',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg'
,
                        dialogo: [
                            { chi: 'highMageAnubisius', testo: 'Il mio guardiano li contava ogni sera, i morti di questa foresta. Adesso tocca a me, e conto anche lui.' },
                            { chi: 'highMageAnubisius', testo: 'Ti disturba? Qui nessuno se ne va davvero. Restano solo in piedi.' },
                            { io: true, testo: 'Allora falli sdraiare.' }
                        ]
                    },
                    {
                        id: 'fm-4-scena-desert', kind: 'scene', icona: '🏜️',
                        label: 'La sabbia', x: 2120, y: 300,
                        chi: 'High Mage Martis', chiId: 'highMageMartis',
                        testo: [
                            'Il deserto è l\'unica delle cinque terre che non avrebbe bisogno di guardie.',
                            'Desert Mage sta là fuori soltanto perché qualcuno raccolga quello che resta.',
                            'Cammina pure, Principe. Il sole lavora per me.',
                            'Le mie macchine non hanno bisogno d\'acqua, e i miei rapaci vedono da un\'ora di marcia. Tu hai una borraccia e due gambe.',
                            'Non ho fretta. Il deserto non l\'ha mai avuta.'
                        ]
                    },
                    {
                        id: 'fm-4-desert', kind: 'duel', icona: '🦂',
                        label: 'Desert Mage', x: 2380, y: 180,
                        characterId: 'desertMage',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg'
,
                        dialogo: [
                            { chi: 'desertMage', testo: 'Il mio Sommo dice che sto qui per raccogliere quello che resta di chi attraversa.' },
                            { chi: 'desertMage', testo: 'Di solito ha ragione. Di solito.' },
                            { io: true, testo: 'Oggi no.' }
                        ]
                    },
                    {
                        id: 'fm-4-martis', kind: 'duel', icona: '🦅',
                        label: 'High Mage Martis', x: 2600, y: 560,
                        characterId: 'highMageMartis',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg'
,
                        dialogo: [
                            { chi: 'highMageMartis', testo: 'Sei arrivato con il sole ancora alto. Non era previsto.' },
                            { chi: 'highMageMartis', testo: 'L\'Oggetto che cerchi e\' sotto la sabbia da cinquemila anni. Se lo vuoi, mettiti in fila con il deserto.' },
                            { io: true, testo: 'Il deserto puo\' aspettare. Io no.' }
                        ]
                    },
                    {
                        id: 'fm-4-scena-meadow', kind: 'scene', icona: '🌻',
                        label: 'L\'ultimo prato', x: 1150, y: 800,
                        chi: 'High Mage Kepura', chiId: 'highMageKepura',
                        testo: [
                            'Ti aspettavo prima. Gli altri quattro avevano un solo compito, e nessuno l\'ha portato a termine.',
                            'Questa è l\'ultima terra e questo è l\'ultimo Oggetto: dopo di me non resta che il palazzo.',
                            'Meadow Mage, apri il prato. Vediamo quanto gli è rimasto.',
                            'Secmeton, Atenza, Anubisius, Martis: ognuno aveva la sua terra e la sua scusa pronta. Io non ne avrò bisogno.',
                            'Qui non c\'è niente che ti ostacoli, Principe — né acqua, né pietra, né sabbia. Solo io, e questo dovrebbe preoccuparti più di tutto il resto.'
                        ]
                    },
                    {
                        id: 'fm-4-meadow', kind: 'duel', icona: '🌾',
                        label: 'Meadow Mage', x: 890, y: 900,
                        characterId: 'meadowMage',
                        field: 'images/fields/mobile/anticoEgittoGiorno_2.jpg'
,
                        dialogo: [
                            { chi: 'meadowMage', testo: 'Kepura ha detto di aprirti il prato. Non ha detto di lasciarti attraversare.' },
                            { io: true, testo: 'E\' la stessa cosa, alla fine.' }
                        ]
                    },
                    {
                        id: 'fm-4-kepura', kind: 'duel', icona: '🦌',
                        label: 'High Mage Kepura', x: 620, y: 820,
                        characterId: 'highMageKepura',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
,
                        dialogo: [
                            { chi: 'highMageKepura', testo: 'Quattro terre, quattro Oggetti, e adesso sei qui. Non avrei scommesso una moneta su di te.' },
                            { chi: 'highMageKepura', testo: 'L\'ultimo lo tengo io. Dopo di me c\'e\' il palazzo, e nel palazzo c\'e\' una cosa che nemmeno Heishin guarda in faccia.' },
                            { io: true, testo: 'Un Oggetto alla volta.' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-labirinto',
                nome: 'Il Dungeon del Labirinto',
                testo: 'Sotto il palazzo, dove Heishin ha scavato e ha messo a guardia ciò che non è più del tutto umano.',
                tappe: [
                    {
                        id: 'fm-5-settimo-oggetto', kind: 'scene', icona: '🔱',
                        label: 'La via per Heishin', x: 1610, y: 1060,
                        chi: 'Sacerdote Seto', chiId: 'priestSeto',
                        // Nel gioco, a questo punto, gli uomini di Seto rapiscono
                        // Teana per attirare il principe: lui e Jono la liberano
                        // al santuario di Heishin, e Seto la rilascia prima di
                        // portarlo da Heishin.
                        testo: [
                            { chi: 'jono', testo: 'Principe! Hanno preso Teana! Uomini con le vesti dei sacerdoti, l\'hanno portata verso il santuario di Heishin.' },
                            { testo: 'Il principe e Jono corrono fino al santuario. Teana è lì, legata a una colonna, e davanti a lei aspetta Seto.' },
                            { chi: 'priestSeto', testo: 'Calmatevi. Non volevo farle del male: volevo solo essere sicuro che saresti venuto, principe. Lasciatela andare.' },
                            { chi: 'teana', testo: 'Stai bene? Io sì… ma non fidarti di lui. Nemmeno per un momento.' },
                            { chi: 'priestSeto', testo: 'Hai battuto i cinque Sommi Maghi e ripreso i loro Oggetti. Il settimo, la Barra, Heishin lo tiene con sé. Sotto il palazzo c\'è un ingresso nascosto che porta da lui.' },
                            { chi: 'priestSeto', testo: 'Sebek e Neku sorvegliano l\'ultimo corridoio. Non chiederti perché ti aiuto: per il momento, liberare il regno e riunire gli Oggetti sono la stessa strada.' }
                        ]
                    },
                    {
                        id: 'fm-5-scena', kind: 'scene', icona: '🕯️',
                        label: 'Sotto il palazzo', x: 1430, y: 1160,
                        io: true,
                        testo: [
                            'Sei Oggetti recuperati. Il settimo è sotto il palazzo, e sotto il palazzo Heishin ha scavato.',
                            'Questo posto non c\'era, quando ci vivevo. Nessun architetto di mio padre avrebbe disegnato corridoi che si piegano così.',
                            'Non li ha scavati per nascondere un Oggetto: un Oggetto si nasconde in una stanza. Questo è un labirinto, e un labirinto serve a tenere dentro qualcosa.',
                            'Quello che ha messo a guardia non è più del tutto umano.',
                            'E più scendo, più l\'aria sa di una cosa che non ho mai sentito in vita mia.'
                        ]
                    },
                    {
                        id: 'fm-5-labirinto', kind: 'duel', icona: '🧱',
                        label: 'Labyrinth Mage', x: 1650, y: 1290,
                        characterId: 'labyrinthMage',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg'
,
                        dialogo: [
                            { chi: 'labyrinthMage', testo: 'Sotto il palazzo non ci sono corridoi: ci sono scelte. Heishin ne ha fatte scavare a centinaia.' },
                            { chi: 'labyrinthMage', testo: 'Tu ne hai appena fatta una sbagliata.' },
                            { io: true, testo: 'Le ho contate tutte. Questa la volevo.' }
                        ]
                    },
                    // Seto nel labirinto (nel gioco viene subito dopo
                    // Labyrinth Mage): vuole vedere con i suoi occhi se il
                    // principe è abbastanza forte da arrivare fino a Heishin.
                    // Nato dopo: vedi 'fm-seto-labirinto' in `separazioni`.
                    {
                        id: 'fm-5-seto2', kind: 'duel', icona: '🔺',
                        label: 'Seto nel labirinto', x: 1770, y: 1240,
                        characterId: 'priestSeto',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg',
                        dialogo: [
                            { chi: 'priestSeto', testo: 'Il labirinto è finito, principe. Prima di portarti da Heishin voglio vedere con i miei occhi quanto vali.' },
                            { chi: 'priestSeto', testo: 'Alla festa ti ho lasciato vincere. Oggi no.' },
                            { io: true, testo: 'Alla festa non mi hai lasciato vincere, Seto. E oggi lo vedrai.' }
                        ]
                    },
                    {
                        id: 'fm-5-sebek', kind: 'duel', icona: '🐊',
                        label: 'Sebek', x: 1890, y: 1190,
                        characterId: 'sebek',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
,
                        dialogo: [
                            { chi: 'sebek', testo: 'Il fiume sotterraneo passa di qui. Con lui e\' arrivato anche quello che ci viveva dentro.' },
                            { chi: 'sebek', testo: 'Heishin non mi ha messo a guardia di niente. Mi ha solo lasciato la porta aperta.' },
                            { io: true, testo: 'Allora la chiudo io.' }
                        ]
                    },
                    {
                        id: 'fm-5-neku', kind: 'duel', icona: '🛡️',
                        label: 'Neku', x: 2060, y: 1330,
                        characterId: 'neku',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
,
                        dialogo: [
                            { chi: 'neku', testo: 'L\'ultimo Oggetto e\' dietro di me, e io sono l\'ultima cosa che Heishin ha messo fra te e lui.' },
                            { chi: 'neku', testo: 'Non aspettarti parole altisonanti: non ne ho piu\' da un pezzo.' },
                            { io: true, testo: 'Nemmeno io.' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-palazzo',
                nome: 'Il Palazzo di Heishin',
                testo: 'Sette Oggetti su sette. Resta solo chi te li ha portati via.',
                tappe: [
                    {
                        id: 'fm-6-scena', kind: 'scene', icona: '👁️',
                        label: 'Sette su sette', x: 2380, y: 900,
                        chi: 'Heishin', chiId: 'heishin',
                        // Nel gioco Heishin vuole gli Oggetti PER SÉ: con tutti e
                        // sette può evocare il dio oscuro degli antichi stregoni e
                        // comandarlo. (Qui diceva di raccoglierli "per qualcun
                        // altro", che è l'opposto.)
                        testo: [
                            'Hai ripreso i miei Oggetti uno a uno. Ammirevole. Davvero.',
                            'Cinque Sommi Maghi, cinque terre, e tu che arrivi fin qui con sei Oggetti addosso. L\'ultimo, la Barra, è in mano mia.',
                            'Sai perché li volevo tutti? Il trono è niente. Nelle Rovine Proibite c\'è scritto come evocare il dio oscuro degli antichi stregoni: chi lo chiama con i sette Oggetti, lo comanda.',
                            'E adesso me li hai portati tu, fin dentro casa mia.',
                            'Grazie, Principe. Hai fatto l\'ultimo pezzo di lavoro al posto mio.'
                        ]
                    },
                    {
                        id: 'fm-6-heishin', kind: 'duel', icona: '🏛️',
                        label: 'Heishin', x: 2620, y: 730,
                        characterId: 'heishin',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
,
                        dialogo: [
                            { chi: 'heishin', testo: 'Sette Oggetti, di nuovo tutti in una stanza. Questa volta pero\' li ho portati io, e nel posto giusto.' },
                            { chi: 'heishin', testo: 'Credevi di venire a riprenderteli. Sei venuto a consegnarmi l\'ultimo pezzo.' },
                            { io: true, testo: 'Allora prendilo.' }
                        ]
                    },
                    {
                        id: 'fm-6-seto', kind: 'duel', icona: '🔺',
                        label: 'Sacerdote Seto', x: 2840, y: 570,
                        characterId: 'priestSeto',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
,
                        // Il tradimento vero di Seto, come nel gioco: discende dagli
                        // antichi stregoni oscuri e ha usato il principe per
                        // riunire gli Oggetti ed evocare DarkNite.
                        dialogo: [
                            { chi: 'priestSeto', testo: 'Heishin è a terra, e i sette Oggetti sono tutti in questa stanza. Esattamente dove volevo che fossero.' },
                            { chi: 'priestSeto', testo: 'Ti ho usato, principe. I santuari, il labirinto, Teana: ogni passo ti ha portato a raccoglierli per me. Il mio sangue è quello degli antichi stregoni: sono io quello che deve chiamare DarkNite.' },
                            { io: true, testo: 'Me l\'aveva detto Teana di non fidarmi di te. Gli Oggetti non li avrai, Seto.' }
                        ]
                    },
                    {
                        // Battuto Seto, Heishin ricompare: la sua sconfitta era
                        // recitata, per vedere chi avrebbe allungato la mano sugli
                        // Oggetti. Li afferra ed evoca DarkNite (come nel gioco).
                        id: 'fm-6-tradimento', kind: 'scene', icona: '😈',
                        label: 'L\'inganno di Heishin', x: 3010, y: 410,
                        chi: 'Heishin', chiId: 'heishin',
                        testo: [
                            { chi: 'heishin', testo: 'Bravi, bravi tutti e due. Credevate davvero che mi fossi arreso? Ho perso apposta, per vedere chi dei due avrebbe allungato le mani sugli Oggetti.' },
                            { chi: 'priestSeto', testo: 'Heishin… fermo!' },
                            { chi: 'heishin', testo: 'Troppo tardi, sacerdote. Gli Oggetti sono miei, e la statua è pronta.' },
                            { testo: 'Heishin depone i sette Oggetti del Millennio sulla statua del dio oscuro. La sala si riempie di un vento nero, e qualcosa apre gli occhi.' },
                            { chi: 'heishin', testo: 'Sorgi, DarkNite! Per l\'antico patto degli stregoni, io ti comando!' }
                        ]
                    }
                ]
            },
            {
                id: 'fm-nitemare',
                nome: 'L\'Ultimo Duello',
                testo: 'Heishin non era il padrone: era la porta.',
                tappe: [
                    {
                        id: 'fm-7-porta', kind: 'scene', icona: '🚪',
                        label: 'Il patto rifiutato', x: 2900, y: 310,
                        chi: 'DarkNite', chiId: 'darkNite',
                        testo: [
                            'Heishin ha deposto i sette Oggetti sulla statua e mi ha chiamato, convinto che questo bastasse a comandarmi.',
                            'Ma non porta con sé la prova del patto. Non possiede più gli Oggetti: li ha consumati per aprire la porta.',
                            'Un uomo senza autorità non dà ordini a DarkNite. La sua ricompensa sarà diventare una carta e bruciare insieme alla propria ambizione.',
                            'Tu invece porti le carte che nel futuro hanno raccolto gli Oggetti. Mostramele, Principe, e difendi in duello il diritto di restare vivo.'
                        ]
                    },
                    {
                        id: 'fm-7-darknite', kind: 'duel', icona: '😈',
                        label: 'DarkNite', x: 3060, y: 210,
                        characterId: 'darkNite',
                        field: 'images/fields/mobile/anticoEgittoNotte_1.jpg'
,
                        dialogo: [
                            { chi: 'darkNite', testo: 'Cinquemila anni ad aspettare una porta, e me l\'ha aperta un uomo che voleva un trono.' },
                            { chi: 'darkNite', testo: 'Lui l\'ho gia\' dimenticato. Tu invece sei arrivato fin qui da solo: e\' molto piu\' interessante.' },
                            { io: true, testo: 'Non sono arrivato da solo. Ci sono voluti cinquemila anni e un ragazzo con un puzzle.' }
                        ]
                    },
                    {
                        id: 'fm-7-nitemare', kind: 'scene', icona: '🌑',
                        label: 'La vera forma', x: 2810, y: 120,
                        chi: 'DarkNite',
                        testo: [
                            'Quella era la forma che uso con chi non merita di vedere l\'altra.',
                            'In cinquemila anni l\'ho cambiata tre volte. Due per noia. Questa no.',
                            'Guarda bene, Principe. Non ci sarà una terza forma.',
                            'E quando avremo finito, di questa notte non resterà un testimone: né il tuo regno, né il tuo nome, né la parte di te che è arrivata fin qui dall\'altra epoca.'
                        ]
                    },
                    {
                        id: 'fm-7-finale-duello', kind: 'duel', icona: '👑',
                        label: 'Nitemare', x: 2560, y: 200,
                        characterId: 'nitemare',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
,
                        dialogo: [
                            { chi: 'nitemare', testo: 'Nessuno mi aveva mai costretto a mostrare questa forma. Nessuno.' },
                            { chi: 'nitemare', testo: 'Quando avro\' finito con te non resterai nemmeno nei racconti, principe. Sara\' come se il tuo nome non fosse mai esistito.' },
                            { io: true, testo: 'Il mio regno ha aspettato cinquemila anni che tornassi. Non lo lascerò a te.' }
                        ]
                    },
                    {
                        // Il finale del gioco: Nitemare torna da dove è venuto,
                        // Seto sparisce per sempre, e il principe sale al trono,
                        // seppellisce le Rovine Proibite e riunisce l'Egitto. Il
                        // nodo sta nel palazzo, dove la storia era cominciata.
                        id: 'fm-7-finale', kind: 'scene', icona: '🌅',
                        label: 'Il nuovo Faraone', x: 1760, y: 250,
                        io: true,
                        testo: [
                            { testo: 'Nitemare si dissolve, ricacciato da dove era venuto. Quando la polvere si posa, di Seto non c\'è più traccia: nessuno lo rivedrà mai più.' },
                            { io: true, testo: 'Gli Oggetti del Millennio sono sette, e sono di nuovo miei. Li sigillerò dove nessuno potrà più riunirli per il male, come mi ha chiesto Simon.' },
                            { io: true, testo: 'Le Rovine Proibite le faremo seppellire sotto la sabbia, con tutto quello che c\'è scritto dentro.' },
                            { chi: 'jono', testo: 'E adesso? Torni a scavalcare il muro del giardino per duellare con noi?' },
                            { chi: 'teana', testo: 'Adesso è il Faraone, Jono. Dovrai chiamarlo così.' },
                            { io: true, testo: 'Fuori dal palazzo, chiamatemi come allora. Al ragazzo del futuro che mi ha riportato qui devo un regno: farò in modo che ne valga la pena.' },
                            { testo: 'L\'Egitto torna unito sotto il nuovo Faraone, e per lunghi anni conosce la pace.' }
                        ]
                    }
                ]
            }
        ],
        separazioni: [
            { id: 'fm-presagio-caduta', dalla: 'tappe', nuove: ['fm-2-presagio'], prima: 'fm-2-scena' },
            { id: 'fm-peso-settimo', dalla: 'tappe', nuove: ['fm-5-settimo-oggetto'], prima: 'fm-5-scena' },
            { id: 'fm-porta-darknite', dalla: 'tappe', nuove: ['fm-7-porta'], prima: 'fm-7-darknite' },
            // Revisione di fedeltà al gioco PS1 (2026-10-11): il ritorno in
            // Egitto (Sadin, Mage Soldier, le rivincite di Jono e Teana, Seto
            // fra le rovine), Seto nel labirinto, e Shadi che porta Yugi
            // dentro il Puzzle a metà torneo.
            { id: 'fm-ritorno-in-egitto', dalla: 'tappe', nuove: ['fm-4-valle', 'fm-4-mage-soldier', 'fm-4-jono2', 'fm-4-teana2', 'fm-4-seto-consiglio'], prima: 'fm-4-scena-ocean' },
            { id: 'fm-seto-labirinto', dalla: 'tappe', nuove: ['fm-5-seto2'], prima: 'fm-5-sebek' },
            { id: 'fm-dentro-il-puzzle', dalla: 'principali-inserite', area: 'fm-3-torneo', ids: ['fm-3t-dentro-il-puzzle'] }
        ],
        premioFinale: { credits: 3000, starChips: 5, locatorCards: 5, millenniumCards: 4 }
    },

    {
        id: 'freedom',
        nome: 'Freedom: La Corona del Millennio',
        sottotitolo: 'Roberto Giacobbo, oltre il confine',
        icona: '🎥',
        // La valle del Nilo al tramonto: si parte dalle rovine in primo
        // piano, dove la troupe monta le telecamere, si scende nelle tombe
        // scavate nella rupe e lungo il fiume, si risale al tempio centrale
        // e al palazzo, e si finisce fra la Sfinge e le piramidi. I nodi
        // stanno su quei luoghi, nell'ordine della puntata.
        // La prima versione (`storia_freedom_1.jpg`, 2700x1800) non è più
        // fra i candidati: altro rapporto, e i nodi di adesso ci
        // cadrebbero sopra a caso.
        sfondo: ['images/maps/storia_freedom_2.jpg', 'images/fields/mobile/anticoEgittoGiorno_1.jpg'],
        // Prima i duelli di Freedom non dichiaravano nessuna musica e
        // suonavano il brano di ripiego del duello (la finale di Kaiba),
        // fuori luogo per una puntata in Egitto: ora il tema egizio.
        musicaDuello: '33. Egyptian Duel.mp3',
        // Il conduttore in persona: la campagna è la sua puntata, e da metà
        // in poi anche il suo problema.
        protagonista: { name: 'Roberto Giacobbo', title: 'Il conduttore', image: 'images/characters/rg.jpg', icon: '🎥' },
        descrizione: 'Una troupe televisiva scende in Egitto per girare una puntata come tante. Sotto la sabbia trova qualcosa che nessun archeologo aveva messo in conto, e il conduttore non torna a casa come ne era partito.',
        // Qui le fanmade ci stanno: e' la campagna goliardica, e
        // Giacobbo non e' materia da regolamento ufficiale.
        carteAmmesse: { origini: ['yu-gi-oh', 'fanmade'] },
        // Le misure del disegno (1672x941): le coordinate sono i suoi pixel.
        larghezza: 1672,
        altezza: 941,
        capitoli: [
            {
                id: 'freedom-riprese',
                nome: 'Si gira',
                testo: 'Egitto, permessi in regola, telecamere accese. Per ora è una puntata come le altre.',
                tappe: [
                    {
                        id: 'freedom-1-scena', kind: 'scene', icona: '🎬',
                        label: 'Prima puntata', x: 300, y: 598,
                        chi: 'Roberto Giacobbo', chiId: 'robertoGiacobbo',
                        testo: [
                            'Amici, benvenuti. Oggi siamo in Egitto, e la domanda che ci poniamo è semplice: e se quello che abbiamo letto sui libri fosse solo metà della storia?',
                            'Dietro di me c\'è un sito che nelle guide non compare. Ci hanno concesso tre giorni di riprese, e ci hanno chiesto di non filmare il settore est. Naturalmente ci andremo.',
                            'La troupe è pronta, le telecamere girano. Voi seguiteci: non si sa mai dove si finisce.',
                            'E se qualcuno, a casa, sta pensando "ma questo se le inventa"... be\', anche noi. Fino a stamattina.'
                        ]
                    },
                    {
                        id: 'freedom-1-ishizu', kind: 'duel', icona: '📿',
                        label: 'Ishizu Ishtar', x: 488, y: 640,
                        characterId: 'ishizu',
                        field: 'images/fields/mobile/anticoEgittoGiorno_1.jpg'
                    },
                    {
                        id: 'freedom-1-odion', kind: 'duel', icona: '🔥',
                        label: 'Odion', x: 742, y: 772,
                        characterId: 'odion',
                        field: 'images/fields/mobile/anticoEgittoGiorno_2.jpg'
                    },
                    {
                        id: 'freedom-1-shadi', kind: 'duel', icona: '🗝️',
                        label: 'Shadi', x: 1185, y: 655,
                        characterId: 'shadi',
                        field: 'images/fields/mobile/anticoEgittoNotte_1.jpg'
                    }
                ]
            },
            {
                id: 'freedom-sottosabbia',
                nome: 'Sotto la sabbia',
                testo: 'Un corridoio che nessuna mappa riporta, e una troupe che per la prima volta non sa come va a finire.',
                tappe: [
                    {
                        id: 'freedom-2-girato', kind: 'scene', icona: '📼',
                        label: 'Riguardando il girato', x: 1710, y: 720,
                        chi: 'La regista',
                        testo: [
                            "Abbiamo riguardato le immagini dei tre duelli. In campo c'era Roberto, ma nei riflessi delle custodie metalliche compariva sempre una figura più alta, con una corona.",
                            "L'audio ha registrato una seconda voce mezzo secondo prima di ogni sua frase. Diceva le stesse parole, come se gliele suggerisse.",
                            "Ho proposto di fermare le riprese. Roberto ha sorriso e ha indicato la crepa nella parete: ieri, nelle fotografie, non c'era.",
                            'La produzione vuole una puntata. Io vorrei soltanto che tutti quelli entrati qui tornassero fuori con la stessa ombra.'
                        ]
                    },
                    {
                        id: 'freedom-2-scena', kind: 'scene', icona: '🕯️',
                        label: 'Il corridoio', x: 1545, y: 610,
                        chi: 'Roberto Giacobbo', chiId: 'robertoGiacobbo',
                        testo: [
                            'Il nostro operatore ha inquadrato una crepa nella parete. Dietro la crepa, un corridoio che nessuna mappa riporta.',
                            'L\'aria che esce di là è più fredda di quella qui fuori. Di diciassette gradi, dice il termometro della troupe. Diciassette.',
                            'E poi c\'è il dettaglio che mi ha convinto: il corridoio è INTONACATO. Nessuno intonaca una cosa che non intende usare.',
                            'Vi confesso una cosa: a questo punto della puntata di solito sappiamo già come va a finire. Oggi no.'
                        ]
                    },
                    {
                        id: 'freedom-2-labirinto', kind: 'duel', icona: '🧱',
                        label: 'Labyrinth Mage', x: 1455, y: 445,
                        characterId: 'labyrinthMage',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg'
                    },
                    {
                        id: 'freedom-2-anubisius', kind: 'duel', icona: '🐺',
                        label: 'High Mage Anubisius', x: 1238, y: 470,
                        characterId: 'highMageAnubisius',
                        field: 'images/fields/mobile/anticoEgittoNotte_2.jpg'
                    },
                    {
                        id: 'freedom-2-sebek', kind: 'duel', icona: '🐊',
                        label: 'Sebek', x: 1045, y: 575,
                        characterId: 'sebek',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
                    }
                ]
            },
            {
                id: 'freedom-camera',
                nome: 'La camera sigillata',
                testo: 'In fondo al corridoio c\'è un oggetto che gli egittologi consultati dicono non possa esistere.',
                tappe: [
                    {
                        id: 'freedom-3-radio', kind: 'scene', icona: '📻',
                        label: 'Silenzio radio', x: 1110, y: 560,
                        chi: 'Il fonico',
                        testo: [
                            "Il segnale con l'esterno è sparito da ventitré minuti, ma nelle cuffie continuo a sentire una trasmissione.",
                            'È la voce di Roberto. Descrive una camera che non abbiamo ancora raggiunto e conta sette nicchie sulle pareti.',
                            'Ogni volta che provo a registrarla il file risulta vuoto. Ogni volta che tolgo le cuffie la voce esce dagli altoparlanti spenti.',
                            "Davanti a noi c'è una porta senza maniglia. La voce ha appena detto che Roberto sa come aprirla."
                        ]
                    },
                    {
                        id: 'freedom-3-scena', kind: 'scene', icona: '👑',
                        label: 'La Corona', x: 900, y: 440,
                        chi: 'Roberto Giacobbo', chiId: 'robertoGiacobbo',
                        testo: [
                            'Al centro della camera c\'è un oggetto che non compare in nessun catalogo: una corona.',
                            'Non è appoggiata: è sospesa. A tre centimetri dal piano, e sotto non c\'è niente. L\'abbiamo filmata da quattro angolazioni diverse per essere sicuri di non sbagliarci.',
                            'Gli egittologi che abbiamo consultato sono categorici: non può esistere.',
                            'E allora, amici, cos\'è che stiamo guardando?',
                            'Perché una cosa alla volta possiamo accettarla. Ma o si sbagliano loro, o si sbaglia la telecamera, o si sbaglia qualcos\'altro che abbiamo dato per buono fin qui.'
                        ]
                    },
                    {
                        id: 'freedom-3-isis', kind: 'duel', icona: '🔮',
                        label: 'Sacerdotessa Isis', x: 600, y: 440,
                        characterId: 'priestessIsis',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
                    },
                    {
                        id: 'freedom-3-seto', kind: 'duel', icona: '🔺',
                        label: 'Sacerdote Seto', x: 392, y: 330,
                        characterId: 'priestSeto',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
                    },
                    {
                        id: 'freedom-3-heishin', kind: 'duel', icona: '🏛️',
                        label: 'Heishin', x: 178, y: 212,
                        characterId: 'heishin',
                        field: 'images/fields/mobile/anticoEgittoNotte_1.jpg'
                    }
                ]
            },
            {
                id: 'freedom-corona',
                nome: 'La Corona del Millennio',
                testo: 'Quaranta minuti di girato che non sono mai andati in onda.',
                tappe: [
                    {
                        id: 'freedom-4-riflesso', kind: 'scene', icona: '🪞',
                        label: 'Il riflesso rimasto indietro', x: 245, y: 230,
                        chi: 'La troupe',
                        testo: [
                            'Roberto cammina davanti a noi, ma la sua ombra è rimasta nella camera sigillata. La vediamo ancora sul monitor della telecamera lasciata lì.',
                            'Nel corridoio non parla più. Ogni tanto muove le labbra e le luci si abbassano, come se il generatore dovesse ascoltarlo.',
                            "La Corona non è più sul piedistallo. Nessuno l'ha vista spostarsi e nessuno vuole chiedergli dove sia finita.",
                            "Poi Roberto si ferma davanti all'uscita e dice che non possiamo ancora tornare: qualcuno ci sta aspettando dall'altra parte."
                        ]
                    },
                    {
                        id: 'freedom-4-scena', kind: 'scene', icona: '⚡',
                        label: 'Fuori dal confine', x: 402, y: 122,
                        chi: 'La troupe',
                        testo: [
                            'Roberto, quella cosa non si tocca. Roberto. ROBERTO.',
                            'Il fonico giura di avergli visto allungare la mano e di non aver sentito nessun rumore, nemmeno il proprio.',
                            'Le telecamere hanno continuato a registrare per altri quaranta minuti. Quello che hanno ripreso non è mai andato in onda.',
                            'Sul nastro lui c\'è ancora, e parla. Ma non parla a noi, e non parla in italiano.',
                            'Abbiamo riportato le attrezzature al campo base. Della camera, il giorno dopo, non c\'era più nemmeno la crepa.'
                        ]
                    },
                    {
                        id: 'freedom-4-darknite', kind: 'duel', icona: '😈',
                        label: 'DarkNite', x: 665, y: 168,
                        characterId: 'darkNite',
                        field: 'images/fields/mobile/anticoEgittoNotte_3.jpg'
                    },
                    {
                        id: 'freedom-4-incoronazione', kind: 'scene', icona: '👑',
                        label: 'L’incoronazione', x: 830, y: 135,
                        chi: 'Roberto Giacobbo I', chiId: 'robertoGiacobbo',
                        testo: [
                            'DarkNite è caduto, ma la sua ombra non è scomparsa. È salita lungo le pareti e si è raccolta sopra la mia testa.',
                            'Adesso capisco la Corona: non cercava un faraone, cercava qualcuno disposto a fare domande anche quando la risposta divora chi la pronuncia.',
                            'Voi vedete ancora Roberto Giacobbo. Io vedo tutti i corridoi insieme, quelli scavati e quelli che esisteranno soltanto fra mille anni.',
                            'Per uscire dovrete affrontarmi. Non per liberarmi: per dimostrare che siete ancora capaci di distinguermi da ciò che ho trovato.'
                        ]
                    },
                    {
                        id: 'freedom-4-giacobbo', kind: 'duel', icona: '🎥',
                        label: 'Roberto Giacobbo I', x: 990, y: 105,
                        characterId: 'robertoGiacobbo',
                        field: 'images/fields/mobile/anticoEgittoRovinePalazzo.jpg'
                    },
                    {
                        id: 'freedom-4-finale', kind: 'scene', icona: '☀️',
                        label: 'Titoli di coda', x: 1548, y: 112,
                        chi: 'Roberto Giacobbo I', chiId: 'robertoGiacobbo',
                        testo: [
                            'Amici, la puntata finisce qui. Io, temo, no.',
                            'La Corona ha scelto, e certe domande è meglio farsele da questa parte del confine.',
                            'Ho passato trent\'anni a chiedermi cosa ci fosse dall\'altra parte delle pareti. Nessuno mi aveva avvertito che le pareti hanno un\'opinione in merito.',
                            'Alla troupe dico solo questo: montate la puntata, mandatela in onda, e tagliate gli ultimi quaranta minuti. Non per censura — perché non li capirebbe nessuno.',
                            'Alla prossima. Anche se "prossima", ormai, per me vuol dire un\'altra cosa.'
                        ]
                    }
                ]
            }
        ],
        separazioni: [
            { id: 'freedom-girato-anomalo', dalla: 'tappe', nuove: ['freedom-2-girato'], prima: 'freedom-2-scena' },
            { id: 'freedom-silenzio-radio', dalla: 'tappe', nuove: ['freedom-3-radio'], prima: 'freedom-3-scena' },
            { id: 'freedom-riflesso', dalla: 'tappe', nuove: ['freedom-4-riflesso'], prima: 'freedom-4-scena' },
            { id: 'freedom-incoronazione', dalla: 'tappe', nuove: ['freedom-4-incoronazione'], prima: 'freedom-4-giacobbo' }
        ],
        // Premio ridotto su richiesta dell'utente: 1 Stella e 700 Crediti (prima 2500 / 4 / 4 Carte Locazione / 2 Carte
        // del Millennio). A Normale e Difficile vale il moltiplicatore del livello, come per ogni campagna.
        premioFinale: { credits: 700, starChips: 1 }
    },

    // Le campagne ancora da scrivere. Dichiarate qui, senza capitoli: la
    // pagina le mostra bloccate con la loro descrizione, che e' piu'
    // onesto (e piu' utile) che non nominarle affatto. Scriverle vuol dire
    // riempire `capitoli`, e nient'altro da nessuna parte.
    {
        id: 'ww1',
        nome: 'Grande Guerra',
        sottotitolo: 'Il fronte italiano, 1915-1918',
        icona: '🎖️',
        // Nessun livello Facile/Normale/Difficile (vedi LIVELLI in
        // js/story/story-progress.js), per scelta esplicita dell'utente: i
        // mazzi della Grande Guerra sono congelati e non hanno tre versioni,
        // quindi ogni duello resta alla difficoltà scritta sulla sua tappa.
        senzaLivelli: true,
        // La mappa disegnata del fronte italiano. Il nome del file non
        // segue la convenzione `storia_<id>_1.jpg` (l'id della campagna è
        // 'ww1', il file si chiama col nome per esteso): resta com'è
        // arrivato invece di rinominarlo, e il nome canonico gli sta
        // dietro come secondo candidato — così un file messo lì domani con
        // quel nome funziona lo stesso, senza toccare niente.
        sfondo: [
            'images/maps/storia_la_grande_guerra_1.jpg',
            'images/maps/storia_ww1_1.jpg',
            'images/fields/mobile/rovine_2.jpg'
        ],
        // Due canti del fronte italiano invece della colonna sonora di
        // Yu-Gi-Oh: uno sulla mappa, l'altro sotto i duelli.
        musica: 'ww1/Alba sul Montello.mp3',
        musicaDuello: 'ww1/La carica del Piave.mp3',
        // E un campo di battaglia della guerra sotto ogni duello, invece
        // delle arene di Yu-Gi-Oh: quello di GIORNO, perché di giorno si
        // combatte quasi ogni battaglia della campagna. Le poche che il
        // testo colloca di notte (il Carso "sotto la luna", l'arrivo a
        // Trieste "stasera") dichiarano il campo notturno sulla tappa, e
        // lì vince il loro.
        campoDuello: 'images/fields/mobile/grandeGuerraCampoDiBattagliaGiorno.jpg',
        // Chi gioca è il Comando Supremo, cioè il suo capo: Cadorna per
        // i primi quattro capitoli (è lui al comando dall'Isonzo alla rotta
        // di Caporetto), Diaz dal Piave in poi — vedi WW1_COMANDANTI in
        // cima al file. Qui il valore di partenza; i capitoli di Diaz e la
        // tappa del passaggio di comando dichiarano il loro.
        protagonista: WW1_COMANDANTI.cadorna,
        // La descrizione parla della GUERRA, non del set di carte: quella
        // che c'era prima ("campagna a tema, con il set dedicato già
        // presente nel gioco") raccontava lo stato del database al
        // giocatore, che è l'unica persona a cui non interessa.
        descrizione: 'Tre anni e mezzo su una linea che nessuno aveva mai pensato di dover attaccare: undici battaglie sull\'Isonzo per pochi chilometri di carso, la Strafexpedition che scende dagli Altipiani alle spalle, la rotta di Caporetto, e poi un fiume dietro cui non c\'era più niente su cui fermarsi. Si gioca col Regio Esercito — fanti, Alpini, Bersaglieri, Arditi, con Baracca nel cielo — al comando prima di Cadorna, poi di Diaz.',
        // Solo il set WW1, e solo lo schieramento italiano: la
        // campagna e' raccontata da quella parte del fronte, e al
        // Piave non si schierano i Kaiserjager.
        carteAmmesse: { origini: ['ww1'], fazione: 'italiana' },
        // Il mazzo con cui si gioca: senza dirlo, un giocatore che apre
        // questa campagna si becca il divieto e non sa cosa farsene.
        mazzoConsigliato: 'ww1_regio_esercito',
        // Il mondo ha il rapporto della mappa (1672x940, cioè 16:9): steso
        // su proporzioni diverse il fronte si deformerebbe, e un fiume
        // storto su una carta geografica si vede subito.
        larghezza: 3200,
        altezza: 1800,
        capitoli: [
            {
                id: 'ww1-isonzo',
                nome: 'L\'Isonzo',
                testo: 'Maggio 1915: si passa il confine. Quattro battaglie in sette mesi per il Monte Nero e il Carso.',
                tappe: [
                    {
                        id: 'ww1-1-scena', kind: 'scene', icona: '📯',
                        label: '24 maggio 1915', x: 2527, y: 479,
                        // Il Comando Supremo È il protagonista: parla
                        // Cadorna, col suo volto (vedi WW1_COMANDANTI).
                        io: true,
                        testo: [
                            'Si entra in guerra il 24 maggio. Il fronte è una linea di montagne che nessuno ha mai pensato di dover attaccare.',
                            'Seicento chilometri di confine, e per trent\'anni li abbiamo studiati come una frontiera da difendere, non da passare. Le carte buone le ha l\'altro.',
                            'Di là c\'è l\'Isonzo, e dietro l\'Isonzo c\'è Boroević.',
                            'Ci vorranno undici battaglie per capire quanto è caro quel fiume. Alla prima nessuno lo sa ancora, e si parte pensando di essere a Trieste per l\'autunno.',
                            'Avanti, allora. Il Monte Nero prima che faccia buio.'
                        ]
                    },
                    {
                        id: 'ww1-1-boroevic', kind: 'duel', icona: '🦁',
                        label: 'La linea dell\'Isonzo', x: 2756, y: 670,
                        characterId: 'ww1_boroevic', difficulty: 'Medio',
                        dialogo: [
                            { chi: 'ww1_boroevic', testo: 'Avete dichiarato guerra il 23 e attaccato il 24. Un giorno intero: gentile da parte vostra.' },
                            { io: true, testo: 'Ci hanno detto che il fiume si passa in una settimana.' },
                            { chi: 'ww1_boroevic', testo: 'Ve l\'hanno detto uomini che l\'Isonzo l\'hanno visto solo su una carta. Io ci vivo sopra da un mese, e ogni pietra è dove l\'ho messa io.' }
                        ]
                    },
                    {
                        id: 'ww1-1-kaiserjager', kind: 'duel', icona: '⛰️',
                        label: 'Il Carso', x: 3024, y: 756,
                        characterId: 'ww1_kaiserjager', difficulty: 'Medio',
                        // Di notte: "Allora avanzeremo di notte" — "il sasso è bianco sotto la luna".
                        field: 'images/fields/mobile/grandeGuerraCampoDiBattagliaNotte.jpg',
                        dialogo: [
                            { chi: 'ww1_kaiserjager', testo: 'Il Carso non è terra: è sasso. Non si scava, si fa saltare — e ogni granata moltiplica le schegge per cento.' },
                            { io: true, testo: 'Allora avanzeremo di notte.' },
                            { chi: 'ww1_kaiserjager', testo: 'Di notte il sasso è bianco sotto la luna, e voi sopra siete neri. Venite pure.' }
                        ]
                    },
                    {
                        id: 'ww1-1-arigi', kind: 'duel', icona: '✈️',
                        label: 'Cieli dell\'Isonzo', x: 2871, y: 900,
                        characterId: 'ww1_arigi', difficulty: 'Medio',
                        dialogo: [
                            { chi: 'ww1_arigi', testo: 'Sono un sergente, non un barone. Volo da quando voi ancora contavate i cavalli.' },
                            { io: true, testo: 'E cosa vedi, da lassù?' },
                            { chi: 'ww1_arigi', testo: 'Vedo le vostre trincee come una riga di matita, e i vostri rincalzi che salgono in fila. Vedo tutto quello che i vostri generali credono nascosto.' }
                        ]
                    }
                ]
            },
            {
                id: 'ww1-strafexpedition',
                nome: 'La Strafexpedition',
                testo: 'Maggio 1916: l\'attacco scende dagli Altipiani alle spalle del fronte. Se arriva in pianura, la guerra finisce.',
                tappe: [
                    {
                        id: 'ww1-2-scena', kind: 'scene', icona: '🏔️',
                        label: 'Da Trento, maggio 1916', x: 612, y: 670,
                        chi: 'Conrad von Hötzendorf', chiId: 'ww1_conrad',
                        testo: [
                            'La chiamano "spedizione punitiva", e il nome è esatto: l\'Italia ha tradito la Triplice Alleanza e va punita.',
                            'Ho tolto quattordici divisioni al fronte russo per averne abbastanza quassù. I tedeschi mi hanno detto che è una follia. I tedeschi non sono mai stati nostri alleati per davvero.',
                            'Scendiamo dagli Altipiani alle loro spalle. Se arriviamo in pianura, tutto il fronte dell\'Isonzo resta tagliato fuori e la guerra finisce in un mese.',
                            'Duemila cannoni su un fronte di quaranta chilometri. Ad Asiago non resterà in piedi un muro.',
                            'È l\'offensiva che chiedo da cinque anni. Se riesce, nessuno ricorderà che l\'ho chiesta tardi.'
                        ]
                    },
                    {
                        id: 'ww1-2-conrad', kind: 'duel', icona: '🗺️',
                        label: 'La Valsugana', x: 766, y: 823,
                        characterId: 'ww1_conrad', difficulty: 'Medio',
                        dialogo: [
                            { chi: 'ww1_conrad', testo: 'Questa offensiva la volevo nel 1911, quando eravate ancora alleati. Mi dissero che era prematura.' },
                            { io: true, testo: 'E adesso?' },
                            { chi: 'ww1_conrad', testo: 'Adesso è tardi di cinque anni, e la faccio lo stesso. Scendo dagli Altipiani: sotto di voi, non davanti.' }
                        ]
                    },
                    {
                        id: 'ww1-2-kaiserjager', kind: 'duel', icona: '⛰️',
                        label: 'Altopiano dei Sette Comuni', x: 1148, y: 948,
                        characterId: 'ww1_kaiserjager', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_kaiserjager', testo: 'Asiago è cenere. Da qui alla pianura c\'è solo il ciglio dell\'altopiano, e dietro il ciglio non avete più niente.' },
                            { io: true, testo: 'Abbiamo la Prima Armata. E abbiamo il ciglio.' },
                            { chi: 'ww1_kaiserjager', testo: 'Allora tenetelo. Perché se cede qui, l\'Isonzo non serve più a nessuno.' }
                        ]
                    }
                ]
            },
            {
                id: 'ww1-gorizia',
                nome: 'Gorizia e la Bainsizza',
                testo: 'Agosto 1916: cade la prima città. Un anno dopo si arriva sull\'altopiano della Bainsizza, e lì ci si ferma.',
                tappe: [
                    {
                        id: 'ww1-3-scena', kind: 'scene', icona: '🏅',
                        label: '9 agosto 1916: Gorizia', x: 2622, y: 871,
                        chi: 'Il Bollettino',
                        testo: [
                            'La Strafexpedition si è fermata sugli Altipiani, e la Terza Armata è tornata sull\'Isonzo in dieci giorni di treni.',
                            'Sabotino, Podgora, e poi il ponte. Per la prima volta in quattordici mesi una città è caduta: Gorizia è nostra.',
                            'È la prima vittoria che si possa chiamare così. Ne servono ancora molte.',
                            'Perché oltre Gorizia comincia la Bainsizza, e oltre la Bainsizza comincia un altro altopiano, e così via fino a Lubiana.',
                            'Un anno dopo saremo lassù, con centoquarantamila uomini in meno e venti chilometri in più. Questo il bollettino di oggi non lo dice.'
                        ]
                    },
                    {
                        id: 'ww1-3-eugenio', kind: 'duel', icona: '🎖️',
                        label: 'La testa di ponte', x: 2440, y: 881,
                        characterId: 'ww1_eugenio', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_eugenio', testo: 'Vi lascio Gorizia. Una città vuota, con le finestre aperte e nessuno dentro.' },
                            { io: true, testo: 'È comunque la prima.' },
                            { chi: 'ww1_eugenio', testo: 'È la prima, sì. E dietro ce ne sono altre venti, ognuna con un altare di sassi davanti. Contate pure.' }
                        ]
                    },
                    {
                        id: 'ww1-3-boroevic', kind: 'duel', icona: '🦁',
                        label: 'L\'altopiano della Bainsizza', x: 2393, y: 661,
                        characterId: 'ww1_boroevic', difficulty: 'Difficile',
                        dialogo: [
                            { io: true, testo: 'Undicesima battaglia. Siamo sulla Bainsizza: l\'altopiano è nostro.' },
                            { chi: 'ww1_boroevic', testo: 'L\'altopiano è vostro perché io mi sono ritirato sulla linea dietro. Voi avete preso venti chilometri di sassi e centoquarantamila uomini in meno.' },
                            { chi: 'ww1_boroevic', testo: 'E adesso siete lunghi, stanchi e senza strade. È esattamente dove vi volevo.' }
                        ]
                    }
                ]
            },
            {
                id: 'ww1-caporetto',
                nome: 'Caporetto',
                testo: '24 ottobre 1917: dodici giorni, centocinquanta chilometri indietro, e un fiume dietro cui non c\'è più niente.',
                tappe: [
                    {
                        id: 'ww1-4-scena', kind: 'scene', icona: '🌧️',
                        label: '24 ottobre 1917', x: 1866, y: 632,
                        chi: 'Svetozar Boroević', chiId: 'ww1_boroevic',
                        testo: [
                            'Nebbia, gas, e una manovra che nessuno si aspetta dal punto in cui la facciamo: non sul Carso, dove vi siete preparati per due anni. Quassù, a Plezzo e a Tolmino.',
                            'E non veniamo soli: per la prima volta in questa guerra ci sono sette divisioni tedesche accanto alle mie.',
                            'Non sfondiamo la linea: ci passiamo dentro e proseguiamo, lasciandovi i capisaldi alle spalle. Le vostre riserve sono ammassate troppo avanti, e non serviranno a niente.',
                            'In dodici giorni un intero esercito in rotta. Non l\'abbiamo battuto: l\'abbiamo scavalcato.',
                            'Trecentomila prigionieri, e mezzo milione di persone sulle strade che non sono soldati. Non è più una battaglia, è un paese che si sposta.'
                        ]
                    },
                    {
                        id: 'ww1-4-brumowski', kind: 'duel', icona: '🛩️',
                        label: 'Sopra la rotta', x: 2086, y: 766,
                        characterId: 'ww1_brumowski', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_brumowski', testo: 'Ho volato basso sulle strade per Udine. Non ho contato soldati: ho contato carri, muli, donne e bambini. Una fila lunga un giorno di volo.' },
                            { io: true, testo: 'Quella è gente che scappa, non un esercito.' },
                            { chi: 'ww1_brumowski', testo: 'Lo so. È per questo che non ho sparato. Ma il prossimo che passa di qui sparerà.' }
                        ]
                    },
                    {
                        id: 'ww1-4-kaiserjager', kind: 'duel', icona: '⛰️',
                        label: 'La retroguardia', x: 2144, y: 1072,
                        characterId: 'ww1_kaiserjager', difficulty: 'Difficile',
                        dialogo: [
                            { io: true, testo: 'Ordine: tenere il ponte finché non è passata la Seconda Armata. Poi farlo saltare.' },
                            { chi: 'ww1_kaiserjager', testo: 'Sapete quanto vi resta? Due ore. E lo sapete anche voi che nessuno viene a darvi il cambio.' },
                            { io: true, testo: 'Due ore ci bastano.' }
                        ]
                    },
                    {
                        id: 'ww1-4-ritirata', kind: 'scene', icona: '🌊',
                        label: 'Novembre 1917: il Piave', x: 1493, y: 1503,
                        // Il passaggio di comando: il 9 novembre 1917
                        // Diaz sostituisce Cadorna. Questa tappa sta ancora
                        // nel capitolo di Caporetto, ma a parlare è già lui,
                        // ed è da qui che il volto del protagonista cambia.
                        protagonista: WW1_COMANDANTI.diaz,
                        io: true,
                        testo: [
                            'Ci siamo fermati sul Piave perché dietro il Piave non c\'è più niente su cui fermarsi.',
                            'Da qui non si arretra di un metro. Non è retorica: è che non c\'è un altro fiume.',
                            'Il Grappa ha tenuto per tutto dicembre, e i ragazzi del \'99 hanno diciott\'anni.',
                            'Adesso la linea è corta: dallo Stelvio al mare erano seicento chilometri, adesso sono poco più di duecento. Li possiamo tenere tutti.',
                            'E la difendiamo diversamente da prima. Meno ordini da lontano, più licenze, più caffè, meno fucilazioni. Un esercito che sa perché è lì si fa tenere meglio di uno che ha solo paura del proprio comando.'
                        ]
                    }
                ]
            },
            {
                id: 'ww1-piave',
                nome: 'La Battaglia del Solstizio',
                testo: 'Giugno 1918: l\'ultimo attacco che l\'Impero può ancora permettersi. Nove giorni, e il fiume in piena.',
                // Dal Piave alla fine, al comando c'è Diaz.
                protagonista: WW1_COMANDANTI.diaz,
                tappe: [
                    {
                        id: 'ww1-5-scena', kind: 'scene', icona: '🌙',
                        label: '15 giugno 1918', x: 2354, y: 1273,
                        io: true,
                        testo: [
                            'Sanno che attaccano, sappiamo che attaccano, e sappiamo anche l\'ora: i disertori cechi l\'hanno detta a memoria.',
                            'Alle due e mezza la nostra artiglieria spara per prima, sulle loro trincee ancora piene. Poi si vedrà.',
                            'Se regge il Piave, non è più questione di se finisce, ma di quando.',
                            'Perché loro attaccano in due direzioni per non scontentare nessuno dei due comandanti, e chi attacca in due direzioni non ne sfonda nessuna.',
                            'E dietro di loro c\'è un fiume che in questa stagione può salire di due metri in una notte. I ponti li abbiamo studiati uno per uno.'
                        ]
                    },
                    {
                        id: 'ww1-5-eugenio', kind: 'duel', icona: '🎖️',
                        label: 'Il basso Piave', x: 2029, y: 1360,
                        characterId: 'ww1_eugenio', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_eugenio', testo: 'Abbiamo passato il fiume in tre punti. Ci siamo dentro per otto chilometri.' },
                            { io: true, testo: 'Dentro, sì. Con il fiume alle spalle e i ponti sotto il nostro tiro.' },
                            { chi: 'ww1_eugenio', testo: '...e con la piena che sale da stanotte. Sì. Ho fatto i conti anch\'io.' }
                        ]
                    },
                    // Le tre tappe risalgono il fiume da valle verso monte,
                    // e sono in quest'ordine per quello: l'offensiva
                    // avvenne tutta insieme lungo tutto il Piave, quindi
                    // nessuna cronologia impone una sequenza — a decidere
                    // resta allora la mappa, e un percorso che va e torna
                    // indietro sulla stessa riva si legge come un errore.
                    {
                        id: 'ww1-5-brumowski', kind: 'duel', icona: '🛩️',
                        label: 'Sopra i ponti', x: 1378, y: 1149,
                        characterId: 'ww1_brumowski', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_brumowski', testo: 'Ottantacinque aerei sul Montello stamattina. I ponti vanno protetti: se saltano, la testa di ponte muore di fame in due giorni.' },
                            { io: true, testo: 'Allora saltano oggi.' },
                            { chi: 'ww1_brumowski', testo: 'Ci provate da tre giorni. Ma oggi avete anche il fiume dalla vostra: è salito di due metri in una notte.' }
                        ]
                    },
                    {
                        id: 'ww1-5-conrad', kind: 'duel', icona: '🗺️',
                        label: 'Il Montello', x: 1225, y: 1302,
                        characterId: 'ww1_conrad', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_conrad', testo: 'Ho chiesto un solo attacco, concentrato. Mi hanno dato due offensive separate, una mia e una di Boroević, per non offendere nessuno.' },
                            { io: true, testo: 'E così ne avete due deboli invece di una forte.' },
                            { chi: 'ww1_conrad', testo: 'Questo è un impero, non un esercito. Si perde anche per cortesia.' }
                        ]
                    }
                ]
            },
            {
                id: 'ww1-vittorioveneto',
                nome: 'Vittorio Veneto',
                testo: '24 ottobre 1918: un anno esatto dopo Caporetto, stesso giorno. Questa volta attacchiamo noi.',
                protagonista: WW1_COMANDANTI.diaz,
                tappe: [
                    {
                        id: 'ww1-6-scena', kind: 'scene', icona: '⚔️',
                        label: '24 ottobre 1918', x: 823, y: 1340,
                        io: true,
                        testo: [
                            'Un anno esatto dopo Caporetto, stesso giorno. Questa volta attacchiamo noi.',
                            'La Quarta Armata parte dal Grappa e tiene lì le loro riserve; le altre passano il Piave più a valle e puntano a Vittorio Veneto, che è la cerniera fra i loro due eserciti.',
                            'L\'esercito che abbiamo davanti è ancora forte sulla carta. Sulla carta.',
                            'Nei fatti gli ungheresi chiedono di tornare a casa, i cechi hanno un governo nuovo a cui rispondere, e i reggimenti si sciolgono da soli prima che li tocchiamo.',
                            'Fra dodici giorni si firma a Villa Giusti. Nessuno di noi, stamattina, lo sa ancora.'
                        ]
                    },
                    {
                        id: 'ww1-6-kaiserjager', kind: 'duel', icona: '⛰️',
                        label: 'Il Monte Grappa', x: 785, y: 1130,
                        characterId: 'ww1_kaiserjager', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_kaiserjager', testo: 'Sul Grappa non passate. Ci abbiamo provato noi un anno fa e non siamo passati; adesso tocca a voi non passare.' },
                            { io: true, testo: 'Non dobbiamo passare. Dobbiamo tenervi qui.' },
                            { chi: 'ww1_kaiserjager', testo: '...tutte le riserve. Su una montagna. Mentre gli altri passano il fiume. Chi ve l\'ha insegnato?' },
                            { io: true, testo: 'Voi. A Caporetto.' }
                        ]
                    },
                    {
                        id: 'ww1-6-boroevic', kind: 'duel', icona: '🦁',
                        label: 'Vittorio Veneto', x: 1034, y: 1168,
                        characterId: 'ww1_boroevic', difficulty: 'Difficile',
                        dialogo: [
                            { chi: 'ww1_boroevic', testo: 'Ho chiesto rinforzi a Vienna. Mi hanno risposto che gli ungheresi tornano a casa a fare il raccolto, e i cechi hanno un parlamento nuovo.' },
                            { io: true, testo: 'Siamo passati fra le vostre due armate. La linea è tagliata in due.' },
                            { chi: 'ww1_boroevic', testo: 'Ho tenuto quel fiume per tre anni e mezzo contro undici battaglie. Non mi batte il vostro esercito: mi batte il mio, che non esiste più.' }
                        ]
                    },
                    {
                        id: 'ww1-6-eugenio', kind: 'duel', icona: '🎖️',
                        label: 'Verso Trieste', x: 2833, y: 1177,
                        characterId: 'ww1_eugenio', difficulty: 'Difficile',
                        // Di notte: "voi arrivate a Trieste stasera".
                        field: 'images/fields/mobile/grandeGuerraCampoDiBattagliaNotte.jpg',
                        dialogo: [
                            { chi: 'ww1_eugenio', testo: 'A Villa Giusti stanno firmando. Fra poche ore questo non sarà più un fronte, sarà un confine.' },
                            { io: true, testo: 'Allora perché combattere ancora?' },
                            { chi: 'ww1_eugenio', testo: 'Perché l\'armistizio entra in vigore domani alle quindici, e voi arrivate a Trieste stasera. Un impero si perde anche così, per una questione di orari.' }
                        ]
                    },
                    {
                        id: 'ww1-6-bollettino', kind: 'scene', icona: '📜',
                        label: '4 novembre 1918', x: 3043, y: 996,
                        chi: 'Il Bollettino della Vittoria',
                        testo: [
                            'La guerra contro l\'Austria-Ungheria è vinta.',
                            'La battaglia gigantesca, ingaggiata il 24 ottobre, è terminata con la resa incondizionata del nemico.',
                            'I resti di quello che fu uno dei più potenti eserciti del mondo risalgono in disordine e senza speranza le valli che avevano disceso con orgogliosa sicurezza.',
                            'Firmato: Armando Diaz.'
                        ]
                    }
                ]
            }
        ],
        premioFinale: { credits: 2500, starChips: 4, locatorCards: 4, millenniumCards: 2 }
    },
    {
        id: 'ww2',
        nome: 'Seconda Guerra Mondiale',
        sottotitolo: 'Campagna extra',
        icona: '✈️',
        // Come la Grande Guerra: una storia di guerra, senza livelli.
        senzaLivelli: true,
        sfondo: ['images/maps/storia_ww2_1.jpg', 'images/fields/mobile/rovine_2.jpg'],
        // A differenza della Grande Guerra, un set di carte dedicato alla
        // Seconda NON esiste ancora: la descrizione non lo promette.
        descrizione: 'Campagna a tema Seconda Guerra Mondiale, seguito ideale della Grande Guerra.',
        carteAmmesse: { origini: ['ww2'] },
        larghezza: 1400,
        altezza: 1200,
        capitoli: [],
        premioFinale: null
    }
];

window.storyCampaignsDatabase = storyCampaignsDatabase;
