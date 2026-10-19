/**
 * field-ambience.js — Vita ambientale del Terreno di duello.
 * =====================================================================
 * Ogni tanto qualcosa attraversa o accende il campo. Tutte le arene del
 * catalogo hanno una configurazione propria costruita su profili modulari:
 *
 *   sabbia  — le cinque arene dell'Antico Egitto: folate di vento che
 *             trascinano sabbia, a terra, fra le rovine;
 *   vento   — il Dirigibile di Kaiba: lassù si duella IN CIELO, sopra il
 *             dirigibile, quindi corre solo aria — nessun granello, che
 *             a quella quota non avrebbe senso;
 *   tech    — le due Arene Kaiba: niente vento affatto, ma il campo
 *             olografico della KaibaCorp che si rivela a intermittenza,
 *             con la sua griglia e le sue scansioni.
 *
 * Non è un effetto di carta e non ha nulla a che vedere con la partita:
 * nessuna funzione del motore sa che questo file esiste, e cancellarlo
 * (con il suo <script>) riporta il duello esatto di prima.
 *
 * QUANDO SI ACCENDE. Tre condizioni, tutte necessarie:
 *   1) i Dettagli video sono su "Alti" (js/ui/video-quality.js,
 *      Impostazioni). È il livello che accende questi effetti: su
 *      "Normali" questo file crea zero elementi e non avvia alcun timer;
 *   2) l'arena in corso è fra quelle che un ambiente dichiara;
 *   3) il giocatore non ha chiesto meno animazioni
 *      (prefers-reduced-motion).
 *
 * COME AGGIUNGERNE UNO NUOVO. Una voce in AMBIENTI, e nient'altro: quali
 * arene copre, che tinte usa, quali strati, ogni quanto, e con quale
 * COREOGRAFIA fra quelle qui sotto. Non si tocca l'orchestrazione (scelta
 * dell'ambiente, pause casuali, sospensione a scheda nascosta, pulizia),
 * si scrivono solo le classi della nuova trama in js/ui/field-ambience.css.
 *
 * LE COREOGRAFIE sono il modo in cui una passata si svolge, ed è l'unica
 * parte che cambia davvero fra un ambiente e l'altro:
 *   'attraversa' — gli strati traversano lo schermo di lato, a velocità
 *                  diverse, respirando a ondate (vedi `respiro`). Vento e
 *                  sabbia;
 *   'scansione'  — niente traversata: il campo si accende dal basso, una
 *                  lama di luce lo percorre e tutto si spegne. Hi-tech.
 *
 * PERCHÉ GSAP. Ogni passata è una sequenza di più strati sfasati, con
 * dentro un'altra sequenza (le ondate della folata). Con le transizioni
 * CSS sarebbe una catena di setTimeout con i ritardi scritti a mano in
 * due posti da tenere allineati; una timeline la descrive in un punto
 * solo e, soprattutto, si può INTERROMPERE pulita a metà — cosa che
 * serve davvero qui, perché il duello può finire o l'impostazione
 * cambiare mentre la folata sta ancora attraversando lo schermo.
 *
 * DIPENDENZA PIGRA: gsap.min.js viene caricato dopo l'evento 'load'
 * (vedi duelMonstersCore.html), quindi quando questo file gira la
 * libreria di solito non c'è ancora — si aspetta con lo stesso schema
 * già usato da js/ui/fx-gsap.js, senza polling infinito.
 */
