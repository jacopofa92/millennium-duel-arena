/**
 * story-dopo-duello.js — le conversazioni DOPO la vittoria di un duello della Storia.
 * =====================================================================
 * Un duello del catalogo (js/data/story-campaigns.js) ha un `dialogo` PRIMA di cominciare, ma finora vincere voleva
 * dire tornare alla mappa con una riga di testo ("Hai battuto Pegasus"). Qui sta il racconto di come va a finire,
 * una voce per ogni tappa, nella stessa forma delle battute del `dialogo`: { chi?, nome?, io?, testo }.
 *
 * - La chiave e' l'`id` della tappa; chi non ha una voce qui resta com'era (nessuna conversazione).
 * - Si mostra solo alla PRIMA vittoria (non quando si rigioca una tappa gia' superata) e prima della mappa.
 * - `io: true` e' il protagonista della tappa (Yugi, ma anche Joey, Kaiba...: lo decide la campagna o la tappa).
 * - Una tappa che nel catalogo ha un `dopo` proprio vince su questa voce.
 * - Dove subito dopo il duello c'e' una SCENA che racconta lo stesso momento (Kaiba sul parapetto, il tempo scaduto
 *   del videonastro) la voce qui manca di proposito: non va detto due volte.
 *
 * Le tappe in cui nell'anime vince l'altro (la storia le fa giocare dalla parte del vincitore) raccontano l'esito
 * VERO: chi perde nel canone qui parla da sconfitto.
 */
