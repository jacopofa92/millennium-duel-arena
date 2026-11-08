/**
 * tournament-dialogues.js — Gli intermezzi narrativi dei tornei.
 * =====================================================================
 * Solo TESTI: la scena la mette in piedi js/ui/story-cutscene.js, e a
 * chiamarli sono le pagine dei tornei nei loro punti di passaggio. Qui
 * dentro non c'è logica di gioco, e aggiungere un momento nuovo vuol dire
 * aggiungere una chiave a questo oggetto — niente altro da toccare.
 *
 * FORMA: DIALOGHI[idTorneo][momento] = { titolo?, sottotitolo?, sfondo?, battute }
 * Ogni battuta è { chi?, testo }: `chi` è un id di
 * js/data/characters-db.js (dà nome e ritratto), senza `chi` è la voce
 * narrante, resa come didascalia.
 *
 * `battute` può essere un ELENCO FISSO oppure una FUNZIONE `(ctx) => [...]`,
 * e la seconda forma è quella che rende vivo un torneo: permette di
 * raccontare cos'è appena successo davvero — chi ha vinto l'altra
 * semifinale, chi ti aspetta in finale, chi è stato eliminato — invece di
 * ripetere le stesse frasi generiche ad ogni partita. Il `ctx` lo prepara
 * la pagina del torneo, che è l'unica a sapere com'è andato il tabellone;
 * qui dentro si usano solo i nomi già pronti, senza mai leggere lo stato
 * del torneo direttamente. Una battuta che torna stringa vuota viene
 * scartata dalla scena, quindi si può dire una cosa solo quando c'è
 * davvero da dirla.
 *
 * `sfondo` è il LUOGO in cui la scena si svolge: il dirigibile, la sala
 * del Castello, l'arena della KaibaCorp. Si dichiarano più candidati in
 * ordine di preferenza e vale il primo che esiste davvero — così si può
 * già puntare a un'immagine che il repository non ha ancora (la Torre
 * Kaiba, per dire) senza che l'intermezzo resti su uno sfondo vuoto.
 *
 * COME SONO SCRITTI. Battute brevi, in carattere, che dicono DOVE siamo e
 * COSA cambia adesso — un intermezzo non è un riassunto della trama: è lo
 * stacco fra due fasi, e il giocatore ci passa in mezzo mentre ha voglia
 * di duellare. Tre-quattro battute al massimo, mai di più.
 *
 * Il gioco è in italiano e i personaggi parlano come nell'adattamento
 * italiano della serie: Kaiba dà del "verme" agli avversari, Pegasus usa
 * i vezzeggiativi ("Yugi-boy"), Joey è sanguigno e diretto, Marik teatrale.
 *
 * VENGONO MOSTRATI UNA VOLTA SOLA per partita (vedi `mostraUnaVolta` in
 * ciascuna pagina torneo): chi rigioca lo stesso torneo — e il Regno dei
 * Duellanti tiene perfino il conto dei tentativi — non deve rivedere gli
 * stessi dialoghi ad ogni giro. Restano comunque sempre saltabili.
 */