(function () {
    'use strict';

    // =================================================================
    // Catalogo degli ambienti
    // =================================================================

    /**
     * Tinte della sabbia. Non una sola: la stessa folata che di giorno è
     * polvere dorata controluce, di notte è un velo pallido che prende la
     * luce della luna.
     *
     * Di GIORNO la tinta NON è l'ocra della sabbia: è quasi bianca. Un
     * primo tentativo usava il colore della sabbia vera
     * (rgba(226,186,120)) e il risultato era invisibile — l'arena diurna
     * è già tutta ocra, e ocra su ocra non si stacca. Una folata
     * controluce è anche più fedele: la polvere sollevata dal sole si
     * vede perché RIFLETTE la luce, non per il proprio colore.
     */
    function tintaSabbia(campo) {
        const notte = /Notte/i.test(campo);
        return notte
            ? { piena: 'rgba(214, 222, 242, 0.78)', debole: 'rgba(182, 194, 222, 0.46)' }
            : { piena: 'rgba(255, 248, 232, 0.92)', debole: 'rgba(255, 238, 204, 0.52)' };
    }

    const AMBIENTI_ORIGINALI = [
        {
            nome: 'sabbia',
            // Le arene dell'Antico Egitto, giorno e notte. Il Palazzo in
            // Rovina è deliberatamente fuori: è un interno, una folata di
            // sabbia lì racconterebbe una cosa che non si vede nell'arte.
            campi: [
                'anticoEgittoGiorno_1.jpg',
                'anticoEgittoGiorno_2.jpg',
                'anticoEgittoNotte_1.jpg',
                'anticoEgittoNotte_2.jpg',
                'anticoEgittoNotte_3.jpg'
            ],
            coreografia: 'attraversa',
            tinta: tintaSabbia,
            // Quanto aspettare fra una folata e la successiva: un minimo e
            // un massimo, sorteggiati ogni volta. Deve restare un evento
            // raro — qualcosa che si nota e poi passa, non un effetto
            // costante che dopo due minuti è solo rumore di fondo.
            pausa: [10000, 22000],
            // Gli strati, dal fondo al primo piano. `quota` è l'opacità di
            // picco, `durata` i secondi per attraversare, `ritardo` lo
            // sfasamento rispetto all'inizio, `deriva` quanto sale o
            // scende strada facendo, `ondate` quante folate distinte
            // pulsano dentro la passata (vedi `respiro`), `slancio` la
            // curva: 0 = velocità costante, 1 = entra di slancio e si
            // smorza, che è come si muove il vento vero.
            strati: [
                // 1. Il velo di fondo: la massa della polvere sollevata,
                //    lenta e larga, quella che "sporca" l'aria.
                { classe: 'fa-sabbia-velo', piano: 'fondo', quota: 0.8, durata: 8.4, ritardo: 0, deriva: 26, ondate: 2, slancio: 0.25 },
                // 2. Il FRONTE della folata: una lingua stretta e densa
                //    che passa decisa. È lei a dare il colpo di vento —
                //    senza, la sabbia sembrava nebbia che si sposta.
                { classe: 'fa-sabbia-fronte', piano: 'fondo', quota: 1, durata: 3.2, ritardo: 0.7, deriva: 40, ondate: 1, slancio: 0.85 },
                // 3. La grana vera e propria, a velocità intermedia: è
                //    quella che fa leggere "sabbia" e non "foschia".
                { classe: 'fa-sabbia-granuli', piano: 'fondo', quota: 0.95, durata: 5.2, ritardo: 0.45, deriva: 18, ondate: 3, slancio: 0.4 },
                // 4. Le scie che il vento strappa dalla cresta delle dune,
                //    davanti alle carte: è l'unico strato in primo piano.
                //    Resta il più tenue dei quattro anche ora che la
                //    folata è stata resa più marcata — è l'unico che passa
                //    SOPRA le carte, e oltre una certa soglia non dà più
                //    profondità, disturba soltanto chi sta leggendo una
                //    carta. Quindi sale, ma meno degli altri.
                { classe: 'fa-sabbia-strisce', piano: 'primopiano', quota: 0.38, durata: 3.4, ritardo: 1.2, deriva: 34, ondate: 2, slancio: 0.7 }
            ]
        },
        {
            nome: 'vento',
            // Il Dirigibile di Kaiba: si duella sul ponte, in quota. Lì
            // non c'è sabbia da sollevare — solo aria che corre, e ogni
            // tanto un filo di nube che passa. Per questo l'ambiente è
            // separato invece di essere "la sabbia senza i granuli": le
            // due cose si muovono in modo diverso, il vento d'alta quota
            // è più rapido e più continuo.
            campi: ['dirigibileKaibaCorp.jpg'],
            coreografia: 'attraversa',
            // Bianco pieno: il ponte del Dirigibile è scuro, di notte, fra
            // le nuvole — un bianco "appena accennato" ci si perdeva
            // dentro. Contro un fondo così, l'aria si vede solo se è
            // luminosa davvero.
            tinta: () => ({ piena: 'rgba(255, 255, 255, 0.88)', debole: 'rgba(224, 240, 255, 0.5)' }),
            // In cielo il vento non si prende pause lunghe come una
            // tempesta di sabbia nel deserto: passa spesso.
            pausa: [6500, 15000],
            strati: [
                { classe: 'fa-vento-nube', piano: 'fondo', quota: 0.68, durata: 7, ritardo: 0, deriva: 16, ondate: 2, slancio: 0.2 },
                { classe: 'fa-vento-correnti', piano: 'fondo', quota: 0.85, durata: 3.4, ritardo: 0.4, deriva: 26, ondate: 2, slancio: 0.9 },
                // Come per la sabbia, lo strato davanti alle carte sale
                // meno degli altri: deve dare profondità, non coprire.
                { classe: 'fa-vento-correnti', piano: 'primopiano', quota: 0.42, durata: 2.4, ritardo: 1, deriva: 40, ondate: 1, slancio: 1 }
            ]
        },
        {
            nome: 'tech',
            // Le Arene Kaiba: un campo da duello della KaibaCorp, al
            // chiuso. Niente vento: quello che ogni tanto si vede è
            // l'ologramma del campo che si ridisegna — griglia, lama di
            // scansione, blocchi di dati.
            // (Le vecchie Arene Kaiba 1 e 2 sono state tolte dal gioco,
            // richiesta dell'utente: resta lo Stadio Kaiba, che ne ha preso
            // il posto ovunque.)
            campi: ['stadioKaiba.jpg'],
            coreografia: 'scansione',
            // Il ciano della macchina: nel resto del gioco è già il colore
            // riservato a "sta parlando il sistema" (vedi js/ui/mp-lobby.css),
            // e qui vale esattamente lo stesso principio.
            tinta: () => ({ piena: 'rgba(127, 227, 255, 0.85)', debole: 'rgba(90, 190, 240, 0.4)' }),
            pausa: [11000, 24000],
            strati: [
                // La griglia del campo olografico: si accende, resta un
                // momento, si spegne. È il fondale dell'intera scansione.
                { classe: 'fa-tech-griglia', piano: 'fondo', forma: 'campo', quota: 0.5, ruolo: 'griglia' },
                // La lama che percorre il campo dal basso verso l'alto:
                // è lei a "leggere" la griglia, e va davanti alle carte
                // perché passi sopra al tavolo, non sotto.
                { classe: 'fa-tech-lama', piano: 'primopiano', forma: 'campo', quota: 0.55, ruolo: 'lama' },
                // Blocchi di dati che lampeggiano al passaggio della lama.
                { classe: 'fa-tech-dati', piano: 'fondo', forma: 'campo', quota: 0.4, ruolo: 'dati' }
            ]
        }
    ];

    // Ogni immagine del catalogo ha una voce propria. Le famiglie sotto
    // condividono soltanto coreografia e geometria degli strati: nome,
    // campo, variante cromatica e ritmo restano specifici dell'arena.
    // In questo modo aggiungere/togliere un field non richiede modifiche
    // all'orchestrazione, e l'interruttore Dettagli video continua a
    // spegnere l'intero modulo da un solo punto.
    const PROFILI = {
        sabbia: AMBIENTI_ORIGINALI.find((a) => a.nome === 'sabbia'),
        vento: AMBIENTI_ORIGINALI.find((a) => a.nome === 'vento'),
        tech: AMBIENTI_ORIGINALI.find((a) => a.nome === 'tech'),
        spalti: {
            coreografia: 'spalti', pausa: [3800, 8500],
            strati: [
                { classe: 'fa-spalti-layer', piano: 'fondo', forma: 'campo', ruolo: 'flash' },
                { classe: 'fa-spalti-layer', piano: 'primopiano', forma: 'campo', ruolo: 'bagliore' }
            ]
        },
        tempioOscuro: {
            coreografia: 'tempioOscuro', pausa: [4200, 9000],
            tinta: () => ({ piena: 'rgba(255,151,48,.96)', debole: 'rgba(255,84,20,.42)' }),
            strati: [
                { classe: 'fa-tempio-layer', piano: 'fondo', forma: 'campo', ruolo: 'torce' },
                { classe: 'fa-tempio-layer', piano: 'fondo', forma: 'campo', ruolo: 'occhio' },
                { classe: 'fa-tempio-layer', piano: 'primopiano', forma: 'campo', ruolo: 'scintille' }
            ]
        },
        natura: {
            coreografia: 'atmosfera', pausa: [6500, 14000],
            strati: [
                { classe: 'fa-atmo-luce', piano: 'fondo', quota: .48, durata: 5.8, dx: 35, dy: -24, scala: .12 },
                { classe: 'fa-atmo-moti', piano: 'primopiano', quota: .38, durata: 5.1, dx: 80, dy: 38, rotazione: 8 }
            ]
        },
        acqua: {
            coreografia: 'atmosfera', pausa: [5200, 11500],
            strati: [
                { classe: 'fa-atmo-caustiche', piano: 'fondo', quota: .52, durata: 5.4, dx: 38, dy: 12, scala: .1 },
                { classe: 'fa-atmo-bolle', piano: 'primopiano', quota: .34, durata: 5.8, dx: 24, dy: -95, scala: .16 }
            ]
        },
        ghiaccio: {
            coreografia: 'atmosfera', pausa: [5000, 12000],
            strati: [
                { classe: 'fa-atmo-brina', piano: 'fondo', quota: .5, durata: 5.4, dx: 46, dy: 18, scala: .08 },
                { classe: 'fa-atmo-neve', piano: 'primopiano', quota: .45, durata: 6.2, dx: 115, dy: 105, rotazione: 12 }
            ]
        },
        fuoco: {
            coreografia: 'atmosfera', pausa: [4700, 10500],
            strati: [
                { classe: 'fa-atmo-bagliore', piano: 'fondo', quota: .5, durata: 4.2, dx: 0, dy: -12, scala: .12 },
                { classe: 'fa-atmo-braci', piano: 'primopiano', quota: .42, durata: 5.4, dx: 55, dy: -115, rotazione: 14 }
            ]
        },
        ombra: {
            coreografia: 'atmosfera', pausa: [6000, 13500],
            strati: [
                { classe: 'fa-atmo-tenebra', piano: 'fondo', quota: .62, durata: 5.5, dx: 32, dy: -16, scala: .16 },
                { classe: 'fa-atmo-rune', piano: 'primopiano', quota: .33, durata: 5.2, dx: -35, dy: -32, rotazione: -9 }
            ]
        },
        fumo: {
            coreografia: 'atmosfera', pausa: [5500, 12500],
            strati: [
                { classe: 'fa-atmo-fumo', piano: 'fondo', quota: .58, durata: 6.6, dx: 95, dy: -42, scala: .18 },
                { classe: 'fa-atmo-cenere', piano: 'primopiano', quota: .34, durata: 5.7, dx: 68, dy: 75, rotazione: 11 }
            ]
        },
        guerra: {
            coreografia: 'guerra', pausa: [1400, 17000], ritmoCasuale: 'guerra',
            strati: [
                { classe: 'fa-guerra-layer', piano: 'fondo', forma: 'campo', ruolo: 'fumo' },
                { classe: 'fa-guerra-layer', piano: 'fondo', forma: 'campo', ruolo: 'esplosioni' },
                { classe: 'fa-guerra-layer', piano: 'primopiano', forma: 'campo', ruolo: 'proiettili' }
            ]
        },
        energia: {
            coreografia: 'atmosfera', pausa: [5200, 12000],
            strati: [
                { classe: 'fa-atmo-portale', piano: 'fondo', quota: .58, durata: 4.4, dx: 0, dy: 0, scala: .22, rotazione: 10 },
                { classe: 'fa-atmo-scariche', piano: 'primopiano', quota: .4, durata: 3.8, dx: 22, dy: -18, scala: .1 }
            ]
        },
        citta: {
            coreografia: 'atmosfera', pausa: [8000, 17000],
            strati: [
                { classe: 'fa-atmo-riflessi', piano: 'fondo', quota: .42, durata: 4.8, dx: 65, dy: 12, scala: .08 },
                { classe: 'fa-atmo-foglie', piano: 'primopiano', quota: .3, durata: 6.4, dx: 120, dy: 70, rotazione: 18 }
            ]
        }
    };

    // Sul Dirigibile il vento non è un evento che compare ogni tanto: è il
    // movimento stesso del mezzo. Una timeline lunga tiene sempre viva una
    // corrente leggera; circa una passata su tre diventa una raffica forte.
    // Gli altri field della famiglia vento (montagna/Torre) conservano invece
    // le pause naturali del loro profilo.
    PROFILI.dirigibile = {
        coreografia: 'ventoContinuo',
        pausa: [60, 260],
        ritmoCasuale: 'vento-continuo',
        tinta: PROFILI.vento.tinta,
        strati: [
            { classe: 'fa-vento-nube', piano: 'fondo', quota: .38, durata: 10.5, ritardo: 0, deriva: 18 },
            { classe: 'fa-vento-correnti', piano: 'fondo', quota: .6, durata: 7.8, ritardo: .1, deriva: 30 },
            { classe: 'fa-vento-correnti', piano: 'primopiano', quota: .3, durata: 5.9, ritardo: .35, deriva: 48 }
        ]
    };

    // Variante industriale della scansione KaibaCorp: conserva la base
    // tecnologica ma aggiunge un livello dedicato alle scariche locali.
    PROFILI.industria = {
        coreografia: 'industria',
        pausa: [4200, 10500],
        strati: PROFILI.tech.strati.map((s) => Object.assign({}, s)).concat([
            { classe: 'fa-industria-layer', piano: 'primopiano', forma: 'campo', ruolo: 'scintille' }
        ])
    };

    const SPECIFICHE_CAMPI = [
        ['rovine_1.jpg', 'rovine-edera', 'natura', 'rovine'],
        ['rovine_2.jpg', 'rovine-spiriti', 'ombra', 'spiriti'],
        ['anticoEgittoGiorno_1.jpg', 'egitto-geroglifici-solari', 'sabbia', 'sabbia-giorno'],
        ['anticoEgittoGiorno_2.jpg', 'valle-dei-re', 'sabbia', 'sabbia-intensa'],
        ['anticoEgittoNotte_1.jpg', 'egitto-luna-blu', 'sabbia', 'sabbia-lunare'],
        ['anticoEgittoNotte_2.jpg', 'nilo-notturno', 'ombra', 'nebbia-lunare'],
        ['anticoEgittoNotte_3.jpg', 'tempio-crepe-arcane', 'energia', 'energia-oro'],
        ['anticoEgittoRovinePalazzo.jpg', 'palazzo-raggi-lunari', 'ombra', 'raggi-luna'],
        ['arenaRegnoDeiDuellanti.jpg', 'arena-bosco', 'natura', 'foglie-sole'],
        ['arenaCastelloPegasus.jpg', 'castello-candele', 'fuoco', 'candele-viola'],
        ['torreCastelloPegasus.jpg', 'torre-vento-verde', 'natura', 'petali-alti'],
        ['stadioKaiba.jpg', 'stadio-flash-spalti', 'spalti', 'spalti-kaiba'],
        ['dirigibileKaibaCorp.jpg', 'dirigibile-alta-quota', 'dirigibile', 'vento-blu'],
        ['torreDeiDuelli.jpg', 'torre-cielo', 'vento', 'vento-solare'],
        ['torreDeiDuelliColosseo.jpg', 'torre-colosseo', 'tech', 'tech-celeste'],
        ['torreDeiDuelliShadow.jpg', 'torre-shadow', 'ombra', 'vuoto-viola'],
        ['mondoVirtualeArenaGozaburo.jpg', 'gozaburo-glitch', 'energia', 'glitch-rosso'],
        ['citta.jpg', 'citta-brezza', 'citta', 'citta'],
        ['campoPrato.jpg', 'prateria-pollini', 'natura', 'pollini'],
        ['campoGhiaccio.jpg', 'ghiaccio-nevicata', 'ghiaccio', 'neve'],
        ['campoAcquatico.jpg', 'acqua-caustiche', 'acqua', 'acqua'],
        ['campoForesta.jpg', 'foresta-lucciole', 'natura', 'lucciole'],
        ['campoMontagna.jpg', 'montagna-nuvole', 'vento', 'vento-montagna'],
        ['rovineAntiche.jpg', 'rovine-deserto', 'sabbia', 'sabbia-rovine'],
        ['rovineAnticoEgittoGiorno.jpg', 'rovine-egizie-sole', 'sabbia', 'sabbia-calda'],
        ['rovineAnticoEgittoNotte.jpg', 'rovine-egizie-luna', 'fuoco', 'braci-lunari'],
        ['arenaAnticoEgittoGiorno.jpg', 'arena-egizia-fontane', 'acqua', 'acqua-solare'],
        ['arenaAnticoEgittoNotte.jpg', 'arena-egizia-torce', 'fuoco', 'torce-blu'],
        ['arenaAnticoEgittoZorc.jpg', 'arena-zorc', 'energia', 'inferno-zorc'],
        ['anticoEgittoPiazzaGiorno.jpg', 'piazza-calore', 'sabbia', 'calore-piazza'],
        ['anticoEgittoPiazzaNotte.jpg', 'piazza-torce', 'fuoco', 'torce-piazza'],
        ['anticoEgittoTempio.jpg', 'tempio-fiamme', 'fuoco', 'tempio-oro'],
        ['anticoEgittoTempioOscuro.jpg', 'tempio-bracieri-horus', 'tempioOscuro', 'tempio-bracieri'],
        ['grandeGuerraCampoDiBattagliaGiorno.jpg', 'guerra-fronte-diurno', 'guerra', 'guerra-giorno'],
        ['grandeGuerraCampoDiBattagliaNotte.jpg', 'guerra-fronte-notturno', 'guerra', 'guerra-notte'],
        ['industriaKaibaCorp.jpg', 'industria-scariche', 'industria', 'tech-industria']
    ];

    const TINTE_PROFILO = {
        natura: { piena: 'rgba(202,255,128,.9)', debole: 'rgba(91,205,111,.38)' },
        acqua: { piena: 'rgba(190,250,255,.9)', debole: 'rgba(70,205,242,.4)' },
        ghiaccio: { piena: 'rgba(244,252,255,.94)', debole: 'rgba(151,213,255,.5)' },
        fuoco: { piena: 'rgba(255,224,132,.94)', debole: 'rgba(255,101,43,.48)' },
        ombra: { piena: 'rgba(196,146,255,.84)', debole: 'rgba(73,34,129,.48)' },
        fumo: { piena: 'rgba(206,199,185,.72)', debole: 'rgba(94,92,94,.4)' },
        guerra: { piena: 'rgba(255,210,112,.96)', debole: 'rgba(91,87,78,.56)' },
        energia: { piena: 'rgba(255,116,176,.92)', debole: 'rgba(120,35,215,.5)' },
        citta: { piena: 'rgba(234,255,184,.82)', debole: 'rgba(100,190,145,.34)' },
        dirigibile: { piena: 'rgba(255,255,255,.88)', debole: 'rgba(224,240,255,.5)' },
        industria: { piena: 'rgba(173,231,255,.86)', debole: 'rgba(255,87,64,.36)' },
        spalti: { piena: 'rgba(235,249,255,.98)', debole: 'rgba(97,190,255,.48)' }
    };

    // Terzo accento visivo: è la "firma" del luogo, non del profilo.
    // Due arene possono condividere acqua/ombra/fuoco ma non devono
    // sembrare lo stesso preset con un colore diverso.
    const FIRME_VARIANTI = {
        rovine: 'fa-firma-foglie', spiriti: 'fa-firma-spiriti',
        'nebbia-lunare': 'fa-firma-luna', 'raggi-luna': 'fa-firma-raggi',
        'foglie-sole': 'fa-firma-raggi', 'candele-viola': 'fa-firma-fiamme',
        'petali-alti': 'fa-firma-petali', 'vuoto-viola': 'fa-firma-vortice',
        'glitch-rosso': 'fa-firma-scariche', citta: 'fa-firma-riflessi',
        pollini: 'fa-firma-pollini', neve: 'fa-firma-cristalli',
        acqua: 'fa-firma-onde', lucciole: 'fa-firma-lucciole',
        'braci-lunari': 'fa-firma-braci', 'acqua-solare': 'fa-firma-raggi',
        'torce-blu': 'fa-firma-fiamme', 'inferno-zorc': 'fa-firma-vortice',
        'torce-piazza': 'fa-firma-braci', 'tempio-oro': 'fa-firma-raggi',
        'tempio-oscuro': 'fa-firma-spiriti'
    };

    function copiaProfilo(nome, campo, profiloNome, variante) {
        const profilo = PROFILI[profiloNome];
        const strati = profilo.strati.map((s) => Object.assign({}, s));
        const firma = FIRME_VARIANTI[variante];
        if (firma && profilo.coreografia === 'atmosfera') {
            strati.push({
                classe: firma,
                piano: 'primopiano',
                quota: .26,
                durata: 4.8,
                dx: 58,
                dy: -46,
                scala: .16,
                rotazione: 14
            });
        }
        return {
            nome,
            campi: [campo],
            variante,
            coreografia: profilo.coreografia,
            tinta: profilo.tinta || (() => TINTE_PROFILO[profiloNome]),
            pausa: profilo.pausa.slice(),
            ritmoCasuale: profilo.ritmoCasuale || null,
            // Se js/ui/ambiente-webgl.js ha una voce per questa arena, la disegna
            // lui (un solo shader); gli strati qui sotto restano come ripiego.
            webgl: (window.AmbienteWebGL && window.AmbienteWebGL.NOMI.indexOf(nome) >= 0) ? nome : null,
            strati
        };
    }

    const AMBIENTI = SPECIFICHE_CAMPI.map((v) => copiaProfilo(v[1], v[0], v[2], v[3]));

    // =================================================================
    // Stato
    // =================================================================

    let ambienteAttivo = null;   // la voce di AMBIENTI scelta per questa arena
    let elementi = [];           // gli strati DOM, creati una volta sola
    let timeline = null;         // la passata attualmente in corso, se c'è
    let prossima = null;         // timer che fa partire la prossima passata
    // Piu' cause possono sospendere insieme l'ambiente (scheda nascosta,
    // video a schermo intero). Un Set evita che la fine di una causa
    // riaccenda GSAP mentre l'altra e' ancora valida.
    const motiviSospensione = new Set();

    function sospeso() { return motiviSospensione.size > 0; }

    function aggiornaSospensione() {
        if (!ambienteAttivo) return;
        if (sospeso()) {
            clearTimeout(prossima);
            prossima = null;
            if (timeline) timeline.pause();
        } else if (timeline) {
            timeline.play();
        } else {
            programmaProssima();
        }
    }

    function sospendi(motivo) {
        motiviSospensione.add(motivo || 'esterno');
        if (window.AmbienteWebGL) AmbienteWebGL.sospendi(true);
        aggiornaSospensione();
    }

    function riprendi(motivo) {
        motiviSospensione.delete(motivo || 'esterno');
        if (window.AmbienteWebGL && !sospeso()) AmbienteWebGL.sospendi(false);
        aggiornaSospensione();
    }

    function menoAnimazioni() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function dettagliAlti() {
        // Senza il modulo dei Dettagli video non si accende nulla: il
        // livello "Alti" è una scelta esplicita, non un default implicito.
        return !!(window.VideoQuality && window.VideoQuality.isAlti());
    }

    /**
     * L'arena in corso. `DUEL_ARENA_CUSTOM_FIELD` è impostata in cima al
     * <body> di duelMonstersCore.html quando si arriva con ?field=; senza
     * quel parametro vale il Terreno di default della pagina.
     */
    function campoCorrente() {
        return window.DUEL_ARENA_CUSTOM_FIELD || 'dirigibileKaibaCorp.jpg';
    }

    function trovaAmbiente(campo) {
        return AMBIENTI.find((a) => a.campi.indexOf(campo) !== -1) || null;
    }

    function fraDueNumeri(min, max) {
        return min + Math.random() * (max - min);
    }

    // =================================================================
    // Strati
    // =================================================================

    /**
     * GRANA DI SABBIA, disegnata una volta sola su un canvas e riusata
     * come piastrella di sfondo.
     *
     * Perché non i gradienti CSS, che pure facevano il lavoro finora: un
     * `radial-gradient` ripetuto è una GRIGLIA perfetta. Finché la folata
     * era tenue non si notava, ma appena l'intensità è salita (richiesta
     * esplicita: "più marcate ed evidenti") i granelli si sono messi in
     * fila come i fori di una scheda perforata — si leggeva un motivo, non
     * della sabbia. Sovrapporre più griglie con passi diversi attenua il
     * problema ma non lo toglie: ogni griglia resta regolare per conto
     * suo.
     *
     * Qui i granelli sono davvero sparsi a caso, con raggio e opacità
     * variabili. La piastrella è grande (384px) e viene generata una volta
     * per duello: la sua ripetizione esiste, ma a quella distanza e in
     * movimento non è percepibile, mentre una griglia da 58px lo era
     * eccome.
     */
    function texturaGranelli(tinta) {
        const LATO = 384;
        const QUANTI = 260;
        const tela = document.createElement('canvas');
        tela.width = LATO;
        tela.height = LATO;
        const ctx = tela.getContext('2d');
        if (!ctx) return null;

        for (let i = 0; i < QUANTI; i++) {
            // Granelli piccoli in maggioranza e pochi grossi: elevando a
            // potenza un numero fra 0 e 1 si ottiene proprio questo, senza
            // dover scrivere a mano delle fasce di dimensione.
            const raggio = 0.6 + Math.pow(Math.random(), 2.2) * 2.6;
            ctx.beginPath();
            ctx.arc(Math.random() * LATO, Math.random() * LATO, raggio, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() < 0.45 ? tinta.piena : tinta.debole;
            ctx.globalAlpha = 0.45 + Math.random() * 0.55;
            ctx.fill();
        }
        return `url("${tela.toDataURL('image/png')}")`;
    }

    /**
     * Disegna una singola lastra di vapore d'alta quota. Non usa pattern
     * ripetuti: ogni filamento ha origine, curva, spessore e luminosità
     * differenti, con piccoli sbuffi separati. Così il movimento legge come
     * aria che si torce attorno al dirigibile, non come righe che scorrono.
     */
    function texturaVento(tinta, vicino) {
        const tela = document.createElement('canvas');
        tela.width = 1280;
        tela.height = 420;
        const ctx = tela.getContext('2d');
        if (!ctx) return null;
        const quanti = vicino ? 11 : 17;

        for (let i = 0; i < quanti; i++) {
            const x = Math.random() * tela.width;
            const y = 25 + Math.random() * (tela.height - 50);
            const lunghezza = (vicino ? 120 : 170) + Math.random() * (vicino ? 260 : 390);
            const piega = (Math.random() - .5) * (vicino ? 95 : 70);
            const spessore = (vicino ? 2.2 : 1.2) + Math.random() * (vicino ? 4.8 : 3.4);
            const verso = Math.random() < .5 ? -1 : 1;
            const gradiente = ctx.createLinearGradient(x, y, x + lunghezza * verso, y + piega);
            gradiente.addColorStop(0, 'rgba(255,255,255,0)');
            gradiente.addColorStop(.22, tinta.debole);
            gradiente.addColorStop(.62, tinta.piena);
            gradiente.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(
                x + lunghezza * .28 * verso, y - piega * .65,
                x + lunghezza * .72 * verso, y + piega * 1.35,
                x + lunghezza * verso, y + piega
            );
            ctx.strokeStyle = gradiente;
            ctx.globalAlpha = .16 + Math.random() * (vicino ? .28 : .2);
            ctx.lineWidth = spessore;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Un alone locale spezza ulteriormente la silhouette del filo.
            if (Math.random() < .65) {
                const alone = ctx.createRadialGradient(x, y, 0, x, y, 20 + spessore * 7);
                alone.addColorStop(0, tinta.debole);
                alone.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = alone;
                ctx.globalAlpha = .12 + Math.random() * .16;
                ctx.fillRect(x - 50, y - 50, 100, 100);
            }
        }
        ctx.globalAlpha = 1;
        return `url("${tela.toDataURL('image/png')}")`;
    }

    /**
     * Le particelle dei profili organici non devono rivelare la piastrella
     * regolare dei radial-gradient CSS. Ogni ingresso nel field costruisce
     * quindi una trama diversa: posizioni, dimensioni, inclinazioni e vuoti
     * sono casuali. Il canvas viene rasterizzato una volta sola; durante il
     * duello GSAP continua ad animare soltanto transform e opacity.
     */
    function texturaAtmosfera(tinta, classe, variante) {
        const tela = document.createElement('canvas');
        tela.width = 1024;
        tela.height = 560;
        const ctx = tela.getContext('2d');
        if (!ctx) return null;
        const bolle = /bolle|onde/.test(classe);
        const cristalli = /neve|cristalli/.test(classe);
        const calde = /braci|cenere|lucciole|pollini/.test(classe);
        const foglie = /foglie|petali/.test(classe);
        const scariche = /scariche/.test(classe);
        const simboli = /rune/.test(classe);
        const fasci = /raggi|riflessi/.test(classe);
        const acqua = /caustiche/.test(classe);

        if (scariche) {
            for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
                let x = fraDueNumeri(40, tela.width - 40);
                let y = fraDueNumeri(20, tela.height * .45);
                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let tratto = 0; tratto < 4 + Math.floor(Math.random() * 5); tratto++) {
                    x += fraDueNumeri(-46, 46);
                    y += fraDueNumeri(22, 68);
                    ctx.lineTo(x, y);
                }
                ctx.strokeStyle = Math.random() < .5 ? tinta.piena : tinta.debole;
                ctx.globalAlpha = fraDueNumeri(.26, .72);
                ctx.lineWidth = fraDueNumeri(.8, 2.1);
                ctx.stroke();
            }
            return `url("${tela.toDataURL('image/png')}")`;
        }
        if (simboli || acqua) {
            const quantiSegni = acqua ? 14 : 9;
            for (let i = 0; i < quantiSegni; i++) {
                const x = Math.random() * tela.width;
                const y = Math.random() * tela.height;
                const rx = fraDueNumeri(18, acqua ? 92 : 54);
                const ry = rx * fraDueNumeri(.35, .82);
                ctx.beginPath();
                ctx.ellipse(x, y, rx, ry, fraDueNumeri(-.5, .5), fraDueNumeri(0, 1.2), fraDueNumeri(3.7, 6.1));
                ctx.strokeStyle = Math.random() < .5 ? tinta.piena : tinta.debole;
                ctx.globalAlpha = fraDueNumeri(.12, .42);
                ctx.lineWidth = fraDueNumeri(.7, 1.8);
                ctx.stroke();
            }
            return `url("${tela.toDataURL('image/png')}")`;
        }
        if (fasci) {
            for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) {
                const x = fraDueNumeri(-100, tela.width);
                const largo = fraDueNumeri(18, 80);
                const deriva = fraDueNumeri(-170, 170);
                const grad = ctx.createLinearGradient(x, 0, x + deriva, tela.height);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(.5, Math.random() < .5 ? tinta.piena : tinta.debole);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + largo, 0);
                ctx.lineTo(x + deriva + largo * .35, tela.height);
                ctx.lineTo(x + deriva, tela.height);
                ctx.closePath();
                ctx.globalAlpha = fraDueNumeri(.06, .22);
                ctx.fillStyle = grad;
                ctx.fill();
            }
            return `url("${tela.toDataURL('image/png')}")`;
        }
        const quanti = bolle ? 34 : cristalli ? 62 : foglie ? 48 : calde ? 72 : 54;

        for (let i = 0; i < quanti; i++) {
            const x = Math.random() * tela.width;
            const y = Math.random() * tela.height;
            const misura = .8 + Math.pow(Math.random(), 1.8) * (foglie ? 6.5 : cristalli ? 4.2 : 3.8);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI);
            ctx.globalAlpha = .18 + Math.random() * .65;
            ctx.strokeStyle = Math.random() < .46 ? tinta.piena : tinta.debole;
            ctx.fillStyle = ctx.strokeStyle;
            if (bolle) {
                ctx.lineWidth = .7 + Math.random() * 1.2;
                ctx.beginPath();
                ctx.ellipse(0, 0, misura, misura * fraDueNumeri(.72, 1.25), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (cristalli) {
                ctx.beginPath();
                ctx.moveTo(0, -misura * 1.5);
                ctx.lineTo(misura * .7, 0);
                ctx.lineTo(0, misura * 1.5);
                ctx.lineTo(-misura * .7, 0);
                ctx.closePath();
                ctx.fill();
            } else if (foglie) {
                ctx.beginPath();
                ctx.ellipse(0, 0, misura * 1.7, misura * .55, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, misura, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        // Una trama non periodica per field: cover, mai repeat. La variante
        // partecipa indirettamente rigenerando il canvas a ogni cambio arena.
        void variante;
        return `url("${tela.toDataURL('image/png')}")`;
    }

    function creaElementi(ambiente, campo) {
        const tinta = ambiente.tinta ? ambiente.tinta(campo) : { piena: '#fff', debole: 'rgba(255,255,255,0.3)' };
        // La grana serve solo a chi la usa davvero (oggi la sabbia): per
        // gli altri ambienti non si disegna nulla.
        const grana = ambiente.strati.some((s) => s.classe === 'fa-sabbia-granuli')
            ? texturaGranelli(tinta) : null;
        elementi = ambiente.strati.map((strato) => {
            const el = document.createElement('div');
            el.className = `fa-strato fa-strato--${strato.piano} ${strato.classe} fa-variante--${ambiente.variante}`
                + (strato.forma === 'campo' ? ' fa-strato--campo' : '');
            el.style.setProperty('--fa-tinta', tinta.piena);
            el.style.setProperty('--fa-tinta-debole', tinta.debole);
            if (grana) el.style.setProperty('--fa-grana', grana);
            if (strato.classe === 'fa-vento-correnti' || strato.classe === 'fa-vento-nube') {
                const vento = texturaVento(tinta, strato.piano === 'primopiano');
                if (vento) el.style.setProperty('--fa-vento-textura', vento);
            }
            if (strato.classe === 'fa-sabbia-strisce') {
                const scie = texturaVento(tinta, true);
                if (scie) el.style.setProperty('--fa-sabbia-scie', scie);
            }
            if (/fa-(?:atmo-(?:moti|foglie|neve|braci|cenere|bolle|caustiche|rune|scariche|riflessi)|firma-(?:foglie|petali|pollini|lucciole|cristalli|braci|onde|scariche|raggi|riflessi))/.test(strato.classe)) {
                const trama = texturaAtmosfera(tinta, strato.classe, ambiente.variante);
                if (trama) el.style.setProperty('--fa-trama-organica', trama);
            }
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
            return { el: el, cfg: strato };
        });
    }

    function rimuoviElementi() {
        elementi.forEach(({ el }) => el.remove());
        elementi = [];
    }

    // =================================================================
    // Coreografia 'attraversa' — vento e sabbia
    // =================================================================

    /**
     * IL RESPIRO DELLA FOLATA, ed è questa la differenza fra "una
     * velatura che scorre" e "una folata di vento".
     *
     * Il vento vero non ha un'intensità sola: arriva a ondate, cala, torna
     * a spingere, poi si smorza. La prima versione di questo effetto
     * faceva salire l'opacità nel primo terzo e scendere nell'ultimo — una
     * sola campana — e il risultato si leggeva come un velo trascinato di
     * peso da un lato all'altro.
     *
     * Qui l'opacità viene costruita a più ondate dentro la stessa passata:
     * ognuna sale in fretta (il colpo di vento) e cala più piano (l'aria
     * che si posa), con picchi di altezza diversa fra loro, e l'ultima
     * chiude sempre a zero. Le ondate non sono mai identiche: la loro
     * altezza si sorteggia ogni volta.
     *
     * @param tl       la timeline della passata
     * @param el       lo strato
     * @param inizio   quando questo strato entra in scena (secondi)
     * @param durata   quanto dura la sua traversata (secondi)
     * @param picco    l'opacità massima raggiungibile
     * @param ondate   quante spinte distinte dentro la passata
     */
    function respiro(tl, el, inizio, durata, picco, ondate) {
        const quante = Math.max(1, ondate || 1);
        // Un po' di margine in coda: l'ultima ondata deve avere il tempo
        // di spegnersi PRIMA che lo strato esca di scena, altrimenti la
        // folata sembra tagliata via invece che dissolta.
        const finestra = durata * 0.92;
        const passo = finestra / quante;

        tl.set(el, { opacity: 0 }, inizio);
        for (let i = 0; i < quante; i++) {
            // La prima ondata è la più forte: è l'arrivo del vento. Le
            // successive rifiatano fra il 55% e il 100% di quella.
            const altezza = picco * (i === 0 ? 1 : fraDueNumeri(0.55, 1));
            const t = inizio + passo * i;
            // Salita rapida, discesa lenta: 35% del tempo per spingere,
            // 65% per posarsi. Invertire i due valori fa sembrare l'aria
            // "risucchiata" invece che soffiata.
            tl.to(el, { opacity: altezza, duration: passo * 0.35, ease: 'sine.out' }, t)
              .to(el, { opacity: i === quante - 1 ? 0 : altezza * 0.3, duration: passo * 0.65, ease: 'sine.inOut' }, t + passo * 0.35);
        }
    }

    /**
     * Una passata di vento (con o senza sabbia). Tutto ciò che la rende
     * diversa dalla precedente si sorteggia qui: il verso, l'inclinazione,
     * quanto è densa, quanto dura. Due passate identiche di fila sono il
     * modo più sicuro per far sembrare finto un effetto ambientale.
     */
    function attraversa(tl) {
        // Da destra o da sinistra. `verso` serve anche a inclinare la
        // deriva verticale nello stesso senso, altrimenti la sabbia
        // sembrerebbe soffiata da due venti diversi insieme.
        const verso = Math.random() < 0.5 ? 1 : -1;
        // Quanto "tira" questa folata: una passata leggera e una vera
        // tempesta usano gli stessi strati, cambia solo l'intensità.
        const forza = fraDueNumeri(0.55, 1);
        const ritmo = fraDueNumeri(0.82, 1.3);

        elementi.forEach(({ el, cfg }) => {
            // La corsa è tutta e sola l'ECCEDENZA dello strato rispetto
            // allo schermo (vedi la larghezza in field-ambience.css): così
            // il pattern scorre per intero da un bordo all'altro senza che
            // il suo margine entri mai nell'inquadratura, e la misura vive
            // in un posto solo — cambiare la larghezza nel CSS aggiorna
            // questa da sé, invece di lasciare due numeri da tenere
            // allineati a mano.
            const corsa = Math.max(0, el.offsetWidth - window.innerWidth);
            const partenza = verso > 0 ? -corsa : 0;
            const arrivo = verso > 0 ? 0 : -corsa;
            const durata = cfg.durata * ritmo;
            // Deriva verticale: il vento non viaggia mai perfettamente in
            // orizzontale. Poca per gli strati di fondo (lontani), di più
            // per quelli in primo piano, che così sembrano passare più
            // vicino all'osservatore.
            const salita = cfg.deriva * fraDueNumeri(0.6, 1.4) * (Math.random() < 0.5 ? 1 : -1);
            // `slancio` sceglie la curva del movimento. A 0 la velocità è
            // costante (aria alta, che scorre e basta); verso 1 lo strato
            // entra di slancio e si smorza, ed è così che si muove una
            // raffica al suolo. Interpolare fra i due easing non si può,
            // quindi si sceglie quello più vicino all'intenzione.
            const curva = (cfg.slancio || 0) > 0.6 ? 'power2.out'
                : (cfg.slancio || 0) > 0.15 ? 'power1.out'
                : 'none';

            gsap.set(el, { x: partenza, y: -salita / 2, opacity: 0 });
            // Tre segmenti con deviazioni diverse: anche gli strati che
            // attraversano il field smettono di seguire una retta perfetta.
            const scarto = salita * fraDueNumeri(.45, .9);
            tl.to(el, {
                x: partenza + (arrivo - partenza) * .34,
                y: salita / 2 + scarto,
                rotation: verso * fraDueNumeri(-1.4, 1.4),
                duration: durata * .3,
                ease: curva
            }, cfg.ritardo)
              .to(el, {
                  x: partenza + (arrivo - partenza) * .7,
                  y: -scarto * .55,
                  rotation: verso * fraDueNumeri(-.8, .8),
                  duration: durata * .38,
                  ease: 'sine.inOut'
              }, cfg.ritardo + durata * .3)
              .to(el, {
                  x: arrivo,
                  y: salita / 2,
                  rotation: 0,
                  duration: durata * .32,
                  ease: 'sine.out'
              }, cfg.ritardo + durata * .68);
            respiro(tl, el, cfg.ritardo, durata, cfg.quota * forza, cfg.ondate);
        });
    }

    /**
     * Corrente d'alta quota continua del Dirigibile. La direzione rimane
     * coerente (il mezzo avanza), ma ogni lastra curva a quote diverse e
     * una minoranza delle passate accelera e illumina le scie: sono i colpi
     * di vento forti richiesti, non un metronomo che alterna acceso/spento.
     */
    function ventoContinuo(tl) {
        const rafficaForte = Math.random() < .34;
        const forza = rafficaForte ? fraDueNumeri(.82, 1.08) : fraDueNumeri(.36, .58);
        const velocita = rafficaForte ? fraDueNumeri(.66, .84) : fraDueNumeri(.92, 1.18);

        elementi.forEach(({ el, cfg }, indice) => {
            const corsa = Math.max(0, el.offsetWidth - window.innerWidth);
            const durata = cfg.durata * velocita * fraDueNumeri(.92, 1.08);
            const deviazione = cfg.deriva * fraDueNumeri(.45, 1.15) * (Math.random() < .5 ? -1 : 1);
            const picco = cfg.quota * forza;
            gsap.set(el, { x: -corsa, y: -deviazione * .25, rotation: fraDueNumeri(-.7, .7), opacity: 0 });
            tl.to(el, { opacity: picco * .72, duration: .45, ease: 'sine.out' }, cfg.ritardo)
              .to(el, {
                  x: -corsa * .68, y: deviazione * .28,
                  rotation: fraDueNumeri(-1.1, 1.1), duration: durata * .3, ease: 'none'
              }, cfg.ritardo)
              .to(el, {
                  x: -corsa * .32, y: -deviazione * .18,
                  rotation: fraDueNumeri(-.65, .65), duration: durata * .38, ease: 'sine.inOut'
              }, cfg.ritardo + durata * .3)
              .to(el, {
                  x: 0, y: deviazione * .22, rotation: 0,
                  duration: durata * .32, ease: 'none'
              }, cfg.ritardo + durata * .68)
              .to(el, { opacity: 0, duration: .4, ease: 'sine.in' }, cfg.ritardo + durata - .4);

            // La raffica forte ha due spinte irregolari sovrapposte alla
            // corrente base; sugli altri cicli l'opacità resta più stabile.
            if (rafficaForte) {
                const t = cfg.ritardo + durata * fraDueNumeri(.2, .46);
                tl.to(el, { opacity: Math.min(1, picco), duration: .18, ease: 'power2.out' }, t)
                  .to(el, { opacity: picco * fraDueNumeri(.48, .68), duration: fraDueNumeri(.55, 1.1), ease: 'sine.out' }, t + .18);
            } else if (indice > 0) {
                tl.to(el, { opacity: picco * fraDueNumeri(.78, 1), duration: .9, ease: 'sine.inOut' }, cfg.ritardo + durata * .48);
            }
        });
    }

    // =================================================================
    // Coreografia 'scansione' — il campo olografico della KaibaCorp
    // =================================================================

    /**
     * Niente traversata: qui il campo stesso si rivela per un momento.
     * La griglia si accende dal basso, una lama di luce la percorre da
     * sotto a sopra leggendola, qualche blocco di dati lampeggia al suo
     * passaggio, poi tutto torna invisibile.
     *
     * È l'ologramma della macchina, non un fenomeno atmosferico: per
     * questo si muove a scatti netti e in verticale, mentre vento e
     * sabbia scorrono di lato e respirano.
     */
    function scansione(tl) {
        const durata = fraDueNumeri(2.4, 3.4);
        const verso = Math.random() < .5 ? 1 : -1;
        const inclinazione = fraDueNumeri(-1.6, 1.6);
        // Quanto deve percorrere la lama: l'altezza VERA della fascia, non
        // una percentuale ricopiata dal CSS. La si prende dalla griglia,
        // che è l'unico strato alto quanto tutta la fascia (la lama è
        // alta un ottavo, vedi .fa-tech-lama). Un primo tentativo usava
        // `yPercent` da 100 a -100, ma quella percentuale è relativa
        // all'altezza dell'ELEMENTO: la lama percorreva due volte se
        // stessa, cioè un quarto scarso del campo, e la scansione si
        // fermava a metà strada.
        const griglia = elementi.find((e) => e.cfg.ruolo === 'griglia');
        const fascia = (griglia && griglia.el.offsetHeight) || Math.round(window.innerHeight * 0.62);

        elementi.forEach(({ el, cfg }) => {
            if (cfg.ruolo === 'scintille') {
                gsap.set(el, { opacity: 1 });
                return;
            }
            if (cfg.ruolo === 'griglia') {
                // La griglia non scorre: si accende, resta, si spegne. Un
                // lieve scostamento verticale basta a non farla sembrare
                // un'immagine incollata sopra il campo.
                gsap.set(el, { opacity: 0, y: 10 });
                tl.to(el, { opacity: cfg.quota, y: 0, duration: 0.5, ease: 'power2.out' }, 0)
                  .to(el, { opacity: cfg.quota * 0.55, duration: durata * 0.6, ease: 'sine.inOut' }, 0.5)
                  .to(el, { opacity: 0, y: -8, duration: 0.6, ease: 'power2.in' }, durata + 0.3);
            } else if (cfg.ruolo === 'lama') {
                // Parte sotto il bordo inferiore della fascia ed esce da
                // quello superiore, percorrendola tutta. `el.offsetHeight`
                // è l'altezza della sola lama: serve a farla uscire di
                // scena per intero alle due estremità, invece di comparire
                // e sparire a metà.
                const alta = el.offsetHeight || 0;
                const giu = (fascia / 2 + alta) * verso;
                gsap.set(el, { opacity: 0, y: giu, rotation: inclinazione });
                tl.to(el, { opacity: cfg.quota, duration: 0.2 }, 0.35)
                  .to(el, { y: -giu, x: fraDueNumeri(-18, 18), duration: durata, ease: 'power1.inOut' }, 0.35)
                  .to(el, { opacity: 0, duration: 0.3 }, durata + 0.25);
            } else {
                // I blocchi dati: due lampi secchi mentre la lama passa,
                // a intensità diversa. Sono il "rumore" della lettura.
                gsap.set(el, { opacity: 0 });
                tl.to(el, { opacity: cfg.quota, duration: 0.12, ease: 'none' }, 0.8)
                  .to(el, { opacity: 0.08, duration: 0.3, ease: 'none' }, 0.95)
                  .to(el, { opacity: cfg.quota * 0.7, duration: 0.1, ease: 'none' }, durata * 0.72)
                  .to(el, { opacity: 0, duration: 0.5, ease: 'sine.in' }, durata * 0.82);
            }
        });
    }

    function industria(tl) {
        scansione(tl);
        const layer = elementi.find((voce) => voce.cfg.ruolo === 'scintille');
        if (!layer) return;
        const temporanei = [];
        const gruppi = 2 + Math.floor(Math.random() * 4);
        for (let gruppo = 0; gruppo < gruppi; gruppo++) {
            const centroX = fraDueNumeri(12, 88);
            const centroY = fraDueNumeri(14, 84);
            const quanti = 2 + Math.floor(Math.random() * 5);
            const base = fraDueNumeri(.15, 3.3);
            for (let i = 0; i < quanti; i++) {
                const scintilla = creaEventoGuerra('fa-industria-scintilla', layer.el,
                    centroX + fraDueNumeri(-4, 4), centroY + fraDueNumeri(-5, 5));
                scintilla.style.setProperty('--fa-spark-angle', fraDueNumeri(-75, 75) + 'deg');
                temporanei.push(scintilla);
                const t = base + i * fraDueNumeri(.035, .13);
                gsap.set(scintilla, { opacity: 0, scale: .2 });
                tl.to(scintilla, { opacity: fraDueNumeri(.65, 1), scale: fraDueNumeri(.7, 1.35), duration: .035 }, t)
                  .to(scintilla, { opacity: 0, scale: fraDueNumeri(1.2, 2), duration: fraDueNumeri(.09, .24) }, t + .035);
            }
        }
        tl.call(() => temporanei.forEach((el) => el.remove()), null, 4.2);
    }

    // Coreografia comune agli ambienti organici/energetici: ogni strato
    // nasce, attraversa lentamente la fascia e si dissolve. I parametri
    // vivono nel profilo, quindi acqua, neve, braci e glitch condividono
    // l'orchestrazione senza condividere l'aspetto o il movimento.
    function atmosfera(tl) {
        const intensita = fraDueNumeri(.72, 1);
        elementi.forEach(({ el, cfg }, indice) => {
            const durata = cfg.durata * fraDueNumeri(.9, 1.12);
            const dx = (cfg.dx || 0) * (Math.random() < .5 ? -1 : 1);
            const dy = cfg.dy || 0;
            const scala = cfg.scala || 0;
            const rotazione = (cfg.rotazione || 0) * (Math.random() < .5 ? -1 : 1);
            // Gli strati non entrano più ordinatamente uno dopo l'altro:
            // ciascuno ha il proprio attacco, e raramente l'accento più
            // vicino salta una passata intera lasciando respirare il field.
            const omettiAccento = indice > 0 && Math.random() < .16;
            const inizio = fraDueNumeri(0, Math.min(1.1, durata * .18));
            const deviazioneX = fraDueNumeri(-42, 42);
            const deviazioneY = fraDueNumeri(-36, 36);
            gsap.set(el, {
                opacity: 0, x: -dx / 2, y: -dy / 2,
                scale: 1 - scala / 2, rotation: -rotazione / 2,
                transformOrigin: `${fraDueNumeri(28,72)}% ${fraDueNumeri(28,72)}%`
            });
            if (omettiAccento) return;
            tl.to(el, { opacity: cfg.quota * intensita * fraDueNumeri(.78, 1), duration: durata * .2, ease: 'sine.out' }, inizio)
              .to(el, {
                  x: deviazioneX, y: deviazioneY,
                  scale: 1 + scala * .15, rotation: -rotazione * .35,
                  duration: durata * .3, ease: 'sine.out'
              }, inizio)
              .to(el, {
                  x: -deviazioneX * .45, y: dy * .18,
                  scale: 1 - scala * .12, rotation: rotazione * .55,
                  duration: durata * .34, ease: 'sine.inOut'
              }, inizio + durata * .3)
              .to(el, {
                  x: dx / 2, y: dy / 2,
                  scale: 1 + scala / 2, rotation: rotazione / 2,
                  duration: durata * .36, ease: 'sine.out'
              }, inizio + durata * .64)
              .to(el, { opacity: 0, duration: durata * .28, ease: 'sine.in' }, inizio + durata * .72);
        });
    }

    /** Lampi fotografici dagli spalti dello Stadio Kaiba. */
    function spalti(tl) {
        const flashLayer = elementi.find((voce) => voce.cfg.ruolo === 'flash');
        const glowLayer = elementi.find((voce) => voce.cfg.ruolo === 'bagliore');
        if (!flashLayer || !glowLayer) return;
        gsap.set([flashLayer.el, glowLayer.el], { opacity: 1 });
        const temporanei = [];
        const quanti = 6 + Math.floor(Math.random() * 6);

        for (let i = 0; i < quanti; i++) {
            const lampo = document.createElement('span');
            lampo.className = 'fa-spalti-flash';
            // Metà circa nasce dalla gradinata alta, il resto percorre i
            // due spalti laterali anche in basso. Mai nel centro del campo,
            // dove sembrerebbe un lampo originato dalle carte.
            // I primi tre garantiscono sempre sinistra, destra e gradinata
            // alta; gli altri rendono casuale il resto della composizione.
            const laterale = i < 2 || (i > 2 && Math.random() < .58);
            const latoSinistro = i === 0 || (i > 1 && Math.random() < .5);
            if (laterale) {
                lampo.dataset.zona = latoSinistro ? 'laterale-sinistro' : 'laterale-destro';
                lampo.style.left = fraDueNumeri(latoSinistro ? 3 : 84, latoSinistro ? 16 : 97) + '%';
                lampo.style.top = fraDueNumeri(12, 88) + '%';
            } else {
                lampo.dataset.zona = 'spalti-alti';
                lampo.style.left = fraDueNumeri(12, 88) + '%';
                lampo.style.top = fraDueNumeri(3, 25) + '%';
            }
            lampo.style.setProperty('--fa-flash-rot', fraDueNumeri(-24, 24) + 'deg');
            flashLayer.el.appendChild(lampo);
            temporanei.push(lampo);
            const t = fraDueNumeri(.12, 2.7);
            const scala = fraDueNumeri(.65, 1.45);
            gsap.set(lampo, { opacity: 0, scale: .15 });
            tl.to(lampo, { opacity: 1, scale: scala, duration: .055, ease: 'power4.out' }, t)
              .to(lampo, { opacity: .12, scale: scala * 1.8, duration: .18, ease: 'power2.out' }, t + .055)
              .to(lampo, { opacity: 0, scale: scala * 2.25, duration: .38, ease: 'sine.out' }, t + .235);
        }

        // Riflesso globale brevissimo sul campo: accompagna soltanto i
        // lampi più forti e non copre mai la leggibilità delle carte.
        const riflesso = document.createElement('span');
        riflesso.className = 'fa-spalti-riflesso';
        glowLayer.el.appendChild(riflesso);
        temporanei.push(riflesso);
        gsap.set(riflesso, { opacity: 0 });
        tl.to(riflesso, { opacity: .3, duration: .06 }, .7)
          .to(riflesso, { opacity: 0, duration: .34, ease: 'sine.out' }, .76)
          .to(riflesso, { opacity: .18, duration: .05 }, 2.05)
          .to(riflesso, { opacity: 0, duration: .28 }, 2.1)
          .call(() => temporanei.forEach((el) => el.remove()), null, 3.4);
    }

    function tempioOscuro(tl) {
        const trova = (ruolo) => {
            const voce = elementi.find((entry) => entry.cfg.ruolo === ruolo);
            return voce && voce.el;
        };
        const torce = trova('torce');
        const occhio = trova('occhio');
        const scintille = trova('scintille');
        if (!torce || !occhio || !scintille) return;
        gsap.set([torce, occhio, scintille], { opacity: 1 });
        const temporanei = [];

        // Coordinate volutamente perimetrali: corrispondono alle file di
        // bracieri dell'immagine e non invadono il tappeto centrale.
        const punti = [
            [7,18],[18,10],[34,8],[66,8],[82,10],[93,18],
            [8,48],[17,66],[32,88],[68,88],[83,66],[92,48]
        ];
        punti.forEach((p, indice) => {
            if (Math.random() < .28) return;
            const luce = creaEventoGuerra('fa-tempio-torcia', torce, p[0] + fraDueNumeri(-2,2), p[1] + fraDueNumeri(-2,2));
            temporanei.push(luce);
            const t = fraDueNumeri(0, 2.8);
            const forza = fraDueNumeri(.55, 1);
            gsap.set(luce, { opacity: .08, scale: .65 });
            tl.to(luce, { opacity: forza, scale: fraDueNumeri(.9,1.35), duration: .1 }, t)
              .to(luce, { opacity: forza * .28, scale: .8, duration: fraDueNumeri(.18,.42) }, t + .1)
              .to(luce, { opacity: forza * .75, scale: fraDueNumeri(.82,1.18), duration: .08 }, t + .5)
              .to(luce, { opacity: 0, duration: fraDueNumeri(.45,.85) }, t + .58);
        });

        const aura = creaEventoGuerra('fa-tempio-occhio', occhio, 50, 55);
        temporanei.push(aura);
        gsap.set(aura, { opacity: 0, scale: .72 });
        tl.to(aura, { opacity: .42, scale: 1.05, duration: 1.15, ease: 'sine.out' }, .35)
          .to(aura, { opacity: .14, scale: 1.28, duration: 1.7, ease: 'sine.inOut' }, 1.5)
          .to(aura, { opacity: 0, scale: 1.42, duration: 1.1, ease: 'sine.in' }, 3.2);

        const quanti = 5 + Math.floor(Math.random() * 8);
        for (let i = 0; i < quanti; i++) {
            const lato = Math.random() < .5;
            const scintilla = creaEventoGuerra('fa-tempio-scintilla', scintille,
                lato ? fraDueNumeri(6,31) : fraDueNumeri(69,94), fraDueNumeri(40,90));
            temporanei.push(scintilla);
            const t = fraDueNumeri(.15, 3.4);
            gsap.set(scintilla, { opacity: 0, x: 0, y: 0, scale: fraDueNumeri(.5,1.2) });
            tl.to(scintilla, { opacity: fraDueNumeri(.45,.9), duration: .12 }, t)
              .to(scintilla, { x: fraDueNumeri(-18,18), y: fraDueNumeri(-55,-105), opacity: 0, duration: fraDueNumeri(1.1,2.1), ease: 'sine.out' }, t + .12);
        }
        tl.call(() => temporanei.forEach((el) => el.remove()), null, 4.6);
    }

    function creaEventoGuerra(classe, contenitore, x, y) {
        const evento = document.createElement('div');
        evento.className = classe;
        evento.style.left = x + '%';
        evento.style.top = y + '%';
        evento.setAttribute('aria-hidden', 'true');
        contenitore.appendChild(evento);
        return evento;
    }

    /** Sequenza bellica localizzata nella fascia centrale del field. */
    function guerra(tl) {
        const perRuolo = (ruolo) => {
            const trovato = elementi.find((voce) => voce.cfg.ruolo === ruolo);
            return trovato && trovato.el;
        };
        const fumoLayer = perRuolo('fumo');
        const esplosioniLayer = perRuolo('esplosioni');
        const proiettiliLayer = perRuolo('proiettili');
        if (!fumoLayer || !esplosioniLayer || !proiettiliLayer) return;
        [fumoLayer, esplosioniLayer, proiettiliLayer].forEach((el) => gsap.set(el, { opacity: 1 }));

        const temporanei = [];
        const aggiungi = (el) => { temporanei.push(el); return el; };

        // Gas indipendente dal fuoco: ogni nube ha proprio ritardo, durata,
        // direzione e deriva. Può precedere i colpi o restare dopo di loro.
        const quantiFumogeni = 1 + Math.floor(Math.random() * 4);
        for (let i = 0; i < quantiFumogeni; i++) {
            const fumoSale = i === 0 ? Math.random() < .5 : !temporanei.some((el) =>
                el.classList.contains('fa-guerra-fumogeno') && el.dataset.direzione === 'basso-alto');
            const fumo = aggiungi(creaEventoGuerra('fa-guerra-fumogeno', fumoLayer,
                fraDueNumeri(25, 75), fumoSale ? fraDueNumeri(66, 78) : fraDueNumeri(22, 34)));
            fumo.dataset.direzione = fumoSale ? 'basso-alto' : 'alto-basso';
            fumo.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
            const versoFumo = fumoSale ? -1 : 1;
            const tFumo = fraDueNumeri(0, 4.2);
            const durataFumo = fraDueNumeri(3.8, 6.8);
            const scalaFumo = fraDueNumeri(1.25, 1.9);
            gsap.set(fumo, { opacity: 0, scale: .25, x: 0, y: -versoFumo * 18 });
            tl.to(fumo, { opacity: fraDueNumeri(.5, .82), scale: 1, y: versoFumo * 24, duration: 1.3, ease: 'power2.out' }, tFumo)
              .to(fumo, {
                  x: fraDueNumeri(-65, 65), y: versoFumo * fraDueNumeri(95, 165),
                  scale: scalaFumo, opacity: 0, duration: durataFumo, ease: 'sine.inOut'
              }, tFumo + 1.05);
        }

        // Due o tre impatti, sfalsati e mai alle estremità della mappa.
        const quantiImpatti = 1 + Math.floor(Math.pow(Math.random(), .78) * 5);
        for (let i = 0; i < quantiImpatti; i++) {
            const dalBasso = i % 2 === 0;
            const impatto = aggiungi(creaEventoGuerra('fa-guerra-esplosione', esplosioniLayer,
                fraDueNumeri(20, 80), fraDueNumeri(25, 76)));
            impatto.dataset.direzione = dalBasso ? 'basso-alto' : 'alto-basso';
            impatto.innerHTML = '<b class="fa-guerra-flash"></b><b class="fa-guerra-onda"></b>'
                + '<i></i><i></i><i></i><i></i><i></i><i></i>';
            const t = .5 + i * fraDueNumeri(.65, 1.05);
            const entrataY = dalBasso ? 74 : -74;
            gsap.set(impatto, { opacity: 0, scale: .12, y: entrataY, rotation: fraDueNumeri(-18, 18) });
            const ampiezza = fraDueNumeri(1.15, 1.85);
            tl.to(impatto, { opacity: .72, scale: .24, y: 0, duration: .18, ease: 'power3.in' }, t - .18)
              .to(impatto, { opacity: 1, scale: ampiezza, duration: .14, ease: 'power4.out' }, t)
              .to(impatto, { scale: ampiezza * 1.75, opacity: .72, duration: .55, ease: 'power2.out' }, t + .14)
              .to(impatto, {
                  y: dalBasso ? -68 : 68, scale: ampiezza * 2.35, opacity: 0,
                  duration: 1.65, ease: 'sine.out'
              }, t + .68);
        }

        // Lampi secchi indipendenti: artiglieria lontana o spari fuori
        // inquadratura, non necessariamente seguiti da un impatto visibile.
        const quantiFlash = 1 + Math.floor(Math.random() * 5);
        for (let i = 0; i < quantiFlash; i++) {
            const flash = aggiungi(creaEventoGuerra('fa-guerra-flash-fronte', esplosioniLayer,
                fraDueNumeri(18, 82), fraDueNumeri(16, 82)));
            const tFlash = fraDueNumeri(.1, 4.8);
            gsap.set(flash, { opacity: 0, scale: .15 });
            tl.to(flash, { opacity: fraDueNumeri(.65, 1), scale: fraDueNumeri(.7, 1.5), duration: .045 }, tFlash)
              .to(flash, { opacity: 0, scale: fraDueNumeri(1.8, 3), duration: fraDueNumeri(.16, .38) }, tFlash + .045);
        }

        // Raffiche dense ma non cadenzate: colpi isolati, piccoli grappoli
        // e pause vengono tutti estratti nello stesso intervallo temporale.
        const quantiColpi = 4 + Math.floor(Math.pow(Math.random(), .68) * 9);
        for (let i = 0; i < quantiColpi; i++) {
            const dalBasso = i === 0 || (i > 1 && Math.random() < .5);
            const proiettile = aggiungi(creaEventoGuerra('fa-guerra-proiettile', proiettiliLayer,
                fraDueNumeri(20, 80), dalBasso ? fraDueNumeri(76, 88) : fraDueNumeri(12, 24)));
            proiettile.dataset.direzione = dalBasso ? 'basso-alto' : 'alto-basso';
            const distanzaY = fraDueNumeri(270, 510) * (dalBasso ? -1 : 1);
            gsap.set(proiettile, {
                opacity: 0, x: 0, y: 0,
                rotation: dalBasso ? -90 : 90
            });
            const gruppo = Math.floor(i / (1 + Math.floor(fraDueNumeri(1, 4))));
            const t = fraDueNumeri(.12, 1.15) + gruppo * fraDueNumeri(.28, .9);
            const metaY = distanzaY * fraDueNumeri(.35, .62);
            const durataColpo = fraDueNumeri(.26, .56);
            tl.to(proiettile, { opacity: 1, duration: .04 }, t)
              .to(proiettile, {
                  x: 0, y: metaY,
                  duration: durataColpo * .46, ease: 'sine.in'
              }, t)
              .to(proiettile, {
                  x: 0, y: distanzaY,
                  duration: durataColpo * .54, ease: 'power2.in'
              }, t + durataColpo * .46)
              .to(proiettile, { opacity: fraDueNumeri(.35, .75), duration: .035 }, t + durataColpo * .3)
              .to(proiettile, { opacity: 1, duration: .035 }, t + durataColpo * .38)
              .to(proiettile, { opacity: 0, duration: .08 }, t + durataColpo);
        }

        tl.call(() => temporanei.forEach((el) => el.remove()), null, 8.4);
    }

    const COREOGRAFIE = {
        attraversa, ventoContinuo, scansione, atmosfera, guerra, spalti,
        tempioOscuro, industria
    };

    // =================================================================
    // La passata
    // =================================================================

    function raffica() {
        if (!ambienteAttivo || sospeso() || !window.gsap || !elementi.length) return;
        // Una passata alla volta. Senza questa guardia, una seconda
        // chiamata mentre la prima è a metà schermo rimette gli strati al
        // punto di partenza con opacità zero: la folata sparisce di colpo
        // e ricompare dall'altra parte (osservato campionando le opacità
        // nel tempo). Può succedere solo se qualcuno la invoca a mano,
        // ma è proprio quello che fanno le prove e le verifiche.
        if (timeline && timeline.isActive()) return;

        timeline = gsap.timeline({
            onComplete: () => {
                timeline = null;
                programmaProssima();
            }
        });

        const coreografia = COREOGRAFIE[ambienteAttivo.coreografia] || attraversa;
        coreografia(timeline);
    }

    function programmaProssima() {
        if (!ambienteAttivo || sospeso()) return;
        clearTimeout(prossima);
        const [min, max] = ambienteAttivo.pausa;
        let attesa;
        if (ambienteAttivo.ritmoCasuale === 'guerra') {
            // Distribuzione a tre stati, non un metronomo uniforme:
            // contrattacco rapido, pausa ordinaria o raro silenzio lungo.
            const sorte = Math.random();
            attesa = sorte < .34 ? fraDueNumeri(min, 3800)
                : sorte < .86 ? fraDueNumeri(4200, 9800)
                : fraDueNumeri(10500, max);
        } else if (ambienteAttivo.ritmoCasuale === 'vento-continuo') {
            attesa = fraDueNumeri(min, max);
        } else if (ambienteAttivo.coreografia === 'atmosfera') {
            // Ambienti organici a gruppi: a volte un secondo accento segue
            // presto il primo, più spesso arriva una pausa normale, e ogni
            // tanto il luogo rimane quieto a lungo. Nessun metronomo.
            const sorte = Math.random();
            attesa = sorte < .2 ? fraDueNumeri(1200, Math.max(1800, min * .45))
                : sorte < .86 ? fraDueNumeri(min, max * .76)
                : fraDueNumeri(max * .82, max * 1.32);
        } else {
            attesa = fraDueNumeri(min, max);
        }
        prossima = setTimeout(raffica, attesa);
    }

    // =================================================================
    // Accensione e spegnimento
    // =================================================================

    function ferma() {
        clearTimeout(prossima);
        prossima = null;
        if (timeline) { timeline.kill(); timeline = null; }
        if (window.AmbienteWebGL) AmbienteWebGL.ferma();
        rimuoviElementi();
        ambienteAttivo = null;
    }

    /**
     * Accende l'ambiente giusto per l'arena in corso, se ce n'è uno e se
     * le condizioni ci sono. Richiamabile più volte senza danni: se è già
     * acceso per la stessa arena non fa nulla.
     */
    function avvia(campoRichiesto) {
        const campo = campoRichiesto || campoCorrente();
        const ambiente = trovaAmbiente(campo);

        if (!ambiente || !dettagliAlti() || menoAnimazioni()) {
            ferma();
            return false;
        }
        const conWebgl = !!(ambiente.webgl && window.AmbienteWebGL);
        if (!conWebgl && !window.gsap) {
            ferma();
            return false;
        }
        if (ambienteAttivo === ambiente && (elementi.length || (conWebgl && AmbienteWebGL.attivo()))) return true;

        ferma();
        // Percorso WebGL: un canvas per piano, nessuna timeline GSAP. Se non
        // parte (niente WebGL, shader rifiutato) si cade negli strati DOM.
        if (conWebgl && AmbienteWebGL.avvia(ambiente.webgl)) {
            ambienteAttivo = ambiente;
            if (sospeso()) AmbienteWebGL.sospendi(true);
            return true;
        }
        if (!window.gsap) return false;
        ambienteAttivo = ambiente;
        creaElementi(ambiente, campo);
        // La prima passata non parte subito: si entra in duello e la scena
        // deve essere quella dell'arena, non un effetto che si presenta.
        // Breve però: se il giocatore ha acceso i Dettagli "Alti" apposta,
        // deve vedere entro pochi secondi che qualcosa è cambiato.
        clearTimeout(prossima);
        if (!sospeso()) {
            prossima = setTimeout(raffica, ambiente.ritmoCasuale === 'vento-continuo'
                ? 120 : fraDueNumeri(2500, 5000));
        }
        return true;
    }

    // A scheda nascosta non ha senso continuare: i timer di GSAP e il
    // nostro setTimeout terrebbero occupata la CPU (e la batteria) per
    // un'animazione che nessuno sta guardando.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) sospendi('documento-nascosto');
        else riprendi('documento-nascosto');
    });

    // Il menu salva normalmente la scelta prima di entrare nel duello,
    // ma questo rende il modulo davvero disaccoppiato: se l'impostazione
    // cambia mentre la pagina e' viva, Normali elimina subito DOM/timer e
    // Alti riavvia l'ambiente del field corrente.
    window.addEventListener('ygo:video-quality-change', (evento) => {
        if (evento.detail && evento.detail.livello === 'alti') avvia();
        else ferma();
    });

    window.FieldAmbience = {
        avvia: avvia,
        ferma: ferma,
        /** Fa partire una passata adesso, senza aspettare la pausa: serve alle prove e alle verifiche. */
        raffica: raffica,
        sospendi: sospendi,
        riprendi: riprendi,
        sospeso: sospeso,
        /** Quale ambiente è acceso ora (null se nessuno) — usata dalle verifiche automatiche. */
        attivo: () => (ambienteAttivo ? ambienteAttivo.nome : null),
        /** Esposto perché una prova possa elencare le arene coperte senza duplicarle a mano. */
        AMBIENTI: AMBIENTI
    };

    // gsap.min.js arriva DOPO l'evento 'load' (caricamento pigro): stesso
    // schema di attesa di js/ui/fx-gsap.js — qualche tentativo a
    // intervalli crescenti, poi si lascia perdere senza rumore.
    (function attendiGsap() {
        let tentativi = 0;
        function riprova() {
            if (window.gsap) { avvia(); return; }
            if (++tentativi > 12) return; // ~10s: se non è arrivata, non arriverà
            setTimeout(riprova, 200 * tentativi);
        }
        if (document.readyState === 'complete') riprova();
        else window.addEventListener('load', riprova, { once: true });
    })();
})();
