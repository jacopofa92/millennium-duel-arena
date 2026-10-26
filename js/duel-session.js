/**
 * duel-session.js — Chi sta duellando, da dove arriva e dove torna.
 * =====================================================================
 * duelMonstersCore.html è l'arena di duello condivisa da Duello Demo, Duello
 * Libero (sfida a un personaggio) e — in futuro — la Modalità Storia.
 * Il Multiplayer ha la sua pagina dedicata, multiplayer.html, che carica
 * QUESTA stessa arena a runtime dopo la lobby (vedi js/multiplayer/mp-lobby.js) invece
 * di navigare qui con un parametro — per questo è l'unica modalità che si
 * segnala con window.MULTIPLAYER_MODE invece che con l'URL, qui sotto.
 * Quello che cambia fra le modalità non è il duello in sé, ma tre
 * informazioni soltanto:
 *
 *   1. chi è l'avversario (nome, ritratto, titolo);
 *   2. quanto è difficile;
 *   3. a quale schermata si torna quando il duello finisce.
 *
 * Questo file legge quelle informazioni dall'URL (o da MULTIPLAYER_MODE)
 * e le espone a tutto il resto del gioco come `DuelSession`, così nessun
 * altro file deve sapere "da dove siamo arrivati".
 *
 * URL riconosciuti:
 *   duelMonstersCore.html                                      -> Duello Demo contro il Bot
 *   duelMonstersCore.html?mode=free&character=kaiba&difficulty=Medio
 *   duelMonstersCore.html?mode=story&character=yugi&chapter=3  -> predisposto, non ancora usato
 *   multiplayer.html                                      -> lobby online (poi carica questa arena da sé)
 *
 * Le due funzioni pubbliche sono l'inizio e la fine del duello:
 *   DuelSession.start()             — riproduce l'intro cinematografica e
 *                                     poi avvia la partita vera (initGame).
 *   DuelSession.finish(playerWon)   — registra il risultato e mostra la
 *                                     schermata di Vittoria/Sconfitta con
 *                                     il pulsante "Continua".
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    // In Multiplayer questo file viene eseguito dentro multiplayer.html
    // (non più duelMonstersCore.html?mode=multiplayer): la pagina non ha un
    // parametro ?mode nel proprio URL, quindi il segnale è invece
    // window.MULTIPLAYER_MODE, impostato da js/multiplayer/mp-lobby.js PRIMA di
    // caricare l'arena — vedi lì per il flusso completo.
    const mode = window.MULTIPLAYER_MODE ? 'multiplayer' : (params.get('mode') || 'demo').toLowerCase();

    // Dove porta il pulsante "Continua" a fine duello, per modalità.
    // "sandbox" non finisce mai per Vittoria/Sconfitta normale (è solo
    // prova libera), ma il pulsante "Abbandona" esiste comunque — vedi
    // duello-sandbox.html/js/engine/duel-sandbox.js.
    const RETURN_URLS = {
        demo: 'index.html',
        free: 'duello-libero.html',
        // Solo il RIPIEGO: una campagna torna alla propria mappa
        // (storia.html?campaign=...), vedi `returnUrl` più sotto. Questo
        // resta per il caso — che non dovrebbe capitare — di un duello di
        // storia senza campagna nell'URL.
        story: 'storia.html',
        multiplayer: 'index.html',
        sandbox: 'duello-sandbox.html',
        // La lezione guidata col nonno (js/tutorial/tutorial-duel.js):
        // finita, si torna al menu, che al primo avvio è ancora tutto da
        // scoprire.
        tutorial: 'index.html'
        // 'tournament' non è qui: il ritorno dipende da QUALE torneo
        // (?tournament=...), vedi TOURNAMENT_RETURN_URLS più sotto.
    };

    // Un torneo (?mode=tournament&tournament=<id>) torna alla propria
    // pagina mappa, non a un'unica schermata fissa come le altre modalità
    // — un nuovo torneo futuro aggiunge solo una riga qui, senza toccare
    // il resto di questo file.
    const TOURNAMENT_RETURN_URLS = {
        duelistKingdom: 'torneo-regno-duellanti.html',
        battleCity: 'torneo-battle-city.html',
        kaibaTournament: 'torneo-kaiba.html'
    };

    // =================================================================
    // EXTRA — MODALITÀ AGGIUNTIVE (Puzzle, Rivincite, Torre dei Duellanti)
    // =================================================================
    // Tutto ciò che questo file sa delle modalità aggiuntive sta in QUESTO
    // blocco. Nel resto del file restano solo chiamate di una riga a
    // `ModalitaExtra`, ciascuna marcata "EXTRA modalità". Senza una
    // modalità registrata ogni funzione qui sotto risponde "niente da fare"
    // e il file si comporta esattamente come prima che esistessero.
    //
    // Ogni modalità vive in un file suo in js/modes/ e si registra PRIMA
    // di questo file in window.ModalitaDuello[<mode>] (contratto tipizzato
    // in types/modalita.d.ts, `ModalitaDuello`). Il motore di Duel
    // Monsters (js/engine/, effetti delle carte, IA) non sa che le
    // modalità esistono e resta riusabile così com'è: cambiano soltanto la
    // preparazione del duello e ciò che succede intorno.
    const ModalitaExtra = (function () {
        /** @type {any} */
        const m = (window.ModalitaDuello && window.ModalitaDuello[mode]) || null;
        return {
            /** La pagina a cui si torna a fine duello, o null. */
            urlRitorno: () => (m && m.urlRitorno) || null,
            /** Chi sei in questo duello, se non sei te stesso (null altrimenti). */
            giocatore: () => (m && typeof m.giocatore === 'function' ? m.giocatore() : null),
            /** Prepara e avvia il duello al posto di initGame; false se non tocca a lei. */
            avvia: () => {
                if (!m || typeof m.avvia !== 'function') return false;
                m.avvia();
                return true;
            },
            /** Niente battute automatiche dei duellanti (il Puzzle). */
            senzaDialoghi: () => !!(m && m.senzaDialoghi),
            /** 'player'/'bot' se la modalità decide chi comincia, null per la morra. */
            chiComincia: () => {
                const chi = m && typeof m.chiComincia === 'function' ? m.chiComincia() : null;
                return chi === 'player' || chi === 'bot' ? chi : null;
            },
            /** Vero se la fine del duello è tutta della modalità (niente record, Sfide generiche, premi normali). */
            esclusiva: () => !!(m && m.esclusiva),
            /** Fine duello: la modalità aggiorna il suo stato e torna le voci da mostrare. */
            chiudi: (vinto, abbandono) => (m && typeof m.chiudi === 'function' ? (m.chiudi(vinto, abbandono) || []) : []),
            /**
             * Fine di un duello di una modalità ESCLUSIVA: le sue voci, il
             * salvataggio "toccato" e la schermata finale. Stesso schema del
             * Tutorial in finish(), qui per non spargere la modalità nel file.
             */
            finisciEsclusiva: (playerWon, abbandono) => {
                const premi = m && typeof m.chiudi === 'function' ? (m.chiudi(playerWon === true, abbandono) || []) : [];
                if (window.SaveManager) {
                    const save = SaveManager.load();
                    if (save) SaveManager.touch(save);
                }
                const torna = () => window.location.replace(session.returnUrl);
                if (window.DuelCinematics) {
                    DuelCinematics.showOutcome({ playerWon: playerWon, session: session, record: null, rewards: premi, onContinue: torna });
                } else {
                    torna();
                }
            }
        };
    })();
    // ======================== FINE EXTRA =============================

    // Avversari "senza volto": modalità in cui non stiamo sfidando un
    // personaggio del database ma un generico Bot o un giocatore online.
    const GENERIC_OPPONENTS = {
        demo: { id: null, name: 'Bot', title: 'Avversario di allenamento', image: null, icon: '🤖' },
        // Un avversario online e' un altro giocatore: come lui ha il ritratto del giocatore (lo specchio, vedi resolvePlayer)
        // invece del globo, cosi' la presentazione VS, l'angolo e la schermata finale mostrano una pedina vera.
        // (Qui c'erano due "\n" LETTERALI dentro un commento: la riga restava una sola e l'intera voce `multiplayer` era commentata,
        // quindi l'avversario online usciva come "Bot" nel duello e come "undefined" nella schermata finale.)
        multiplayer: { id: null, name: 'Avversario', title: 'Duellante online', image: 'images/characters/mirror.jpg', icon: '🌐' },
        sandbox: { id: null, name: 'Bot', title: 'Campo di prova', image: null, icon: '🧪' }
    };

    /**
     * La tappa della Storia che sta lanciando questo duello (?campaign= e
     * ?tappa=), cercata anche DENTRO tornei e aree: una prova è una tappa a
     * tutti gli effetti. null fuori dalla Storia o se non si trova.
     */
    function findStoryTappa() {
        if (mode !== 'story' || typeof storyCampaignsDatabase === 'undefined') return null;
        const campagna = storyCampaignsDatabase.find((c) => c.id === params.get('campaign'));
        const idTappa = params.get('tappa');
        if (!campagna || !idTappa) return null;
        let trovata = null;
        (campagna.capitoli || []).forEach((cap) => {
            (cap.tappe || []).forEach((t) => {
                if (t.id === idTappa) trovata = t;
                (t.tappe || []).forEach((x) => { if (x.id === idTappa) trovata = x; });
            });
        });
        return trovata;
    }

    /**
     * Risolve l'avversario. In Duello Libero/Storia lo cerca per id nel
     * database dei personaggi (js/data/characters-db.js); se l'id manca o non
     * esiste, ricade sul Bot generico invece di rompere il duello.
     */
    function resolveOpponent() {
        const characterId = params.get('character');
        if (characterId && typeof characterDatabase !== 'undefined') {
            const character = characterDatabase.find((c) => c.id === characterId);
            if (character) {
                // Aspetto specifico del contesto: la variante del TORNEO
                // (Kaiba nel Regno dei Duellanti ≠ Kaiba nella Kaiba Corp)
                // o quella dichiarata dalla TAPPA della Storia (`avatar`).
                // Senza nessuna delle due resta il ritratto del roster.
                let image = character.image || null;
                if (mode === 'tournament' && typeof getCharacterImageFor === 'function') {
                    image = getCharacterImageFor(character.id, params.get('tournament')) || image;
                }
                const tappaStoria = findStoryTappa();
                if (tappaStoria && tappaStoria.avatar && tappaStoria.avatar[character.id]) {
                    image = tappaStoria.avatar[character.id];
                }
                return {
                    id: character.id,
                    name: character.name,
                    title: character.title || '',
                    image: image,
                    icon: '🧑‍🎤'
                };
            }
        }
        // Multiplayer: l'avversario si presenta con la pedina che ha scelto in sala (?pedinaAvv=, id di un personaggio).
        // Il nome e' quello che l'altro giocatore ha nel suo profilo (?nomeAvv=, arrivato col suo messaggio "pronto" in sala): e' testo
        // libero scritto da un'altra persona, quindi ripulito e accorciato (finisce solo in textContent, mai in HTML).
        if (mode === 'multiplayer') {
            const p = pedinaMultiplayer(params.get('pedinaAvv'));
            const nome = pulisciNomeGiocatore(params.get('nomeAvv'));
            const base = Object.assign({}, GENERIC_OPPONENTS.multiplayer);
            if (p) base.image = p.image;
            if (nome) base.name = nome;
            return base;
        }
        return GENERIC_OPPONENTS[mode] || GENERIC_OPPONENTS.demo;
    }

    /**
     * La pedina scelta in sala (js/multiplayer/mp-pedina.js) a partire dal suo id: il ritratto di quel personaggio.
     * Si cerca SEMPRE nell'elenco locale, mai si fida di un percorso: un id sconosciuto (o "player", la pedina
     * personale di sempre) torna null e resta il ritratto predefinito.
     */
    function pulisciNomeGiocatore(testo) {
        const t = String(testo == null ? '' : testo).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
        return t || '';
    }

    function pedinaMultiplayer(id) {
        if (!id || id === 'player' || typeof characterDatabase === 'undefined') return null;
        const c = characterDatabase.find((x) => x.id === id);
        return c && c.image ? { id: c.id, name: c.name, image: c.image } : null;
    }

    /**
     * Chi sei TU in questo duello.
     *
     * Fuori dalla Storia sei te stesso: il nome scelto in profilo.html e,
     * come ritratto, lo specchio (images/characters/mirror.jpg, la stessa
     * foto dell'avversario "Te Stesso" in characters-db.js) — il gioco non
     * ha ancora un sistema di avatar personalizzabili, e uno specchio è
     * più onesto di un'icona generica.
     *
     * In una CAMPAGNA della Storia, invece, non si gioca come sé stessi:
     * nel Regno delle Ombre sei Yami Yugi, in Memorie Proibite sei Atem,
     * in Freedom sei Giacobbo, nella Grande Guerra sei il Regio Esercito.
     * Lo dice la campagna stessa (campo `protagonista` in
     * js/data/story-campaigns.js): qui non c'è alcun elenco di casi
     * speciali, e una campagna futura ottiene la stessa cosa scrivendo
     * quel campo e nient'altro. Una campagna che non lo dichiara lascia
     * il giocatore com'era.
     */
    function resolvePlayer() {
        const io = {
            id: 'player',
            name: (window.SaveManager && SaveManager.getPlayerName()) || 'Giocatore',
            title: 'Duellante',
            image: 'images/characters/mirror.jpg',
            icon: '👤'
        };
        // Multiplayer: la pedina scelta in sala (?pedina=). Cambia solo il ritratto, non il nome.
        if (mode === 'multiplayer') {
            const p = pedinaMultiplayer(params.get('pedina'));
            if (p) io.image = p.image;
        }
        // EXTRA modalità: nelle Rivincite giochi nei panni di qualcun altro.
        const altro = ModalitaExtra.giocatore();
        if (altro && altro.name) return Object.assign({}, io, altro);
        if (mode !== 'story' || typeof storyCampaignsDatabase === 'undefined') return io;
        const campagna = storyCampaignsDatabase.find((c) => c.id === params.get('campaign'));
        if (!campagna) return io;

        // Il protagonista può cambiare da un CAPITOLO all'altro della
        // stessa campagna: in Memorie Proibite sei Atem, ma nel capitolo
        // del presente sei Yugi Muto. Si cerca quindi il capitolo che
        // contiene questa tappa (?tappa=, messo nell'URL da
        // StoryProgress.urlDuello) e si usa il suo, con quello della
        // campagna come ripiego — compreso il caso di un vecchio link
        // salvato senza quel parametro.
        // La ricerca scende anche DENTRO i tornei e le aree: una loro prova
        // è una tappa a tutti gli effetti, e chi la gioca è la stessa
        // persona che sta sulla tappa che la contiene (prima scendeva solo
        // nei tornei, e nelle aree della Storia anime un capitolo col suo
        // protagonista non sarebbe mai stato letto).
        // Il livello più preciso vince: la singola PROVA può dichiarare il
        // suo `protagonista` — serve al Duello Cerimoniale, dove a sfidare
        // il Faraone non è il Faraone ma Yugi Muto, dentro un capitolo in
        // cui per il resto si gioca nei suoi panni.
        const idTappa = params.get('tappa');
        let p = campagna.protagonista;
        if (idTappa) {
            (campagna.capitoli || []).forEach((cap) => {
                (cap.tappe || []).forEach((t) => {
                    const prova = (t.tappe || []).find((x) => x.id === idTappa);
                    const suo = t.id === idTappa || !!prova;
                    if (suo && cap.protagonista) p = cap.protagonista;
                    if (prova && prova.protagonista) p = prova.protagonista;
                    else if (t.id === idTappa && t.protagonista) p = t.protagonista;
                });
            });
        }
        if (!p || !p.name) return io;
        return {
            id: p.id || ({ 'Yugi Muto': 'yugiMuto', 'Yami Yugi': 'yamiYugi', 'Atem': 'yamiYugi', 'Roberto Giacobbo': 'robertoGiacobbo', 'Roberto Giacobbo I': 'robertoGiacobbo', 'Alberto Angela': 'albertoAngela', 'Imperator Alberto Angela': 'albertoAngela', 'Alessandro Barbero': 'alessandroBarbero', 'Ser Alessandro Barbero': 'alessandroBarbero' }[p.name]) || 'player',
            name: p.name,
            title: p.title || io.title,
            image: p.image || io.image,
            icon: p.icon || io.icon
        };
    }

    // Traduce l'etichetta italiana scelta in duello-libero.html (Facile/
    // Medio/Difficile, vedi diff-btn lì) nella chiave interna che
    // js/ai/ai-controller.js si aspetta in gameState.botDifficulty
    // ('easy'/'medium'/'hard'), vedi resetGameState() in
    // js/engine/game-flow.js, che legge DuelSession.aiDifficultyKey. Il Duello
    // Demo (nessun ?difficulty= nell'URL) non imposta nulla e ricade sul
    // default 'medium' dentro ai-controller.js, cioè il comportamento del
    // bot di sempre.
    //
    // STORIA, per non ripetere lo stesso errore: un "Facile" era già
    // esistito in passato come una TERZA IA vera e propria, rimosso su
    // richiesta esplicita dell'utente perché "troppo poco distinguibile
    // dagli altri due, restava solo rumore" (vedi il commento in cima a
    // js/ai/ai-controller.js). Richiesta esplicita, di nuovo,
    // dell'utente per reintrodurlo — ma stavolta 'easy' qui sotto USA
    // L'IA NORMALE ('medium', la stessa identica): ai-controller.js
    // tratta già qualunque valore diverso da 'hard' come IA Normale
    // (vedi currentLevel() lì), quindi non serve alcuna modifica alla
    // logica dell'IA. La differenza vera sta nel MAZZO — molto più
    // debole, vedi i mazzi `easy` in js/data/character-decks.js,
    // che legge questa STESSA chiave passata a getCharacterDeck() in
    // game-flow.js. Non ripete l'errore di prima perché la differenza
    // ora è nel campo di battaglia (i mostri che si vedono), non in un
    // comportamento da dedurre osservando il bot giocare.
    const DIFFICULTY_LABEL_TO_KEY = { Facile: 'easy', Medio: 'medium', Difficile: 'hard' };
    // Etichetta mostrata a schermo (badge in duello, sottotitolo nella
    // cinematica VS) — SEPARATA dal valore "Medio" usato internamente in
    // ?difficulty=/data-difficulty/DIFFICULTY_LABEL_TO_KEY qui sopra e nello
    // stato salvato del Torneo Regno dei Duellanti: rinominare qui non
    // richiede toccare l'URL/i dati persistiti, solo cosa si LEGGE a
    // schermo — richiesta esplicita dell'utente ("ia medio, rinominala in
    // normale"). "Facile" e "Difficile" non cambiano, quindi ricadono su se stessi.
    const DIFFICULTY_DISPLAY_LABEL = { Facile: 'Facile', Medio: 'Normale', Difficile: 'Difficile' };
    // I premi di fine duello (crediti, bonus, ritrovamenti rari) NON sono
    // più qui: vivono tutti in js/economy/rewards.js, insieme alle regole
    // che li governano e ai testi che le spiegano al giocatore. Qui resta
    // solo la chiamata, in finish() più sotto.
    // Una modalità senza ?difficulty= (Duello Demo) e il Multiplayer
    // (avversario umano, nessuna difficoltà IA) non pagano nulla senza
    // bisogno di un caso speciale dedicato: è lo stesso principio con cui
    // il record V/S e le Sfide si autoescludono quando manca
    // session.opponent.id.

    const session = {
        mode: mode,
        isMultiplayer: mode === 'multiplayer',
        difficulty: params.get('difficulty') || null,
        difficultyLabel: DIFFICULTY_DISPLAY_LABEL[params.get('difficulty')] || params.get('difficulty') || null,
        aiDifficultyKey: DIFFICULTY_LABEL_TO_KEY[params.get('difficulty')] || null,
        chapter: params.get('chapter') || null,
        // Provenienza delle carte ammesse in questo duello (?origin=):
        // una chiave di CARD_ORIGIN_LABELS (es. 'yu-gi-oh') oppure 'all'.
        // ASSENTE = nessuna restrizione, non "solo Yu-Gi-Oh": così ogni
        // modalità che non passa il parametro (Demo, Sandbox, Multiplayer,
        // vecchi link salvati) si comporta esattamente come prima, e la
        // restrizione resta una scelta ESPLICITA di chi lancia il duello
        // (la schermata di Duello Libero la imposta di default su
        // 'yu-gi-oh', il Torneo la impone sempre).
        allowedOrigin: params.get('origin') || 'all',
        opponent: resolveOpponent(),
        // "Il Tuo Riflesso" (images/characters/mirror.jpg, la stessa foto
        // usata per l'avversario speciale "Te Stesso" in characters-db.js):
        // il giocatore non ha ancora un vero sistema di avatar personalizzabili,
        // quindi come immagine di default per SÉ STESSO usa lo specchio —
        // a differenza dell'icona 👤 generica, resta comunque coerente col
        // fallback automatico di buildAvatar() se il file non caricasse.
        // Il nome vero salvato dal giocatore in profilo.html
        // (SaveManager.getPlayerName(), persistito nel salvataggio) —
        // 'Giocatore' resta solo il fallback se non ne ha ancora scelto uno.
        player: resolvePlayer(),
        // Un torneo (mode==='tournament') calcola il ritorno da QUALE
        // torneo (?tournament=duelistKingdom ecc — vedi
        // TOURNAMENT_RETURN_URLS sopra), le altre modalità da una
        // tabella fissa per modalità.
        tournamentId: mode === 'tournament' ? params.get('tournament') : null,
        // Modalità Storia: quale campagna (?campaign=anime ecc). Serve a
        // storia.html per sapere a quale sentiero appartiene il duello da
        // cui si sta tornando — viaggia nella stessa breadcrolla dei
        // tornei, vedi finish().
        campaignId: mode === 'story' ? params.get('campaign') : null,
        // Storia: questa tappa era già superata e la si sta RIGIOCANDO.
        // Serve solo a dirlo alla mappa al ritorno, perché non faccia
        // avanzare la campagna una seconda volta — il duello in sé è del
        // tutto normale, premi compresi.
        storiaRigiocata: mode === 'story' && params.get('replay') === '1',
        // Storia: questo duello è una prova di un TORNEO dentro la
        // campagna (vedi `kind: 'torneo'` in js/data/story-campaigns.js).
        // Al ritorno l'esito va applicato alla scalata del torneo —
        // vincendo si sale, perdendo si ricomincia dal primo incontro —
        // e non alla tappa corrente della campagna.
        storiaTorneoId: mode === 'story' ? (params.get('torneo') || null) : null,
        // QUALE nodo si e' giocato: serve a riconoscere l'ULTIMO nodo di un arco rigiocato (Stelle dell'arco).
        storiaTappaId: mode === 'story' ? (params.get('tappa') || null) : null,
        // Un duello laterale appartiene alla mappa della Storia, ma la sua
        // vittoria non deve spostare il percorso principale di Yugi.
        storiaLateraleId: mode === 'story' ? (params.get('laterale') || null) : null,
        // Un TORNEO torna alla pagina del torneo che si sta giocando; una
        // CAMPAGNA torna alla MAPPA della campagna che si sta giocando, non
        // all'elenco delle campagne. Senza `?campaign=`, finito un duello
        // — vinto o perso — si veniva sbattuti fuori dalla storia e
        // rispediti alla scelta iniziale, con la mappa da riaprire a mano
        // ogni volta.
        returnUrl: mode === 'tournament'
            ? (TOURNAMENT_RETURN_URLS[params.get('tournament')] || 'index.html')
            : (mode === 'story' && params.get('campaign')
                ? 'storia.html?campaign=' + encodeURIComponent(params.get('campaign'))
                    // Da una prova di torneo si torna DENTRO il torneo, non
                    // sulla mappa della campagna: è lì che si sta giocando.
                    + (params.get('torneo') ? '&torneo=' + encodeURIComponent(params.get('torneo')) : '')
                // EXTRA modalità: ognuna torna alla sua pagina.
                : (ModalitaExtra.urlRitorno() || RETURN_URLS[mode] || 'index.html')),
        started: false,
        finished: false
    };

    /**
     * Ricostruisce un pannello LP (#botInfo o #playerInfo) in stile "HUD"
     * (rifatto sul riferimento screenshot fornito dall'utente): ritratto
     * circolare a lato, nome/LP impilati accanto. Il turno attivo è
     * segnalato SOLO da una corona (.turn-crown, icona a tema — vedi
     * js/ui/icon-library.js) accanto al nome, mostrata via CSS quando
     * .player-info.side-player ha la classe .active-turn — non più da un
     * bagliore/pulsazione. Riusa i figli GIÀ presenti nell'HTML (h3 con
     * dentro .turn-crown/.name-text, .life-points, già scritti dalle
     * rispettive pagine) spostandoli dentro un nuovo wrapper
     * .duelist-details, invece di ricostruirli da zero — così questa
     * funzione non deve sapere nulla del loro contenuto interno.
     */
    function applyDuelistIdentity(boxSelector, duelist, options) {
        const box = document.querySelector(boxSelector);
        if (!box) return;
        options = options || {};

        const nameEl = box.querySelector('h3');
        if (nameEl) {
            // Il testo va nello span interno .name-text, MAI su nameEl
            // stesso: nameEl.textContent = ... cancellerebbe anche
            // .turn-crown, suo fratello dentro lo stesso h3.
            const nameTextEl = nameEl.querySelector('.name-text');
            if (nameTextEl) {
                nameTextEl.textContent = duelist.name;
            } else {
                nameEl.textContent = duelist.name;
            }
            nameEl.title = duelist.name;
            nameEl.className = 'duelist-name';
        }

        const details = document.createElement('div');
        details.className = 'duelist-details';
        while (box.firstChild) {
            details.appendChild(box.firstChild);
        }

        // La difficoltà (solo per l'avversario) NON vive più dentro il
        // riquadro info: va nel badge dedicato #difficultyBadge, impilato
        // insieme a tempo/turno e Abbandona (vedi CSS in duelMonstersCore.html)
        // — richiesta esplicita per tenerla vicina a quelle altre info di
        // sistema invece che accanto al nome dell'avversario. Il TESTO usa
        // l'etichetta mostrabile (options.difficultyLabel, es. "Normale"),
        // la CLASSE CSS resta derivata dal valore INTERNO grezzo
        // (options.difficulty, es. "Medio" -> diff--medio, vedi
        // js/ui/duel-cinematics.css): rinominare l'etichetta a schermo non
        // deve rompere l'aggancio già esistente con lo stile colorato.
        if (options.difficulty) {
            const badge = document.getElementById('difficultyBadge');
            if (badge) {
                badge.textContent = options.difficultyLabel || options.difficulty;
                badge.className = 'duelist-difficulty diff--' + options.difficulty.toLowerCase();
            }
        }

        box.appendChild(buildAvatar(duelist, 'duelist-avatar--corner', { pedina: true }));
        box.appendChild(details);

        // Sostituisce il segnaposto <span data-icon="crown"> (statico
        // nell'HTML) con l'SVG vero — vedi js/ui/icon-library.js.
        if (window.Icons) Icons.hydrate(box);
    }

    function applyOpponentIdentity() {
        applyDuelistIdentity('#botInfo', session.opponent, { difficulty: session.difficulty, difficultyLabel: session.difficultyLabel });
    }

    function applyPlayerIdentity() {
        applyDuelistIdentity('#playerInfo', session.player, {});
    }

    /**
     * Costruisce il ritratto di un duellante: parte dall'emoji di ripiego
     * e la sostituisce con l'immagine solo se questa carica davvero
     * (stessa convenzione usata in duello-libero.html — la cartella
     * images/characters/ può non esistere ancora).
     */
    function buildAvatar(duelist, extraClass, options) {
        options = options || {};
        const wrap = document.createElement('span');
        wrap.className = 'duelist-avatar' + (extraClass ? ' ' + extraClass : '');

        const fallback = document.createElement('span');
        fallback.className = 'duelist-avatar-fallback';
        fallback.textContent = duelist.icon || '🂠';
        wrap.appendChild(fallback);

        if (duelist.image) {
            const img = document.createElement('img');
            img.alt = duelist.name;
            img.onload = () => { wrap.classList.add('has-image'); };
            // Con `pedina` si prova prima il ritratto SCONTORNATO della
            // stessa persona (images/characters/pedine/<nome-file>.png, lo
            // stesso usato dalle pedine di Battle City: il nome è quello del
            // FILE del ritratto, non l'id del personaggio), che sulla plancia
            // ad angolo sta senza cornice. Se manca si ripiega sul ritratto
            // normale, e la plancia lo sfuma ai bordi invece di ritagliarlo.
            // Fuori dalla griglia del Duello Libero la figura standard e'
            // sempre la pedina scontornata. `pedina:false` resta disponibile
            // soltanto per un eventuale contesto esplicitamente fotografico.
            const pedina = options.pedina !== false ? percorsoPedina(duelist.image) : null;
            img.onerror = () => {
                if (pedina && img.dataset.ripiego !== '1') {
                    img.dataset.ripiego = '1';
                    wrap.classList.remove('is-pedina');
                    img.src = duelist.image;
                    return;
                }
                img.remove();
            };
            if (pedina) wrap.classList.add('is-pedina');
            img.src = pedina || duelist.image;
            wrap.appendChild(img);
        }
        return wrap;
    }

    function percorsoPedina(immagine) {
        if (typeof getCharacterPawnImage === 'function') return getCharacterPawnImage(immagine);
        const nome = String(immagine).split(/[\\/]/).pop().replace(/\.[a-z0-9]+(\?.*)?$/i, '');
        return nome ? 'images/characters/pedine/' + nome + '.png' : null;
    }

    /**
     * Avvia il duello: intro cinematografica e, appena il sipario si apre,
     * la partita vera. Chiamata sempre dal boot in fondo a js/engine/game-flow.js
     * — anche in Multiplayer, dove quello script viene solo caricato più
     * tardi del solito (da js/multiplayer/mp-lobby.js, a stanza pronta) invece che
     * subito al caricamento pagina.
     */
    /**
     * Carte del mazzo attivo non ammesse dalla provenienza richiesta
     * (session.allowedOrigin) — array di nomi, vuoto se va tutto bene.
     *
     * Il controllo vive QUI e non nelle schermate che lanciano il duello
     * perché questo è l'unico punto attraversato da OGNI modalità (Libero,
     * Storia, Torneo, Demo): una modalità futura eredita la verifica senza
     * doversela ricordare, e soprattutto non è aggirabile modificando il
     * mazzo dopo aver scelto le opzioni o aprendo l'URL a mano.
     */
    function findForbiddenCards() {
        if (!session.allowedOrigin || session.allowedOrigin === 'all') return [];
        if (!window.SaveManager || typeof cardDatabase === 'undefined') return [];
        const deck = SaveManager.getActiveDeck();
        if (!deck) return [];
        const names = [];
        const seen = new Set();
        [...(deck.main || []), ...(deck.extra || [])].forEach((entry) => {
            if (seen.has(entry.id)) return;
            seen.add(entry.id);
            const card = cardDatabase.find((c) => c.id === entry.id);
            // Una carta che non esiste più nel database non è "di un'altra
            // provenienza": è un residuo di un mazzo vecchio, e bloccare il
            // duello per quella sarebbe un messaggio incomprensibile.
            if (!card) return;
            // Una carta senza campo origin è di fatto Yu-Gi-Oh (è il
            // default storico del dataset, vedi data/cards.json).
            const origin = card.origin || 'yu-gi-oh';
            if (origin !== session.allowedOrigin) names.push(card.name);
        });
        return names;
    }

    function originLabelOf(key) {
        if (key === 'all') return 'Tutte le provenienze';
        if (typeof CARD_ORIGIN_LABELS !== 'undefined' && CARD_ORIGIN_LABELS[key]) return CARD_ORIGIN_LABELS[key];
        const custom = window.CustomTaxonomy ? CustomTaxonomy.listOrigins().find((o) => o.key === key) : null;
        return custom ? custom.label : key;
    }

    /** Schermata di blocco: spiega il problema e riporta indietro. */
    function showDeckNotAllowed(forbidden) {
        const overlay = document.createElement('div');
        overlay.className = 'rps-overlay is-in';
        const shown = forbidden.slice(0, 8);
        const rest = forbidden.length - shown.length;
        overlay.innerHTML = `
            <div class="rps-panel">
                <div class="rps-eyebrow">Mazzo non ammesso</div>
                <h2 class="rps-title rps-verdict--lose">Non puoi giocare con questo mazzo</h2>
                <p class="rps-sub">
                    Questo duello ammette solo carte <strong>${escapeAttr(originLabelOf(session.allowedOrigin))}</strong>,
                    ma il tuo mazzo attuale ne contiene ${forbidden.length} di altre provenienze.
                </p>
                <div class="rps-side" style="flex:1 1 auto; text-align:left;">
                    ${shown.map((n) => `<div class="rps-side-label" style="margin:2px 0;">• ${escapeAttr(n)}</div>`).join('')}
                    ${rest > 0 ? `<div class="rps-side-name" style="margin-top:8px;">…e altre ${rest}</div>` : ''}
                </div>
                <div class="rps-actions">
                    <button type="button" class="rps-btn primary" id="deckBlockBack">‹ Torna indietro</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#deckBlockBack').onclick = () => {
            window.location.href = session.returnUrl;
        };
    }

    function escapeAttr(text) {
        return String(text).replace(/[&<>"']/g, (ch) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    /** L'id dell'account collegato adesso, o null (nessuna sessione, o cloud non disponibile in questa pagina). */
    function accountDelDuello() {
        try {
            const u = window.CloudSync && typeof CloudSync.getUser === 'function' ? CloudSync.getUser() : null;
            return u && u.id ? u.id : null;
        } catch (e) { return null; }
    }

    function start() {
        if (session.started) return;
        session.started = true;
        // Di chi e' questo duello: se a fine partita l'account collegato e' un altro (un'altra scheda ha fatto uscire
        // e rientrare qualcuno mentre si giocava), il risultato NON si scrive nel salvataggio di chi c'e' adesso.
        session.accountId = accountDelDuello();

        // Nasconde la schermata di caricamento condivisa (js/ui/page-loader.js,
        // PAGE_LOADER_MANUAL_HIDE=true in duelMonstersCore.html — al posto
        // del vecchio #preIntroCover statico) — SEMPRE, sia che segua la
        // cinematica (playIntro qui sotto, che crea subito il proprio
        // overlay: la dissolvenza del loader rivela quello, mai il campo
        // grezzo) sia in modalità sandbox (beginMatch diretto, nessun
        // overlay a sostituirla: deve sparire comunque, altrimenti
        // resterebbe a coprire il campo per sempre).
        if (window.PageLoader) PageLoader.hide();

        // Restrizione di provenienza (?origin=): se il mazzo attivo non è
        // ammesso il duello non comincia affatto — niente cinematica,
        // niente pescate, solo la spiegazione e la via del ritorno.
        const forbidden = findForbiddenCards();
        if (forbidden.length > 0) {
            showDeckNotAllowed(forbidden);
            return;
        }

        applyOpponentIdentity();
        applyPlayerIdentity();

        // Sandbox: niente vero mazzo/pescata (initGame in game-flow.js,
        // MAI toccato da questa modalità) — usa invece
        // initSandboxGame() (js/engine/duel-sandbox.js, file a parte,
        // additivo), che legge lo stato personalizzato preparato in
        // duello-sandbox.html e lo applica direttamente. Niente
        // cinematica d'apertura nemmeno: è uno strumento di prova
        // rapida, non una vera partita.
        const beginMatch = (opzioniAvvio) => {
            let ingressoDifferito = null;
            if (mode === 'sandbox') {
                if (typeof initSandboxGame === 'function') initSandboxGame();
            } else if (mode === 'tutorial' && window.TutorialDuel) {
                // Mani, mazzi e Life Point preparati, poi il nonno che
                // spiega passo per passo (js/tutorial/tutorial-duel.js).
                TutorialDuel.avvia();
            } else if (ModalitaExtra.avvia()) {
                // EXTRA modalità: la modalità ha preparato e avviato il duello.
            } else if (typeof initGame === 'function') {
                ingressoDifferito = initGame(opzioniAvvio);
            }
            if (typeof setupPhaseStepper === 'function') setupPhaseStepper();
            if (mode !== 'sandbox' && mode !== 'tutorial' && !ModalitaExtra.senzaDialoghi() && window.DuelDialogues) {
                setTimeout(() => DuelDialogues.battleStart(), 900);
            }
            return ingressoDifferito;
        };

        // Morra cinese per decidere chi gioca per primo (js/ui/duel-rps.js):
        // si incastra QUI, tra la cinematica VS e l'inizio vero della
        // partita — vedi il commento in cima a quel file per il perché di
        // questo punto esatto. Esclusi Sandbox (strumento di prova, non una
        // partita) e Multiplayer (chi inizia lo decide già il server al
        // momento dell'accoppiamento, vedi MP_startingRole in game-flow.js).
        // Torna una Promise quando c'è la morra: la cinematica la aspetta
        // prima di alzare il sipario (vedi raiseCurtain in
        // js/ui/duel-cinematics.js). Ne derivano tre cose, tutte volute:
        // la morra si gioca SOPRA la schermata VS invece che su un campo
        // vuoto; initGame() — il pezzo pesante — gira mentre lo schermo è
        // ancora completamente coperto e fermo, che è la condizione che
        // quel file documenta come unica per non far scattare la
        // transizione; e lo zoom d'ingresso nell'arena parte solo dopo,
        // su un thread libero.
        const beginWithCoinToss = () => {
            if (mode === 'sandbox' || mode === 'multiplayer' || !window.DuelRPS) {
                beginMatch();
                return null;
            }
            // Nella lezione comincia sempre il giocatore: è lui che deve
            // imparare a evocare e a mettere la Trappola nel primo turno.
            if (mode === 'tutorial') {
                window.DUEL_STARTING_ROLE = 'player';
                beginMatch();
                return null;
            }
            // EXTRA modalità: il Puzzle (e la Torre con l'oggetto "parti
            // per primo") decide da sé chi comincia, senza morra.
            const giaDeciso = ModalitaExtra.chiComincia();
            if (giaDeciso) {
                window.DUEL_STARTING_ROLE = giaDeciso;
                beginMatch();
                return null;
            }
            return DuelRPS.play(session.opponent).then((starter) => {
                window.DUEL_STARTING_ROLE = starter;
                // Dopo la morra il campo viene costruito mentre il sipario
                // VS e' ancora opaco, ma la sua animazione 3D parte soltanto
                // quando il layer fullscreen della morra e' stato realmente
                // rimosso. Su Android/WebView creare e trasformare entrambi
                // i layer nello stesso frame produceva lampi e tasselli non
                // ridisegnati. La funzione restituita viene avviata dalla
                // cinematica dopo due frame di assestamento.
                return beginMatch({ deferCameraIntro: true });
            });
        };

        if (mode !== 'sandbox' && window.DuelCinematics) {
            DuelCinematics.playIntro(session, beginWithCoinToss);
        } else {
            beginWithCoinToss();
        }
    }

    /**
     * Chiude il duello. Aggiorna il record del personaggio (solo se
     * l'avversario è un personaggio vero: Bot e avversari online non
     * hanno un record da tenere) e mostra la schermata finale.
     * `playerWon`: true/false, oppure 'draw' (es. Ultimo Turno, id 341) —
     * un Pareggio NON tocca il record V/S (recordCharacterResult non
     * viene chiamata), così lo schema di salvataggio {wins, losses} non
     * ha bisogno di un terzo campo "draws".
     */
    function finish(playerWon, opzioni) {
        if (session.finished) return;
        session.finished = true;
        // Record, Sfide, premi e sblocchi scrivono nel salvataggio locale, che adesso potrebbe essere di un ALTRO account:
        // meglio un risultato non registrato che le vittorie di uno finite nel profilo dell'altro.
        if (session.accountId && accountDelDuello() !== session.accountId) {
            try { sessionStorage.setItem('ygoAvvisoSync', 'accountCambiato'); } catch (e) { /* noop */ }
            window.location.replace('index.html');
            return;
        }
        if (window.DuelDialogues) DuelDialogues.duelEnd(playerWon);
        // `opzioni.abbandono`: il giocatore si è ritirato invece di giocare
        // fino alla fine (vedi endDuel in js/engine/game-flow.js). Tocca
        // SOLO i premi: il record V/S e la schermata finale restano quelli
        // di una sconfitta, che è ciò che un abbandono è.
        const abbandono = !!(opzioni && opzioni.abbandono);

        // La lezione non è una partita: niente record contro il nonno,
        // niente Sfide, sblocchi o premi normali. Solo il premio della
        // prima lezione completata, che decide il tutorial stesso.
        if (mode === 'tutorial') {
            const premi = window.TutorialDuel ? TutorialDuel.chiudi(playerWon === true, abbandono) : [];
            if (window.SaveManager) {
                const save = SaveManager.load();
                if (save) SaveManager.touch(save);
            }
            // Dove tornare lo decide il tutorial: il menu principale dopo la
            // lezione obbligatoria del primo avvio, il menu Tutorial altrimenti.
            const url = (window.TutorialDuel && TutorialDuel.urlRitorno && TutorialDuel.urlRitorno()) || session.returnUrl;
            const torna = () => window.location.replace(url);
            if (window.DuelCinematics) {
                DuelCinematics.showOutcome({ playerWon: playerWon, session: session, record: null, rewards: premi, onContinue: torna });
            } else {
                torna();
            }
            return;
        }

        // EXTRA modalità: il Puzzle non è una partita normale (niente
        // record, Sfide generiche o premi di fine duello), decide tutto lui.
        if (ModalitaExtra.esclusiva()) { ModalitaExtra.finisciEsclusiva(playerWon, abbandono); return; }

        // Missioni generiche ("Gioca 1 Duello fino alla fine"): conta un duello GIOCATO, vinto, perso o pareggiato, perche' una
        // missione per chi comincia non deve punire chi perde. Non conta un abbandono (niente premi per chi lascia, vedi i
        // premi qui sotto), ne' il banco di prova del Demo e della sandbox, che non sono partite.
        if (!abbandono && mode !== 'demo' && mode !== 'sandbox' && window.ChallengeTracker) {
            ChallengeTracker.recordProgress('playDuel', { mode: mode });
        }

        let record = null;
        if (playerWon !== 'draw' && session.opponent.id && typeof recordCharacterResult === 'function') {
            // Il livello serve alla medaglia del Duello Libero ("battuto a
            // Difficile"): vedi recordCharacterResult in characters-db.js.
            record = recordCharacterResult(session.opponent.id, playerWon, session.difficulty);
        }
        // Sfide (js/data/challenges-db.js): 'defeatCharacter'/'winDuels'
        // contano solo vittorie VERE contro un avversario reale, mai il
        // Bot generico del Duello Demo (session.opponent.id è null per
        // lui — stessa condizione già usata per recordCharacterResult qui
        // sopra) e mai un Pareggio.
        if (playerWon === true && session.opponent.id && window.ChallengeTracker) {
            const lpFinali = (typeof gameState !== 'undefined' && gameState) ? gameState.playerLP : 0;
            const parametriVittoria = {
                characterId: session.opponent.id,
                difficulty: session.difficulty,
                playerLP: lpFinali,
                lpLost: Math.max(0, 8000 - lpFinali)
            };
            ChallengeTracker.recordProgress('defeatCharacter', parametriVittoria);
            ChallengeTracker.recordProgress('winDuels', {});
            // 'perfectWin': vinto senza perdere un solo Life Point.
            // `gameState` è dichiarato con `let` a livello di script in
            // game-flow.js: è un global vero ma NON una proprietà di
            // window, quindi va controllato con typeof.
            if (typeof gameState !== 'undefined' && gameState && gameState.playerLP >= 8000) {
                ChallengeTracker.recordProgress('perfectWin', {});
            }
        }
        // Duellanti sbloccati per il Duello Libero (vedi
        // js/data/character-unlocks.js): battere qualcuno in un Torneo o
        // nella Storia è ciò che lo rende sfidabile quando si vuole. Non
        // in Duello Libero, che è il posto dove si SPENDE lo sblocco, non
        // dove lo si guadagna — e comunque lì un bloccato non lo si può
        // nemmeno scegliere.
        let nuovoDuellante = null;
        if (playerWon === true && session.opponent.id && window.CharacterUnlocks
            && CharacterUnlocks.modalitaSblocca(mode) && CharacterUnlocks.sblocca(session.opponent.id)) {
            nuovoDuellante = session.opponent.name || session.opponent.id;
        }
        // Premi del duello: assegnati QUI, l'unico punto da cui passa la
        // fine di OGNI duello di ogni modalità, invece che in ciascuna
        // pagina (Duello Libero/Storia/Torneo...) — una modalità futura li
        // eredita senza dover ricordarsi di aggiungerli.
        // I numeri e le regole (bonus giornaliero, rendimenti decrescenti,
        // probabilità dei ritrovamenti) vivono tutti in
        // js/economy/rewards.js: qui si chiama e si passa il risultato alla
        // schermata, che mostra ogni voce CON la sua spiegazione.
        let rewards = [];
        if (window.Rewards && window.MP_RAID && playerWon === true && !abbandono && typeof Rewards.forRaid === 'function') {
            // Raid cooperativo (Multiplayer, js/multiplayer/mp-raid.js): la vittoria paga il premio del Raid, non quello di un
            // Duello Libero. Una sconfitta o un abbandono restano quelli di sempre, qui sotto.
            rewards = Rewards.forRaid({ bossNome: (session.opponent && session.opponent.name) || '' });
        } else if (window.Rewards) {
            rewards = Rewards.forDuel({
                won: playerWon === true,
                difficulty: session.difficulty,
                inTournament: mode === 'tournament',
                // Servono agli Oggetti del Millennio: si vincono solo
                // battendo il personaggio che lo porta, e solo nel torneo
                // in cui ha senso incontrarlo. Qui li sappiamo entrambi,
                // quindi non serve che il torneo se li passi da se'.
                tournamentId: session.tournamentId || null,
                opponentId: (session.opponent && session.opponent.id) || null,
                abbandono: abbandono,
                playerLP: (typeof gameState !== 'undefined' && gameState) ? gameState.playerLP : 0,
                lpLost: (typeof gameState !== 'undefined' && gameState)
                    ? Math.max(0, 8000 - gameState.playerLP) : 8000
            });
        }
        // Lo sblocco di un Duellante si annuncia nello stesso elenco delle
        // ricompense, con la regola che l'ha prodotto: è un guadagno come
        // gli altri, e un guadagno che il giocatore non vede è un guadagno
        // che non ha avuto. Si usa la forma `nota` (nessun importo): non è
        // una valuta, non ha una quantità da scrivere.
        if (nuovoDuellante) {
            rewards.push({
                icon: '🔓',
                nota: true,
                rule: 'Nuovo Duellante in Duello Libero: ' + nuovoDuellante
                    + ' — si sblocca battendolo in un Torneo o nella Storia.'
            });
        }
        // EXTRA modalità: Rivincite e Torre aggiornano il loro stato (la
        // rivincita vinta, il piano raggiunto) e aggiungono le loro voci.
        rewards = rewards.concat(ModalitaExtra.chiudi(playerWon === true, abbandono));
        // A fine duello il salvataggio va sempre "toccato" (aggiorna
        // l'Ultimo salvataggio in Profilo), anche per un Duello Demo/Bot
        // generico senza record da aggiornare — recordCharacterResult qui
        // sopra lo farebbe già, ma solo quando c'è un personaggio vero.
        if (window.SaveManager) {
            const save = SaveManager.load();
            if (save) SaveManager.touch(save);
        }

        // Breadcrolla generica "com'è appena finito l'ultimo duello",
        // consultata SOLO da chi ne ha davvero bisogno al ritorno (oggi
        // solo torneo-regno-duellanti.html, per sapere se il Duellante
        // appena sfidato è stato battuto o no) — le altre modalità la
        // ignorano semplicemente. sessionStorage (non localStorage): non
        // deve sopravvivere oltre la sessione di navigazione corrente.
        try {
            sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                mode: mode,
                tournamentId: session.tournamentId,
                // Modalità Storia: senza questo, storia.html non sa a
                // quale campagna appartenga il duello da cui si sta
                // tornando, e non fa avanzare niente. Le modalità che non
                // hanno una campagna lo ignorano, com'è già per
                // tournamentId.
                campaignId: session.campaignId,
                // Vedi `storiaRigiocata` più sopra: senza questo, rivincere
                // una tappa già superata farebbe avanzare la campagna e si
                // salterebbe la tappa successiva senza giocarla.
                rigiocata: session.storiaRigiocata === true,
                torneoId: session.storiaTorneoId,
                lateraleId: session.storiaLateraleId,
                tappaId: session.storiaTappaId,
                playerWon: playerWon,
                opponentId: session.opponent.id,
                timestamp: Date.now()
            }));
        } catch (e) { /* noop */ }

        const goBack = () => {
            // Non affidare la destinazione alla cronologia: nell'APK la
            // voce precedente può essere la mappa GENERALE della Storia,
            // non l'area da cui è partito il duello. `returnUrl` contiene
            // invece sempre campaign e, per una prova annidata, torneo.
            window.location.replace(session.returnUrl);
        };

        if (window.DuelCinematics) {
            DuelCinematics.showOutcome({
                playerWon: playerWon,
                session: session,
                record: record,
                rewards: rewards,
                onContinue: goBack
            });
        } else {
            goBack();
        }
    }

    // ------------------------------------------------------------
    // Blocco ricarica pagina durante un duello in corso — richiesta
    // esplicita dell'utente: senza questo un giocatore può ricaricare
    // la pagina (F5/Ctrl+R o il pulsante di ricarica del browser) per
    // "disfare" una mossa o una sconfitta imminente e ricominciare da
    // capo con una mano diversa, aggirando anche il salvataggio-per-nodo
    // del Torneo Regno dei Duellanti (vedi torneo-regno-duellanti.html).
    // Due livelli distinti, perché un browser può ricaricare/lasciare la
    // pagina in due modi molto diversi:
    //   1. F5/Ctrl+R/Ctrl+Shift+R/Cmd+R da tastiera: preventDefault() sul
    //      keydown blocca DAVVERO l'azione di ricarica in ogni browser
    //      desktop testato — nessuna conferma richiesta all'utente, la
    //      pagina semplicemente non si ricarica.
    //   2. Pulsante di ricarica del browser, chiusura scheda, tasto
    //      Indietro, pull-to-refresh su mobile: NESSUNA di queste è
    //      bloccabile da JavaScript — è una scelta di sicurezza
    //      deliberata dei browser, non un limite di questa
    //      implementazione. L'unico strumento disponibile è
    //      'beforeunload', che mostra il dialogo nativo "Uscire dalla
    //      pagina?" (testo fisso deciso dal browser, non personalizzabile
    //      da anni in nessun browser moderno) invece di lasciare
    //      silenziosamente la pagina — un freno concreto, non un blocco
    //      assoluto.
    // Attivo SOLO mentre il duello è realmente in corso (dopo start(),
    // prima di finish()): sia prima che il duello inizi sia dopo che è
    // finito la pagina si comporta normalmente, incluso il click
    // volontario su "Continua"/"Abbandona" che naviga via da qui.
    // ------------------------------------------------------------
    function isDuelInProgress() {
        return session.started && !session.finished;
    }
    document.addEventListener('keydown', function (e) {
        if (!isDuelInProgress()) return;
        const key = (e.key || '').toLowerCase();
        const isF5 = key === 'f5';
        const isReloadShortcut = (e.ctrlKey || e.metaKey) && key === 'r';
        if (isF5 || isReloadShortcut) {
            e.preventDefault();
        }
    }, true);
    window.addEventListener('beforeunload', function (e) {
        if (!isDuelInProgress()) return;
        e.preventDefault();
        e.returnValue = '';
    });

    session.start = start;
    session.finish = finish;
    session.buildAvatar = buildAvatar;
    window.DuelSession = session;
})();