// eslint-disable-next-line no-unused-vars
const storyDopoDuello = {
    // ------------------------------------------------------------------ Prologo a Domino City
    'anime-1-allenamento-solomon': [
        { chi: 'solomonMuto', testo: 'Bravo, Yugi! Hai capito subito che un mostro coperto è già una piccola promessa. Il Puzzle ti ha scelto, ma sono le tue carte a dover credere in te.' },
        { io: true, testo: 'Grazie, nonno. Con te accanto, vincere o perdere fa molta meno paura.' },
        { chi: 'solomonMuto', testo: 'Allora vai dai tuoi amici. I veri duelli non aspettano mai.' }
    ],
    'anime-1-amichevole-joey': [
        { chi: 'joey', testo: 'Ahia! Mi hai fregato con un solo mostro coperto! Però ho capito come si fa, giuro che la prossima volta ti faccio sudare.' },
        { io: true, testo: 'Sei stato più bravo di quanto pensi, Joey. Se continui così diventi un duellante vero.' },
        { chi: 'joey', testo: 'Dici davvero? Allora la rivincita la voglio domani, prima di scuola!' }
    ],
    'anime-1-amichevole-tristan': [
        { chi: 'tristan', testo: 'Va bene, va bene: la combinazione semplice funziona. Ma al prossimo duello trovo una strategia tutta mia.' },
        { io: true, testo: 'Ti sei difeso meglio di quanto credi, Tristan. Il segreto è non avere fretta.' },
        { chi: 'tristan', testo: 'Lo so, lo so… dillo a Joey, che di fretta ne ha sempre troppa!' }
    ],
    'anime-1-amichevole-tea': [
        { chi: 'tea', testo: 'Hai vinto, ma le mie fate ti hanno fatto penare. Ammettilo!' },
        { io: true, testo: 'Lo ammetto, Téa. Nel tuo mazzo c’è la stessa amicizia che mettiamo noi in ogni duello.' },
        { chi: 'tea', testo: 'Ecco perché mi piace: non conta chi vince, conta se ci si diverte insieme.' }
    ],
    'anime-1-regionale-rex': [
        { chi: 'rex', testo: 'Impossibile! La mia forza bruta schiacciata da quattro insetti!' },
        { io: true, testo: 'Hai contato troppo sui muscoli, Rex. Un vero stratega prepara la trappola molto prima di mostrare le carte.' },
        { chi: 'rex', testo: 'Il titolo regionale è tuo, Underwood. Ma questa me la lego al dito.' },
        { io: true, testo: 'E io ti ricorderò come si perde. A Domino City tutti sapranno chi ha vinto.' }
    ],
    'anime-1-kaiba': [
        { chi: 'kaiba', testo: 'Cinque carte… tutte insieme nella stessa mano. Exodia il Proibito. Non è possibile.' },
        { io: true, testo: 'Le carte di mio nonno hanno risposto, Kaiba. Hai strappato un Drago Bianco, ma non il cuore di chi lo aveva.' },
        { chi: 'kaiba', testo: 'Hai vinto un duello, Yugi, non il mio orgoglio. Ricordati il mio nome: ci rivedremo.' }
    ],
    // anime-1-pegasus-video: manca di proposito, la scena "Tempo scaduto" racconta subito la fine del duello.

    // ------------------------------------------------------------------ Il Regno dei Duellanti
    'anime-2-weevil': [
        { chi: 'weevil', testo: 'No! La foresta, i miei insetti, il mio mazzo… eppure hai vinto tu.' },
        { io: true, testo: 'Hai buttato le mie carte in mare, Weevil. Con quelle che mi restavano ho dimostrato che servono cuore e fiducia, non trucchi.' },
        { chi: 'weevil', testo: 'Tieniti le tue Stelle e vattene. Ma attento: Rex e gli altri non sono gentili come me.' }
    ],
    'anime-2-mai-primo': [
        { chi: 'mai', testo: 'Non posso aver perso contro un principiante. Eppure il tuo mazzo ascolta te più di quanto io ascolti il mio.' },
        { io: true, testo: 'Non sono più un principiante, Mai. Sto imparando dalle persone migliori.' },
        { chi: 'mai', testo: 'Tieniti le Stelle, Wheeler. Ma al prossimo incontro non ti farò sconti.' }
    ],
    'anime-2-rex': [
        { chi: 'rex', testo: 'Il mio Drago Nero Occhi Rossi… te l’avevo detto che non lo avresti mai visto dalla tua parte del campo.' },
        { io: true, testo: 'L’hai perso lealmente, Rex. Lo tratterò come merita: serve a salvare mia sorella.' },
        { chi: 'rex', testo: 'Allora trattalo bene, Wheeler. E vai da quella ragazza, prima che sia troppo tardi.' }
    ],
    'anime-2-mako': [
        { chi: 'mako', testo: 'La marea si è ritirata… hai attraversato il mio mare, Yugi. Non posso che inchinarmi.' },
        { io: true, testo: 'Non ero venuto a portarti via il mare, Mako. Cercavo la strada per riprendermi mio nonno.' },
        { chi: 'mako', testo: 'Allora vai, e porta con te le Stelle. Che il vento ti accompagni fino al castello.' }
    ],
    'anime-2-bonz': [
        { chi: 'bonz', testo: 'Gli zombie non tornano più? Keith ci aveva promesso la vittoria!' },
        { io: true, testo: 'Keith vi ha mentito, e voi gli avete creduto. Ora levatevi dalla mia strada.' },
        { chi: 'bonz', testo: 'Le Stelle sono tue, ragazzo. Ma Keith non ci perdonerà mai di averti lasciato passare.' }
    ],
    'anime-2-panik': [
        { chi: 'panik', testo: 'Le luci! Accendete le luci! Senza il buio non sono nient’altro che un uomo spaventato.' },
        { io: true, testo: 'Ti sei nascosto nel buio per far credere agli altri di non avere vie d’uscita. Restituisci le Stelle di Mai.' },
        { chi: 'panik', testo: 'Prendile, prendile e vattene via!' }
    ],
    'anime-2-mai-panik': [
        { chi: 'mai', testo: 'Non vedo neppure le mie carte… Prenditi pure le Stelle, ma ricorda: la luce prima o poi torna.' },
        { io: true, testo: 'La paura è il mio gioco, Mai. Nel buio vinco io, ed è l’unica cosa che so fare.' }
    ],
    'anime-2-kaiba-joey': [
        { chi: 'joey', testo: 'Dannazione! Il mio Drago Nero era a un passo dalla vittoria!' },
        { io: true, testo: 'Un passo non basta, Wheeler. Prendo le tue Stelle e proseguo.' },
        { chi: 'joey', testo: 'Un giorno ti batterò, Kaiba. Segnatelo da qualche parte!' },
        { io: true, testo: 'Fallo pure, se ne sarai capace.' }
    ],
    'anime-2-bakura-isola': [
        { chi: 'bakura', testo: 'L’Anello… la luce del Puzzle spezza le mie catene.' },
        { io: true, testo: 'Le anime dei miei amici tornano libere, Bakura. Il tuo Gioco delle Ombre è finito.' },
        { chi: 'bakura', testo: 'Per ora. Il potere dell’Anello non dimentica, Faraone.' },
        { io: true, testo: 'E io non dimentico chi lo ha usato.' }
    ],
    'anime-2-falso-kaiba': [
        { nome: 'Mokuba Kaiba', testo: 'È sparito! Il falso Seto è sparito! Yugi, ce l’hai fatta!' },
        { io: true, testo: 'Non era Kaiba, Mokuba. Gli mancava l’orgoglio che lo rende davvero lui.' },
        { nome: 'Mokuba Kaiba', testo: 'Mio fratello ha ancora bisogno di te. Corriamo al castello!' }
    ],
    'anime-2-paradox': [
        { chi: 'paradoxBrothers', testo: 'Le due porte… eppure siete passati insieme. Non è possibile.' },
        { io: true, testo: 'Joey ed io non abbiamo cercato la strada, l’abbiamo costruita mettendo in comune i nostri mostri.' },
        { chi: 'joey', testo: 'E ci siamo anche divertiti, Yugi!' },
        { chi: 'paradoxBrothers', testo: 'Prendete le Stelle. Il castello vi aspetta, ma Pegasus non si batte con un labirinto.' }
    ],
    // anime-2-kaiba: manca di proposito, la scena "Sul parapetto" racconta subito come finisce.
    'anime-2-tea-mai': [
        { chi: 'mai', testo: 'Una ragazza senza Stelle che batte le mie Lady Arpia? Mi hai sorpresa, Téa.' },
        { io: true, testo: 'Non lo facevo per me, Mai. Yugi merita di arrivare in fondo.' },
        { chi: 'mai', testo: 'Allora prendile. E digli che da quella semifinale ci sarò anch’io.' }
    ],
    'anime-2-kaiba-pegasus': [
        { chi: 'kaiba', testo: 'Come… come fai a conoscere ogni mia mossa? Questo… non è un duello.' },
        { io: true, testo: 'L’Occhio del Millennio non ha segreti per me, Kaiba-boy. Mokuba e la KaibaCorp saranno miei.' },
        { chi: 'kaiba', testo: 'Mokuba… Mokuba, perdonami…' },
        { io: true, testo: 'Dormi, ragazzo. L’anima di un duellante sconfitto vale più di cento mazzi.' }
    ],
    'anime-2c-mai': [
        { chi: 'mai', testo: 'Ti sei battuto con tutto quello che avevi. È così che si vince una semifinale.' },
        { io: true, testo: 'Anche tu, Mai. Se non fosse stato per le tue Lady Arpia, non sarei qui.' },
        { chi: 'mai', testo: 'Vai in finale, Yugi. E fammi vedere che Pegasus non è invincibile.' }
    ],
    'anime-2c-keith': [
        { chi: 'bandit_keith', testo: 'Impossibile! Ho giocato di astuzia, di soldi, di bugie… e perdo contro un ragazzino?' },
        { io: true, testo: 'Non conta chi bara meglio, Keith. Conta chi crede nel proprio mazzo.' },
        { chi: 'bandit_keith', testo: 'Fatti furbo, Wheeler: il mio padrone non perdona i perdenti.' }
    ],
    'anime-2c-joey': [
        { chi: 'joey', testo: 'Ce l’ho messa tutta, Yugi. Ma sei stato più bravo di me, e va bene così.' },
        { io: true, testo: 'Sei cresciuto tantissimo, Joey. Ho sentito il tuo cuore dietro ogni carta.' },
        { chi: 'joey', testo: 'Adesso vai da Pegasus. E se lo batti, io faccio il tifo da dietro il vetro!' }
    ],
    'anime-2-pegasus': [
        { chi: 'pegasus', testo: 'Il mio Occhio non ha visto… questa mossa. Come è possibile? Le vostre menti, insieme, sono più forti di tutto ciò che ho letto.' },
        { io: true, testo: 'Non siamo soli, Pegasus. Nonno, Mokuba e Kaiba sono tornati liberi: restituiscici le loro anime.' },
        { chi: 'pegasus', testo: 'Era soltanto un gioco, Yugi-boy… un gioco per riavere Cecilia. Ma hai vinto. Le anime tornano a casa.' },
        { io: true, testo: 'Spero che tu possa riabbracciarla davvero, Pegasus. Con le carte non si compra l’amore.' },
        { chi: 'pegasus', testo: 'Forse hai ragione. E ora vai: questo castello non ha più niente da dirti.' }
    ],

    // ------------------------------------------------------------------ Battle City - Parte 1
    'anime-3-seeker': [
        { chi: 'seeker', testo: 'Le mie carte… sono state battute da un ragazzino! Il mio padrone non lo accetterà.' },
        { io: true, testo: 'Le carte contraffatte non fanno di te un duellante, Seeker. Libera il Drago di Joey.' },
        { chi: 'seeker', testo: 'Prendilo. Ma non finisce qui: Marik ha altri uomini.' }
    ],
    'anime-3-joey-seeker': [
        { chi: 'joey', testo: 'Il mio Drago Nero Occhi Rossi! No, ridammelo!' },
        { io: true, testo: 'Le tue grida non cambiano le regole, ragazzino. Il Drago Nero Occhi Rossi è mio.' },
        { chi: 'joey', testo: 'Non finisce qui, Cacciatore. Me lo riprenderò, a costo di inseguirti per tutta la città!' }
    ],
    'anime-3-espa': [
        { chi: 'espaRoba', testo: 'Non… non ho visto questa mossa. Come puoi sapere cosa penso?' },
        { io: true, testo: 'Non lo so, Espa. So solo che le mie carte sono più veloci dei tuoi fratelli sui tetti.' },
        { chi: 'espaRoba', testo: 'Hai vinto. Tieniti la Carta Localizzatrice e smettila di guardarmi così.' }
    ],
    'anime-3-mako-joey': [
        { chi: 'mako', testo: 'Il mare non mi ha aiutato questa volta. Hai combattuto con tutto il cuore, Joey.' },
        { io: true, testo: 'Hai giocato duro, Mako. Spero che tu ritrovi presto tuo padre.' },
        { chi: 'mako', testo: 'Grazie. Prenditi la mia Carta Localizzatrice: te la sei guadagnata sul campo.' }
    ],
    'anime-3-arkana': [
        { chi: 'arkana', testo: 'Il mio Mago Nero… sconfitto. Marik mi aveva promesso Catherine in cambio della vittoria.' },
        { io: true, testo: 'Marik ti ha ingannato, Arkana. E tu hai maltrattato le tue carte come se fossero oggetti.' },
        { chi: 'arkana', testo: 'Forse hai ragione. Ma ora che ho perso tutto… che cosa mi resta?' },
        { io: true, testo: 'Le carte ti hanno aspettato per anni. Comincia da quelle.' }
    ],
    'anime-3-joey-weevil': [
        { chi: 'weevil', testo: 'Impossibile! Il mio Exodia… cioè, quello di Yugi, buttato in mare! Non doveva andare così!' },
        { io: true, testo: 'Quella sulla nave te la dovevo, Weevil. Ora siamo pari.' },
        { chi: 'weevil', testo: 'Pari? Neanche per sogno! Ti farò pentire di questa vittoria!' },
        { io: true, testo: 'Fai pure. Intanto la tua Carta Localizzatrice è mia.' }
    ],
    'anime-3-strings': [
        { chi: 'strings', testo: '…' },
        { chi: 'marik', testo: 'Questo burattino ha perso, ma il Faraone non ha ancora visto il vero potere degli Dei.' },
        { io: true, testo: 'Puoi controllare il corpo di chiunque, Marik, ma non il cuore delle mie carte. Ti fermerò.' }
    ],
    'anime-3-lumis': [
        { chi: 'lumis', testo: 'Sconfitti da due ragazzi sul nostro stesso tetto. La Maschera della Luce non ha retto.' },
        { chi: 'umbra', testo: 'Le tenebre… si sono ritirate. Voi due avete combattuto come un solo duellante.' },
        { chi: 'kaiba', testo: 'Non montarti la testa, Yugi. Li ho battuti perché mi hanno sfidato, non per aiutarti.' },
        { io: true, testo: 'Lo so, Kaiba. Ma insieme siamo stati più forti, e per oggi mi basta.' }
    ],
    'anime-3-joey-controllato': [
        { chi: 'marik', testo: 'Hai vinto, Faraone. Ma Joey non ricorderà niente di questa notte.' },
        { io: true, testo: 'Joey, svegliati! Sono io, Yugi! Ho usato il duello per liberarti, non per farti del male!' },
        { chi: 'joey', testo: 'Yugi? Mi gira la testa… che cosa è successo? E chi ha vinto?' },
        { io: true, testo: 'Abbiamo vinto tutti e due. Un’amicizia come la nostra non si spezza con nessun controllo mentale.' }
    ],
    'anime-3-bakura': [
        { chi: 'bakura', testo: 'La Tavola del Destino… infranta. Come hai fatto a leggere ogni lettera prima che si completasse?' },
        { io: true, testo: 'Non ho letto niente. Ho solo creduto che i miei amici non mi avrebbero lasciato solo.' },
        { chi: 'bakura', testo: 'Per ora, Faraone. L’Anello ti aspetta ancora, nel luogo in cui nessuna carta può proteggerti.' }
    ],
    'anime-3-bakura-bonz': [
        { chi: 'bonz', testo: 'Tre Carte Localizzatrici… e ora non le ho più. Chi sei, davvero?' },
        { io: true, testo: 'Non importa chi sono. Mi interessava soltanto una cosa: ora è mia.' },
        { chi: 'bonz', testo: 'Dannazione… quel ghigno mi gelerà il sangue per tutta la notte.' }
    ],
    'anime-3-bakura-marik': [
        { chi: 'bakura', testo: 'La tua parte debole si è alleata con te e ti ha donato Ra… ma non basta a battere uno spirito come me.' },
        { io: true, testo: 'Hai perso, Bakura. Ra è il mio dio, e Marik è mio da ora in poi.' },
        { chi: 'bakura', testo: 'Il tuo gioco è ancora lungo, Yami. Sceglierò il momento giusto per riprendermi quello che è mio.' }
    ],
    'anime-3-ishizu': [
        { chi: 'ishizu', testo: 'La Collana mi aveva mostrato la fine con chiarezza. Eppure tu l’hai riscritta.' },
        { io: true, testo: 'Non accetto un futuro scelto da una reliquia, Ishizu. Una visione vale tanto quanto la mano che gioca.' },
        { chi: 'ishizu', testo: 'Forse è questo che il Faraone aveva bisogno di vedere in te. Tieni Obelisk: hai dimostrato di meritarlo.' }
    ],
    'anime-3-odion': [
        { chi: 'odion', testo: 'Ho combattuto per il vero Marik con tutto ciò che avevo. Ma la tua determinazione era più forte.' },
        { io: true, testo: 'Ho visto la tua lealtà, Odion. Chi sei davvero e che cosa nascondi?' },
        { chi: 'odion', testo: 'Lo scoprirai molto presto. Ma sappi che non ho mai voluto fare del male a nessuno.' }
    ],
    'anime-3-mai-marik': [
        { chi: 'mai', testo: 'Non sono arrivata alle finali per essere una comparsa… eppure ho perso. Che cosa mi hai fatto?' },
        { io: true, testo: 'Ogni mostro che hai perso ti ha tolto un ricordo, Mai. Era il mio Gioco delle Ombre.' },
        { chi: 'mai', testo: 'Yugi… dove sei… Yugi…' }
    ],

    // ------------------------------------------------------------------ Mondo Virtuale
    'anime-6-gansley': [
        { chi: 'gansley', testo: 'Il mio Guerriero… sconfitto da un ragazzino. Il mondo virtuale non mi ha protetto.' },
        { io: true, testo: 'Le vostre regole tenevano prigioniere le anime dei miei amici, Gansley. Le ho imparate e le ho usate contro di voi.' },
        { chi: 'gansley', testo: 'Il tuo coraggio è più grande del tuo Deck Master. Passa pure: i miei colleghi non saranno altrettanto gentili.' }
    ],
    'anime-6-johnson': [
        { chi: 'johnson', testo: 'Giudice, giuria e duellante… e ho comunque perso. La mia roulette non mi ha salvato.' },
        { io: true, testo: 'La fortuna truccata non ha mai vinto contro un amico che ti sta accanto, Johnson.' },
        { chi: 'johnson', testo: 'Il verdetto è tuo, ragazzo. Prendi i tuoi amici e vai, prima che cambi idea.' }
    ],
    'anime-6-nesbitt': [
        { chi: 'nesbitt', testo: 'Una ragazzina e uno spadaccino contro di me? Impossibile… Il tuo Deck è più forte di quello che pensavo.' },
        { io: true, testo: 'Mio fratello non si arrende mai, e io sono sua sorella. Ho solo fatto il mio dovere.' },
        { chi: 'duke', testo: 'Ho visto ogni mossa, Serenity. Sei stata magnifica!' },
        { chi: 'nesbitt', testo: 'Prendete pure la strada. Ma Tristan… è ancora laggiù, da qualche parte.' }
    ],
    'anime-6-crump': [
        { chi: 'crump', testo: 'I miei pinguini! Il mio regno di ghiaccio si è sciolto in un attimo!' },
        { io: true, testo: 'Hai riso del mio mazzo, Crump. Ma il Mago Oscuro non scherza.' },
        { chi: 'crump', testo: 'Va bene, va bene! Hai vinto, ma smettila di fissarmi con quegli occhi.' }
    ],
    'anime-6-lector': [
        { chi: 'lector', testo: 'Il mio Jinzo… annullato da chi avevo licenziato. Sei davvero spietato, Kaiba.' },
        { io: true, testo: 'Vi ho licenziati perché avete tradito la KaibaCorp. Ora cancello anche l’ultima traccia del vostro dominio.' },
        { chi: 'lector', testo: 'Allora il nostro tempo è finito. Facci uscire da qui, Kaiba.' }
    ],
    'anime-6-cinque-uniti': [
        { chi: 'gansley', testo: 'Cinque teste e ancora non basta. Separati abbiamo perso, uniti abbiamo perso.' },
        { chi: 'joey', testo: 'Vuol dire che due amici valgono più di cinque dirigenti, no?' },
        { io: true, testo: 'Vuol dire che la forza di un duellante non sta nel numero delle teste, ma in chi gli sta accanto.' },
        { chi: 'gansley', testo: 'Il Drago a Cinque Teste si dissolve. Vi lasciamo passare.' }
    ],
    'anime-6-noah': [
        { chi: 'noah', testo: 'Perché? Avevo tutto: la KaibaCorp, un mondo intero, il potere di mio padre… e tu lo hai distrutto.' },
        { io: true, testo: 'Non volevo distruggerti, Noah. Volevo liberare Kaiba, Mokuba e gli altri.' },
        { chi: 'noah', testo: 'Allora liberali. Io ho trascorso troppo tempo da solo per capire che cosa vale una partita.' }
    ],
    'anime-6-kaiba-noah': [
        { chi: 'kaiba', testo: 'Non sei mio fratello e non sei il mio successore. Libera Mokuba, regola il conto con me.' },
        { io: true, testo: 'Ho vinto io, Seto. Mokuba è nelle mie mani, e finché lo sarà non potrai fare altro che guardare.' },
        { chi: 'kaiba', testo: 'Maledetto… questa non è la fine.' }
    ],
    'anime-6-kaiba-gozaburo': [
        { chi: 'gozaburo', testo: 'Mi hai battuto con le mie stesse lezioni, Seto. Eccellente.' },
        { io: true, testo: 'Mi hai insegnato a vincere, Gozaburo. E questa è stata l’ultima lezione che mi serviva.' },
        { chi: 'gozaburo', testo: 'Sei il vero erede della KaibaCorp. Non sprecare questo potere come ho fatto io.' }
    ],

    // ------------------------------------------------------------------ Battle City - Parte 2
    'anime-4b-battaglia-reale': [
        { chi: 'marik', testo: 'Quattro duellanti, un solo campo, e nessuno cade? Anche Ra ha visto troppo e mostra i suoi limiti.' },
        { chi: 'kaiba', testo: 'Il torneo non è ancora finito, Marik. Stanotte abbiamo solo scelto chi resta in piedi.' },
        { io: true, testo: 'E continueremo fino a quando Ra non smetterà di consumare i ricordi di chi ci sta accanto.' }
    ],
    'anime-4-joey': [
        { chi: 'joey', testo: 'Non… non riesco ad alzarmi. Ho combattuto fino all’ultimo, ma il suo dio è troppo forte.' },
        { io: true, testo: 'Hai resistito più di quanto chiunque potesse sperare, Joey. Ogni mostro distrutto ti ha fatto soffrire, e non hai mollato.' },
        { chi: 'joey', testo: 'Yugi… promettimi di battere Marik. Per me, per Mai, per tutti quelli che ha ferito.' }
    ],
    'anime-4-kaiba': [
        { chi: 'kaiba', testo: 'Obelisk e Slifer… la tavola mostrava anche questo? Maledetto destino.' },
        { io: true, testo: 'Non è il destino che ha deciso, Kaiba. Sono state le nostre scelte, mano dopo mano.' },
        { chi: 'kaiba', testo: 'Tieniti il tuo Slifer. Alla prossima occasione non mi farò battere da nessuno, nemmeno dagli Dei.' }
    ],
    'anime-4b-terzo-posto': [
        { chi: 'joey', testo: 'Mi sono appena svegliato e mi fa male tutto, ma questo duello non me lo toglieva nessuno. Ho perso, ma l’ho giocato.' },
        { io: true, testo: 'Il terzo posto non mi interessa, Wheeler. Ma è giusto che chi ha combattuto fino alla fine abbia il rispetto che merita.' },
        { chi: 'joey', testo: 'Wow. Da te, Kaiba, è quasi un complimento.' }
    ],
    'anime-4-marik': [
        { chi: 'marik', testo: 'Ra… Ra mi ha abbandonato! Com’è possibile che un dio sconfitto da un ragazzo?' },
        { io: true, testo: 'Non l’ho battuto da solo, Marik. Ho combattuto per Joey, per Mai e per il vero te che avevi imprigionato.' },
        { chi: 'odion', testo: 'È finita, fratello. Il peso che portavi è caduto: puoi respirare di nuovo.' },
        { chi: 'marik', testo: 'Il buio… se ne va. Forse non sono stato io a scegliere di restare qui dentro per tanto tempo.' }
    ],

    // ------------------------------------------------------------------ Il Mondo dei Ricordi
    'anime-9-kaiba-bakura': [
        { chi: 'bakura', testo: 'Il tuo Drago Bianco ha retto a Diabound. Non ero preparato a tanto orgoglio.' },
        { io: true, testo: 'Nessuno umilia Seto Kaiba due volte, ladro. Ricordatelo anche tra mille anni.' },
        { chi: 'bakura', testo: 'Lo ricorderò, sacerdote. E ricorderò anche te, Faraone, quando il momento verrà.' }
    ],
    'anime-9-bakura': [
        { chi: 'bakura', testo: 'Diabound ha copiato il potere del Drago Bianco… e anche Obelisk lo ha respinto. Questo non è giusto.' },
        { io: true, testo: 'Questo palazzo e il mio popolo non saranno le pedine della tua vendetta. Il tuo tempo è finito.' },
        { chi: 'bakura', testo: 'Finito? Il regno delle ombre non muore, Faraone. Ci rivedremo quando i tuoi ricordi saranno completi.' }
    ],
    'anime-9-seto-bakura': [
        { chi: 'priestSeto', testo: 'La volontà di Aknadin non basta più… sento il mio spirito tornare mio.' },
        { io: true, testo: 'Kisara ti ha affidato il proprio spirito, Seto. Non lasciare che una mano estranea la usi contro di te.' },
        { chi: 'priestSeto', testo: 'Faraone… perdonami. Ho quasi distrutto ciò che giurai di proteggere.' }
    ],
    'anime-9-zorc': [
        { chi: 'bakura', testo: 'Il Deck finito, i simboli in fuga… com’è possibile? Zorc doveva vincere.' },
        { io: true, testo: 'Atem mi ha insegnato a credere nelle mie carte, e a non nascondermi dietro di lui. Ora tocca a me.' },
        { chi: 'bakura', testo: 'Il tuo coraggio è reale, Yugi Muto. Vai a riprendere il tuo amico.' }
    ],
    'anime-5-yamiyugi': [
        { chi: 'yamiYugi', testo: 'Hai vinto, Yugi. Non mi hai trattenuto, non mi hai chiesto di perdere: mi hai battuto lealmente.' },
        { io: true, testo: 'Mi sei sempre stato accanto, Atem. Non avrei potuto onorarti in modo diverso.' },
        { chi: 'yamiYugi', testo: 'La porta dell’aldilà si apre per me, ma il tuo cuore resta ovunque tu vada. Grazie, amico mio.' },
        { io: true, testo: 'Grazie a te. Ci rivedremo, Atem, nel luogo in cui nessun duello finisce mai davvero.' }
    ],

    // ================================================================== MEMORIE PROIBITE (forbiddenMemories)
    // Mancano di proposito: fm-2-heishin (la scena "Il sigillo" racconta come finisce), fm-3t-kaiba ("Sette su sette"),
    // fm-6-heishin (il duello dopo si apre sulle parole di Seto), fm-6-seto ("L'inganno di Heishin"), fm-7-darknite ("La vera
    // forma") e fm-7-finale-duello ("Il nuovo Faraone"): subito dopo c'e' gia' una scena o un altro duello che lo racconta.

    // ---------------------------------------------------------------- Il Regno del Principe
    'fm-1-simon': [
        { chi: 'simonMuran', testo: 'Hai vinto, principe. E hai vinto quasi come se ti stessi giocando la regola seconda.' },
        { io: true, testo: 'Fuori da questa stanza non sarà altrettanto facile, lo so. Per questo mi alleno con te.' },
        { chi: 'simonMuran', testo: 'Allora continuiamo domani. E la prossima volta, per cortesia, esci dal portone e non dal muro del giardino.' }
    ],
    'fm-1-teana': [
        { chi: 'teana', testo: 'Non ti sei trattenuto, hai ragione. Ti ho battuto in una sola cosa: nel chiacchierare.' },
        { io: true, testo: 'Hai giocato bene, Teana. Peccato che il mantello non c’entrasse niente.' },
        { chi: 'teana', testo: 'Ti sei guadagnato un posto nell’arena. Ma non montarti la testa: Jono ti aspetta e lui non fa sconti.' }
    ],
    'fm-1-jono': [
        { chi: 'jono', testo: 'Ahah! Ho perso e non mi dispiace nemmeno! Ti sei meritato la festa, ragazzo.' },
        { io: true, testo: 'Allora portami a vedere i duelli dei sacerdoti, come promesso.' },
        { chi: 'jono', testo: 'Promessa è promessa. Ma stai lontano dai sacerdoti più alti: quello con la faccia sempre seria non perdona nulla.' }
    ],
    'fm-1-seto-festa': [
        { chi: 'priestSeto', testo: 'Hmph. Hai vinto. O forse ti ho lasciato vincere: non ho ancora deciso quale delle due.' },
        { io: true, testo: 'Qualunque sia la risposta, Jono resta sotto la mia protezione.' },
        { chi: 'priestSeto', testo: 'Ricorda la mia faccia, ragazzino. Quando ci rivedremo, non avrò più voglia di scherzare.' }
    ],

    // ---------------------------------------------------------------- Cinquemila anni dopo (il torneo di Kaiba)
    'fm-3t-rex': [
        { chi: 'rex', testo: 'Non ci credo… i miei dinosauri schiacciati da un nanerottolo col ciondolo. Mi sa che il nanerottolo ha qualcosa dentro.' },
        { io: true, testo: 'Hai giocato forte, Rex. Mi aspettano altri tre preliminari.' },
        { chi: 'rex', testo: 'Allora fai attenzione: dopo di me non sono tutti simpatici come i dinosauri.' }
    ],
    'fm-3t-weevil': [
        { chi: 'weevil', testo: 'I miei insetti… mangiati da un moccioso! Impossibile!' },
        { io: true, testo: 'Te l’avevo detto di masticare piano.' },
        { chi: 'weevil', testo: 'Vai avanti, vai avanti. Ti aspetta qualcuno che non ride dei trucchetti.' }
    ],
    'fm-3t-mai': [
        { chi: 'mai', testo: 'Hai chiamato "debito" quello che ti pesa addosso. Sei più strano di quanto pensassi, tesoro.' },
        { io: true, testo: 'Non l’ho capito del tutto nemmeno io. Ma ora so che devo estinguerlo.' },
        { chi: 'mai', testo: 'Allora vai avanti. E se un giorno lo capisci, vieni a dirmelo.' }
    ],
    'fm-3t-keith': [
        { chi: 'bandit_keith', testo: 'Ho giocato sporco fino all’ultimo e non è servito. Maledetto ragazzino.' },
        { io: true, testo: 'La regola numero uno, Keith: arrivare in fondo conta, ma conta anche come ci si arriva.' },
        { chi: 'bandit_keith', testo: 'Fatti da parte, tu sei dentro. Le finali non sono più un gioco da ragazzi.' }
    ],
    'fm-3t-shadi': [
        { chi: 'shadi', testo: 'La Bilancia ha pesato il tuo cuore e non è crollata. Hai dentro qualcosa da aprire, come speravo.' },
        { io: true, testo: 'Prendo la Chiave e la Bilancia. Ma non so ancora che cosa dovrò aprire.' },
        { chi: 'shadi', testo: 'Lo scoprirai strada facendo. Gli altri tre Oggetti sono nelle mani dei prossimi finalisti: ognuno ti chiederà qualcosa di diverso.' }
    ],
    'fm-3t-bakura': [
        { chi: 'bakura', testo: 'Il Puzzle ha risposto al posto tuo. L’Anello non sbaglia mai direzione… ma questa volta ha trovato più di quanto cercasse.' },
        { io: true, testo: 'Non sono venuto a combattere per quello che c’è dentro il Puzzle. Ma l’Anello adesso è mio.' },
        { chi: 'bakura', testo: 'Tienilo pure, ragazzo. Quello che hai dentro non si consegna con una sconfitta.' }
    ],
    'fm-3t-pegasus': [
        { chi: 'pegasus', testo: 'Ooh. L’Occhio vedeva ogni carta, e tu hai vinto lo stesso. Davvero interessante.' },
        { io: true, testo: 'Vedere cosa faccio non è sapere perché lo faccio, Pegasus.' },
        { chi: 'pegasus', testo: 'Ti consegno l’Occhio, giovanotto. Ma stai attento: chi non vede più nulla di sé, a volte ha il coraggio di guardare meglio.' }
    ],
    'fm-3t-isis': [
        { chi: 'ishizu', testo: 'Come avevo visto. Eppure la fine è molto più pesante a viverla che a vederla.' },
        { io: true, testo: 'Hai giocato per vincere, come promesso. Ti ringrazio per non essere stata indulgente.' },
        { chi: 'ishizu', testo: 'Prendi la Collana. E ricorda: il nome che hai dimenticato ti sta aspettando alla fine, non qui.' }
    ],

    // ---------------------------------------------------------------- I Cinque Maghi Guerrieri
    'fm-4-mage-soldier': [
        { chi: 'mageSoldier', testo: 'Impossibile… hai davvero il volto del principe scomparso. Heishin non mi coprirà d’oro, ma mi farà la pelle.' },
        { io: true, testo: 'Non lo saprà da me. Fammi passare, e dimentica di avermi visto.' },
        { chi: 'mageSoldier', testo: 'Passa. Ma la città è piena di occhi di Heishin: cammina nell’ombra.' }
    ],
    'fm-4-jono2': [
        { chi: 'jono', testo: 'Come ai vecchi tempi, sì. Ti credevo morto, e invece giochi ancora meglio di prima.' },
        { io: true, testo: 'Sono tornato, Jono. Ma il regno è in mano a Heishin, e ho bisogno di voi.' },
        { chi: 'jono', testo: 'Allora ce l’hai. Teana ti aspetta: prima di crederti vorrà battersi anche lei.' }
    ],
    'fm-4-teana2': [
        { chi: 'teana', testo: 'Sei davvero tu. Nessun altro giocherebbe così: con quella calma che dà sui nervi.' },
        { io: true, testo: 'Anni lontano da casa, Teana. Ora aiutatemi a riprendermela.' },
        { chi: 'teana', testo: 'Conta su di me. Heishin ci ha tolto tutto, e ora è il momento di riprenderci qualcosa.' }
    ],
    'fm-4-ocean': [
        { chi: 'oceanMage', testo: 'L’acqua ha deciso. Passi, principe.' },
        { io: true, testo: 'Le secche non fermano chi ha fretta.' }
    ],
    'fm-4-secmeton': [
        { chi: 'highMageSecmeton', testo: 'Il mare non restituisce niente, e invece oggi me lo hai strappato di mano.' },
        { io: true, testo: 'Non l’ho strappato: l’ho solo atteso, come fa lui.' },
        { chi: 'highMageSecmeton', testo: 'Prendi il mio Oggetto, allora. Il mare è meno testardo di me, ma ti seguirà comunque.' }
    ],
    'fm-4-mountain': [
        { chi: 'mountainMage', testo: 'Mezzo fiato non basta. Hai vinto tu.' },
        { io: true, testo: 'La salita non mi ha tolto la fretta, ma la lucidità l’ho tenuta.' }
    ],
    'fm-4-atenza': [
        { chi: 'highMageAtenza', testo: 'La pietra si è spaccata davvero. Non me l’aspettavo da uno che arriva col fiatone.' },
        { io: true, testo: 'La pietra non tratta, ma si può scalare. Prendo il tuo Oggetto, Atenza.' },
        { chi: 'highMageAtenza', testo: 'Prendilo. Il prossimo non sarà altrettanto paziente.' }
    ],
    'fm-4-forest': [
        { chi: 'forestMage', testo: 'Gli alberi volevano vedere come andava a finire. Adesso lo sanno.' },
        { io: true, testo: 'E che cosa ne pensano?' },
        { chi: 'forestMage', testo: 'Che puoi andare avanti. Per ora.' }
    ],
    'fm-4-anubisius': [
        { chi: 'highMageAnubisius', testo: 'Ho contato tutti i morti di questa foresta, e alla fine ho contato anche me. Hai vinto.' },
        { io: true, testo: 'Sdraiati pure tutti, allora. Io proseguo.' },
        { chi: 'highMageAnubisius', testo: 'Prendi l’Oggetto, principe. I morti non ti seguiranno, ma ti ricorderanno.' }
    ],
    'fm-4-desert': [
        { chi: 'desertMage', testo: 'Di solito ha ragione, il mio Sommo. Oggi no.' },
        { io: true, testo: 'Te l’avevo detto. Fammi passare.' }
    ],
    'fm-4-martis': [
        { chi: 'highMageMartis', testo: 'Sotto la sabbia da cinquemila anni, e un ragazzo con la fretta mi ha battuto. Il deserto si è fatto da parte.' },
        { io: true, testo: 'Il deserto può aspettare, io no. Grazie per l’Oggetto.' },
        { chi: 'highMageMartis', testo: 'Vai. Il sole sta già calando, e ti conviene arrivare al prato prima della notte.' }
    ],
    'fm-4-meadow': [
        { chi: 'meadowMage', testo: 'Aprire il prato e lasciarti attraversare erano due cose diverse, allora. Eppure sei qui.' },
        { io: true, testo: 'Alla fine sono la stessa cosa, come ti avevo detto.' },
        { chi: 'meadowMage', testo: 'Kepura ti aspetta in cima. Non farlo aspettare troppo.' }
    ],
    'fm-4-kepura': [
        { chi: 'highMageKepura', testo: 'Cinque terre, cinque Oggetti, e io che non avrei scommesso una moneta. Mi hai ripagato di un debito che non sapevo di avere.' },
        { io: true, testo: 'Un Oggetto alla volta. Ora ti chiedo di dirmi che cosa c’è nel palazzo.' },
        { chi: 'highMageKepura', testo: 'Una cosa che nemmeno Heishin guarda in faccia. Preparati: dopo di me, non c’è più nessuno che ti ostacoli, e nessuno che ti aiuti.' }
    ],

    // ---------------------------------------------------------------- Il Dungeon del Labirinto
    'fm-5-labirinto': [
        { chi: 'labyrinthMage', testo: 'Le avevi contate tutte, dunque. Il labirinto si è arreso a uno che non si è mai perso.' },
        { io: true, testo: 'Mi sono perso solo una volta, da ragazzo: ho imparato a non farlo più.' },
        { chi: 'labyrinthMage', testo: 'Allora vai. Ma il labirinto ha altre uscite, e non tutte portano dove vuoi.' }
    ],
    'fm-5-seto2': [
        { chi: 'priestSeto', testo: 'Hai vinto di nuovo. Alla festa potevo permettermi di scherzare: oggi no, e hai vinto lo stesso.' },
        { io: true, testo: 'Te lo avevo detto, Seto: non mi hai mai lasciato vincere.' },
        { chi: 'priestSeto', testo: 'Forse no. Continua pure, principe: ti starò dietro, come sempre. Più vicino di quanto immagini.' }
    ],
    'fm-5-sebek': [
        { chi: 'sebek', testo: 'Il fiume ha portato qui tante cose, ma non uno come te. Ho perso.' },
        { io: true, testo: 'La porta la chiudo io. Chiunque sia entrato dopo di me, non uscirà più da qui.' },
        { chi: 'sebek', testo: 'Fai attenzione: l’ultimo guardiano non parla, e non perde mai tempo.' }
    ],
    'fm-5-neku': [
        { chi: 'neku', testo: '…Hai vinto. Non ho parole, e non servono.' },
        { io: true, testo: 'Nemmeno a me servono. L’ultimo Oggetto è mio.' },
        { chi: 'neku', testo: 'Prendilo. Heishin ti aspetta, e ha preparato tutto per il momento in cui lo avresti avuto in mano.' }
    ]
};