(function () {
    'use strict';

    const DIALOGHI = {
        // =============================================================
        // BATTLE CITY
        // =============================================================
        battleCity: {
            /** Kaiba trasforma Domino City in un'arena a cielo aperto. */
            prologue: {
                titolo: 'Battle City',
                sottotitolo: 'La città diventa un campo di battaglia',
                sfondo: ['images/maps/storia_anime_battlecity1.jpg'],
                battute: [
                    { testo: 'I maxi-schermi di Domino City si accendono nello stesso istante. Sui tetti, nelle piazze e lungo i viali compare il simbolo della KaibaCorp.' },
                    { chi: 'kaiba', testo: 'Duellanti di Domino, ascoltate bene. Da questo momento l’intera città è la mia arena: Battle City comincia adesso.' },
                    { chi: 'kaiba', testo: 'Ogni vittoria vi farà guadagnare le Carta Locazione dell’avversario. Raccoglietene sei, se credete davvero di meritare un posto nelle finali.' },
                    { chi: 'joey', testo: 'Una città intera piena di sfidanti? Perfetto! Stavolta nessuno potrà dire che sono arrivato in finale per fortuna.' },
                    { chi: 'yamiYugi', testo: 'Le Carte delle Divinità sono là fuori. Qualunque cosa Kaiba stia preparando, dobbiamo arrivare fino in fondo.' },
                    { testo: 'Il Radar del Duel Disk traccia i primi segnali. Tra la folla, altri Duellanti hanno già iniziato a muoversi.' }
                ]
            },
            /** Sei Carta Locazione raccolte: si sale sul dirigibile. */
            airship: {
                titolo: 'Il Dirigibile',
                sottotitolo: 'Quarti di finale',
                sfondo: ['images/fields/dirigibileKaibaCorp.jpg'],
                battute: [
                    { testo: 'Le sei Carta Locazione si accendono insieme sul Duel Disk. Sopra Domino City, un\'ombra enorme copre il sole: il dirigibile della KaibaCorp scende ad aspettarti.' },
                    { chi: 'kaiba', testo: 'Otto duellanti su tutta la città. Solo otto sono arrivati fin qui — e uno di voi mi darà finalmente un duello degno di questo nome.' },
                    { chi: 'joey', testo: 'Ehi, l\'hai vista quella cosa?! Ci facciamo il torneo VOLANDO! Non dirlo a mia sorella o vorrà salire pure lei.' },
                    { chi: 'kaiba', testo: 'Salite. Da questo momento nessuno scende più, se non da perdente.' }
                ]
            },
            /** Il dirigibile attracca: semifinali in cima alla Torre. */
            tower: {
                titolo: 'Torre Kaiba',
                sottotitolo: 'Semifinali',
                // La Torre non ha ancora un'arena tutta sua: si ripiega
                // sull'Arena Kaiba notturna, che è lo stesso mondo. Il
                // giorno in cui arriverà storia_anime_battlecity2.jpg, questa riga la
                // userà da sola.
                sfondo: ['images/maps/storia_anime_battlecity2.jpg', 'images/maps/storia_anime_battlecity2.jpg'],
                // `ctx` arriva da torneo-battle-city.html: chi affronti in
                // semifinale, e chi si gioca l'altra metà del tabellone.
                battute: (ctx) => [
                    { testo: 'Il dirigibile attracca al pinnacolo della Torre Kaiba. Sotto di voi, Domino City è solo un tappeto di luci.' },
                    { chi: 'kaiba', testo: 'Benvenuti nell\'arena che ho costruito io. Qui non ci sono trucchi, né scuse: solo il vostro mazzo e la vostra abilità.' },
                    {
                        testo: ctx.avversario
                            ? `Il tabellone è appeso alla parete di vetro. Il tuo nome è accanto a quello di ${ctx.avversario}.`
                            : 'Il tabellone è appeso alla parete di vetro: restano in quattro.'
                    },
                    {
                        testo: (ctx.altroA && ctx.altroB)
                            ? `Nell'altra semifinale si affrontano ${ctx.altroA} e ${ctx.altroB}. Uno dei due ti aspetterà in finale.`
                            : ''
                    }
                ]
            },
            /**
             * Semifinale vinta: si sale all'ultimo piano. È il momento in
             * cui il giocatore scopre chi ha vinto l'ALTRA semifinale — la
             * cosa che prima non veniva detta da nessuna parte.
             */
            final: {
                titolo: 'Ultimo Piano',
                sottotitolo: 'La finale',
                sfondo: ['images/fields/torreDeiDuelli.jpg', 'images/fields/torreDeiDuelli.jpg'],
                battute: (ctx) => [
                    { testo: 'L\'ascensore sale l\'ultimo tratto in silenzio. Sopra la città non è rimasto nessun altro piano.' },
                    {
                        testo: (ctx.avversario && ctx.sconfitto)
                            ? `Dall'altra parte del tabellone ${ctx.avversario} ha avuto la meglio su ${ctx.sconfitto}: è lui che ti aspetta.`
                            : (ctx.avversario ? `${ctx.avversario} ha vinto l'altra semifinale e ti aspetta già lassù.` : '')
                    },
                    { chi: 'kaiba', testo: 'Due duellanti, un titolo. Quello che succede adesso decide chi di voi conta davvero qualcosa.' }
                ]
            },
            /** Campione di Battle City. */
            champion: {
                titolo: 'Campione',
                sottotitolo: 'Battle City',
                sfondo: ['images/fields/torreDeiDuelli.jpg', 'images/fields/torreDeiDuelli.jpg'],
                battute: [
                    { testo: 'L\'ultima carta si posa. In cima alla Torre Kaiba resti in piedi tu, e nessun altro.' },
                    { chi: 'kaiba', testo: 'Non credere di aver vinto per sempre. Il prossimo torneo lo organizzo io, e ti aspetterò in finale.' },
                    { chi: 'yamiYugi', testo: 'Hai duellato con il cuore oltre che con le carte. È questo che fa un vero campione.' }
                ]
            }
        },

        // =============================================================
        // REGNO DEI DUELLANTI
        // =============================================================
        duelistKingdom: {
            /** Nuova scalata: Pegasus convoca i Duellanti sull'isola. */
            prologue: {
                titolo: 'Il Regno dei Duellanti',
                sottotitolo: 'Il torneo ha inizio',
                sfondo: ['images/maps/storia_anime_regno.jpg'],
                battute: [
                    { testo: 'Una nave attraversa la nebbia e approda sull’isola privata di Maximillion Pegasus. Davanti ai partecipanti si alzano foreste, rovine e un castello che domina il mare.' },
                    { chi: 'pegasus', testo: 'Benvenuti nel mio Regno dei Duellanti! Ognuno di voi comincia con due Stelle dell’Esagono. Proteggetele con cura, miei cari.' },
                    { chi: 'pegasus', testo: 'Sfidatevi, rischiate le vostre Stelle e raggiungete il mio castello. Ma ricordate: chi resta senza Stelle lascia immediatamente l’isola.' },
                    { testo: 'I cancelli si aprono. Il torneo comincia, e ogni sentiero può condurre a un duello.' }
                ]
            },
            /** Dieci Stelle: il sentiero verso il Castello si apre. */
            castle: {
                titolo: 'Castello di Pegasus',
                sottotitolo: 'Le finali',
                sfondo: ['images/maps/regno_dei_duellanti_castello_pegasus_torneo_v2.jpg'],
                battute: [
                    { testo: 'Dieci Stelle dell\'Esagono. Il portone del castello si apre e la sala delle finali ti aspetta: marmo a scacchiera, candelabri, e i pegasi di pietra a guardia delle pareti.' },
                    { chi: 'pegasus', testo: 'Ma guarda un po\' chi ce l\'ha fatta! Ti ho osservato per tutta l\'isola, sai. Ho persino preparato il tuo posto a tavola.' },
                    { chi: 'pegasus', testo: 'Quattro duellanti, un solo vincitore. E poi — se arriverai fin lì — ci saremo io e te, faccia a faccia.' },
                    { testo: 'Le porte si chiudono alle tue spalle. Da qui in avanti, chi perde lascia l\'isola.' }
                ]
            },
            /** Il Cancello di Kaiba: l'incontro a sorpresa prima del Castello. */
            kaibaGate: {
                titolo: 'Il Cancello',
                sottotitolo: 'Un ostacolo inatteso',
                // Si è ancora FUORI dal portone: le rovine dell'isola,
                // non la sala del Castello.
                sfondo: ['images/fields/torreCastelloPegasus.jpg'],
                battute: [
                    { testo: 'Sul sentiero che porta al castello, una figura in trench bianco ti sbarra la strada.' },
                    { chi: 'kaiba', testo: 'Fermo lì. Ho un conto in sospeso con Pegasus, e non ho intenzione di aspettare il mio turno dietro a te.' },
                    { chi: 'kaiba', testo: 'Vuoi passare? Batti me. È l\'unico pedaggio che accetto.' }
                ]
            },
            /**
             * Semifinale del Castello vinta: resta un solo duellante prima
             * di Pegasus. Qui il giocatore scopre chi è, e che fine ha
             * fatto l'altro finalista.
             */
            castleFinal: {
                titolo: 'La Finale',
                sottotitolo: 'Nella sala del Castello',
                sfondo: ['images/maps/regno_dei_duellanti_castello_pegasus_torneo_v2.jpg'],
                battute: (ctx) => [
                    { testo: 'I servitori portano via il tavolo della semifinale. Sotto le vetrate restano due sedie soltanto.' },
                    {
                        testo: ctx.avversario
                            ? `L'ultimo ostacolo prima del padrone di casa è ${ctx.avversario}.`
                            : 'L\'ultimo ostacolo prima del padrone di casa ti aspetta già al tavolo.'
                    },
                    { chi: 'pegasus', testo: 'Uno di voi due si siederà davanti a me. L\'altro prenderà il primo traghetto del mattino — con i miei più sinceri ringraziamenti, s\'intende.' }
                ]
            },
            /** L'ultimo duello: Pegasus in persona. */
            pegasus: {
                titolo: 'Il Duello Finale',
                sottotitolo: 'Maximillion Pegasus',
                sfondo: ['images/maps/regno_dei_duellanti_castello_pegasus_torneo_v2.jpg'],
                battute: [
                    { testo: 'La sala si svuota. Resta solo un tavolo, e l\'uomo che ha inventato questo gioco.' },
                    { chi: 'pegasus', testo: 'Sai qual è la parte più deliziosa, caro il mio duellante? Che io le tue carte le ho disegnate tutte. Ogni singola.' },
                    { chi: 'pegasus', testo: 'Vediamo se sai usarle meglio di quanto io sappia leggerti nel pensiero.' }
                ]
            },
            /** Campione del Regno dei Duellanti. */
            champion: {
                titolo: 'Campione',
                sottotitolo: 'Regno dei Duellanti',
                sfondo: ['images/maps/regno_dei_duellanti_castello_pegasus_torneo_v2.jpg'],
                battute: [
                    { testo: 'L\'Occhio del Millennio si spegne. Pegasus resta seduto, a lungo, senza dire niente.' },
                    { chi: 'pegasus', testo: 'Battuto... e nel mio stesso gioco. Congratulazioni: il titolo è tuo, e me lo sono meritato tutto.' }
                ]
            }
        },

        // =============================================================
        // TORNEO KAIBA (KaibaCorp Grand Championship)
        // =============================================================
        kaibaTournament: {
            /** Apertura del tabellone. */
            start: {
                titolo: 'Grand Championship',
                sottotitolo: 'Le qualificazioni',
                sfondo: ['images/fields/stadioKaiba.jpg'],
                battute: [
                    { testo: 'La KaibaCorp ha aperto le porte del suo stadio al mondo intero. Prima del tabellone principale, ogni sfidante deve conquistarsi il posto.' },
                    { chi: 'kaiba', testo: 'Due preliminari. Vincili entrambi e forse sarai degno di comparire tra gli otto finalisti.' }
                ]
            },
            /** I due preliminari sono superati: si apre il tabellone a otto. */
            quarter: {
                titolo: 'Tabellone principale',
                sottotitolo: 'Quarti di finale',
                sfondo: ['images/fields/stadioKaiba.jpg'],
                battute: (ctx) => [
                    { testo: 'Le qualificazioni sono finite. Sul grande schermo restano otto nomi, disposti nel tabellone a eliminazione diretta.' },
                    { testo: ctx.avversario ? `Il tuo quarto di finale sarà contro ${ctx.avversario}.` : '' },
                    { chi: 'kaiba', testo: 'Adesso comincia il vero torneo. Una sola sconfitta e il tuo nome sparisce dal tabellone.' }
                ]
            },
            /** Semifinali. */
            semi: {
                titolo: 'Semifinale',
                sottotitolo: 'Restano in quattro',
                sfondo: ['images/fields/stadioKaiba.jpg'],
                battute: (ctx) => [
                    { testo: 'Metà tabellone è già cancellata. Le luci dell\'arena si abbassano su quattro duellanti soltanto.' },
                    {
                        testo: ctx.avversario
                            ? `Il prossimo nome accanto al tuo è quello di ${ctx.avversario}.`
                            : ''
                    },
                    {
                        testo: (ctx.altroA && ctx.altroB)
                            ? `Nell'altra semifinale ${ctx.altroA} e ${ctx.altroB} si contendono il posto in finale.`
                            : ''
                    },
                    { chi: 'pegasus', testo: 'Sei arrivato fino a qui... che meraviglia! Ma da adesso, credimi, il gioco cambia sul serio.' }
                ]
            },
            /** Finale. */
            final: {
                titolo: 'Finale',
                sottotitolo: 'L\'ultimo duello',
                // Finale e vittoria di notte: l'arena illuminata a giorno
                // resta ai turni precedenti, così le fasi si distinguono
                // anche dallo sfondo.
                sfondo: ['images/fields/stadioKaiba.jpg'],
                battute: (ctx) => [
                    { testo: 'Lo stadio è in piedi. Sul tabellone è rimasto un solo incontro.' },
                    {
                        testo: (ctx.avversario && ctx.sconfitto)
                            ? `${ctx.avversario} ha chiuso l'altra semifinale contro ${ctx.sconfitto} e ti aspetta al centro dell'arena.`
                            : (ctx.avversario ? `${ctx.avversario} ha vinto l'altra semifinale e ti aspetta al centro dell'arena.` : '')
                    },
                    // Kaiba parla solo se è LUI l'avversario: farlo
                    // sentenziare mentre in finale c'è un altro suonerebbe
                    // falso, ed è il tipo di dettaglio che si nota subito.
                    {
                        chi: 'kaiba',
                        testo: /Kaiba/i.test(ctx.avversario || '')
                            ? 'Eccoci. Nessun alibi, nessuna interferenza: solo il mio mazzo contro il tuo. È per questo che ho costruito tutto.'
                            : 'Dal palco vedo tutto. Vinca chi sa giocare — e poi venga a cercarmi.'
                    }
                ]
            },
            /** Campione. */
            champion: {
                titolo: 'Campione',
                sottotitolo: 'KaibaCorp Grand Championship',
                sfondo: ['images/fields/stadioKaiba.jpg'],
                battute: [
                    { testo: 'Il tabellone si chiude con il tuo nome in cima.' },
                    { chi: 'kaiba', testo: 'Hai vinto. Non aspettarti che lo ripeta.' },
                    { chi: 'kaiba', testo: 'Ma tieniti pronto: il prossimo Grand Championship comincia nel momento in cui deciderò io.' }
                ]
            }
        }
    };

    /**
     * L'intermezzo di un momento, o null se per quel momento non c'è
     * nulla da raccontare — così chi chiama non deve sapere quali momenti
     * esistano davvero.
     */
    function per(torneo, momento) {
        const t = DIALOGHI[torneo];
        return (t && t[momento]) || null;
    }

    /**
     * Mostra l'intermezzo di un momento UNA VOLTA SOLA nella partita in
     * corso, e lo segna come visto nello stato del torneo.
     *
     * Sta qui e non in ciascuna pagina perché la regola è la stessa per
     * tutti e tre i tornei, e perché il punto delicato è uno solo: lo
     * stato va marcato e salvato PRIMA che la scena parta, non dopo. Un
     * intermezzo si può chiudere anche ricaricando la pagina a metà, e in
     * quel caso deve restare visto — altrimenti ricompare ad ogni
     * riapertura del torneo, che è esattamente l'effetto più fastidioso.
     *
     * Torna sempre una Promise, anche quando non mostra nulla: chi chiama
     * può incatenarci il seguito senza distinguere i casi.
     *
     * @param {string} torneo    id del torneo (chiave di DIALOGHI)
     * @param {string} momento   quale intermezzo
     * @param {object} state     lo stato del torneo (ci scrive dentro)
     * @param {function} salva   come persistere lo stato (saveState della pagina)
     */
    function mostraUnaVolta(torneo, momento, state, salva, ctx) {
        const scena = per(torneo, momento);
        if (!scena || !state || !window.StoryCutscene) return Promise.resolve();

        if (!Array.isArray(state.intermezziVisti)) state.intermezziVisti = [];
        if (state.intermezziVisti.indexOf(momento) !== -1) return Promise.resolve();

        state.intermezziVisti.push(momento);
        if (typeof salva === 'function') salva(state);

        // Le battute possono essere un elenco fisso o una funzione del
        // contesto (chi ha vinto l'altra semifinale, chi ti aspetta in
        // finale...). Se la funzione dovesse fallire — un dato che non c'è
        // in un salvataggio vecchio, per dire — l'intermezzo salta invece
        // di rompere il torneo: è una decorazione, non una regola di gioco.
        let battute;
        try {
            battute = (typeof scena.battute === 'function') ? scena.battute(ctx || {}) : scena.battute;
        } catch (e) {
            return Promise.resolve();
        }

        return StoryCutscene.play(battute, {
            titolo: scena.titolo,
            sottotitolo: scena.sottotitolo,
            sfondo: scena.sfondo,
            // Aspetto dei personaggi specifico di questo torneo (vedi
            // CHARACTER_IMAGE_VARIANTS in characters-db.js).
            ritratti: (typeof getCharacterImageVariants === 'function') ? getCharacterImageVariants(torneo) : undefined
        });
    }

    window.TournamentDialogues = {
        per: per,
        mostraUnaVolta: mostraUnaVolta,
        DIALOGHI: DIALOGHI
    };
})();
