/**
 * story-cutscene.js — Intermezzi narrativi a dialoghi.
 * =====================================================================
 * Un momento di racconto fra una fase e l'altra di un torneo: il
 * dirigibile che decolla, la Torre Kaiba che si apre, il portone del
 * Castello di Pegasus. Impianto da visual novel — fondo scurito, ritratto
 * di chi parla, riquadro del dialogo in basso — perché è il linguaggio
 * che chi conosce la serie riconosce al primo sguardo.
 *
 * USO:
 *
 *     StoryCutscene.play([
 *         { chi: 'kaiba', testo: 'Il torneo entra nel vivo.' },
 *         { testo: 'Il dirigibile si stacca dal suolo.' }   // narratore
 *     ], {
 *         titolo: 'Il Dirigibile',
 *         sottotitolo: 'Quarti di finale',
 *         // Il LUOGO della scena. Più candidati in ordine di preferenza:
 *         // si usa il primo che esiste davvero (vedi risolviSfondo), così
 *         // si può già puntare a un'immagine che il repository non ha
 *         // ancora senza lasciare un buco nero.
 *         sfondo: ['images/fields/torreKaiba.jpg', 'images/fields/stadioKaiba.jpg']
 *     }).then(() => { ...prosegui... });
 *
 * `chi` è un id di js/data/characters-db.js (per nome e ritratto);
 * ometterlo significa "voce narrante", che viene resa come didascalia in
 * corsivo senza ritratto. Torna sempre una Promise che si risolve quando
 * l'ultima battuta è stata letta, saltata, o subito se non c'è nulla da
 * mostrare: chi chiama può incatenarci il resto del flusso senza
 * controllare nulla.
 *
 * DUE CAMPI IN PIÙ SULLA BATTUTA, nati per la Modalità Storia ma buoni
 * per chiunque:
 *
 *   `nome`   — chi parla, quando NON è qualcuno del roster. La Storia ne
 *              è piena ("Il Bollettino", "Il Comando Supremo", "La
 *              troupe", "Il Principe"): prima queste voci potevano solo
 *              essere narratore, e il loro nome andava perso. Con `nome`
 *              parlano come un personaggio pur non essendo nel roster.
 *              Passato insieme a `chi`, vince `nome` — il roster dà
 *              comunque il ritratto.
 *   `ritratto` — il percorso di un'immagine, per una voce che ha una
 *              faccia ma NON sta nel roster. Vince sia su `chi` sia sul
 *              sigillo. Nato per il protagonista di una campagna della
 *              Storia, che in una campagna può non essere una persona
 *              affatto (nella Grande Guerra è il Regio Esercito, e al
 *              posto della faccia ha una bandiera).
 *   `icona`  — il simbolo del SIGILLO che prende il posto del ritratto
 *              quando la faccia non c'è. Serve davvero: dei personaggi
 *              usati oggi dalle Storie, diciannove non hanno il file del
 *              ritratto sul disco (i maghi del dungeon di Forbidden
 *              Memories, i comandanti della Grande Guerra). Prima
 *              restava un cerchio vuoto; ora resta un sigillo dorato con
 *              un simbolo, che è una mancanza molto meno evidente.
 *              Senza `icona` il sigillo mostra l'iniziale del nome.
 *
 * SI PUÒ SEMPRE SALTARE, e non per pigrizia di chi legge: un torneo si
 * rigioca molte volte (il Regno dei Duellanti tiene perfino il conto dei
 * tentativi), e alla quinta partita gli stessi dialoghi diventerebbero un
 * ostacolo. Il pulsante "Salta" chiude l'intera scena, non solo la
 * battuta corrente.
 *
 * PERCHÉ NON GSAP: questa non è la pagina del duello, e il resto delle
 * pagine-menu non carica la libreria. Le poche animazioni che servono
 * (comparsa, dissolvenza, testo che si scrive) sono transizioni CSS e un
 * timer, che qui bastano — non c'è alcuna sequenza da orchestrare che lo
 * giustifichi.
 */
(function () {
    'use strict';

    /**
     * Millisecondi fra un carattere e il successivo. 18 sembrava giusto
     * sulla carta, ma misurato su una battuta vera da ~200 caratteri
     * voleva dire quasi quattro secondi di attesa prima ancora di poter
     * andare avanti: troppi, per un intermezzo che sta in mezzo alla
     * voglia di duellare. A 11 una battuta lunga si scrive in poco più di
     * due secondi e si legge comunque a ritmo naturale.
     */
    const PASSO_TESTO = 11;
    /** Quanto resta a schermo il cartello con il titolo della scena, prima del primo dialogo. */
    const CARTELLO_MS = 1400;

    /**
     * Le scene in attesa. Due intermezzi possono essere chiesti quasi
     * insieme (un torneo che risolve un esito e subito cambia fase): senza
     * coda finirebbero uno SOPRA l'altro, entrambi a schermo, con due
     * pulsanti "Salta" sovrapposti — osservato in prova. Qui la seconda
     * aspetta che la prima abbia finito, invece di essere persa o
     * disegnata sopra.
     */
    let inCorso = false;
    const coda = [];

    function personaggio(id) {
        if (!id || typeof characterDatabase === 'undefined') return null;
        return characterDatabase.find((c) => c.id === id) || null;
    }

    function menoAnimazioni() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /**
     * Su schermi touch si usa la variante alleggerita delle arene
     * (images/fields/mobile/), esattamente come fa duelMonstersCore.html
     * per lo sfondo del duello: qui l'immagine è per giunta velata e in
     * movimento lento, quindi la differenza di qualità non si vede
     * proprio, mentre quella di peso sì — le due arene più recenti
     * superano il megabyte l'una.
     */
    function variantePerSchermo(percorso) {
        const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (!touch || percorso.indexOf('images/fields/') !== 0) return percorso;
        return percorso.replace('images/fields/', 'images/fields/mobile/');
    }

    /**
     * Il primo sfondo che esiste davvero, fra quelli proposti.
     *
     * Un intermezzo può chiedere un'immagine che il repository non ha
     * ancora (la Torre Kaiba, per dire, oggi non ha una propria arena):
     * invece di mostrare un buco nero si passa al candidato successivo.
     * È lo stesso schema già usato da torneo-battle-city.html per le
     * immagini di fase, qui generalizzato — e funziona anche su file://,
     * dove un fetch non direbbe nulla di utile.
     */
    function risolviSfondo(candidati) {
        // `flat()`: un candidato può essere a sua volta un elenco — la
        // Storia passa [arena della tappa, sfondo della campagna] e lo
        // sfondo della campagna è già una lista di candidati. Senza
        // appiattire, quell'array finirebbe dentro un url() come stringa.
        const lista = (Array.isArray(candidati) ? candidati : [candidati])
            .flat()
            .filter((v) => typeof v === 'string' && v);
        if (lista.length === 0) return Promise.resolve(null);

        return new Promise((risolvi) => {
            let i = 0;
            const prova = () => {
                if (i >= lista.length) { risolvi(null); return; }
                const src = variantePerSchermo(lista[i++]);
                const sonda = new Image();
                sonda.onload = () => risolvi(src);
                sonda.onerror = prova;
                sonda.src = src;
            };
            prova();
        });
    }

    /**
     * Granelli dorati sospesi che salgono piano sopra la scena.
     *
     * Su canvas e non con elementi animati da CSS per lo stesso motivo
     * per cui lo fa la sabbia delle arene (js/ui/field-ambience.js): un
     * centinaio di nodi DOM ciascuno col proprio keyframe costa molto di
     * più di un solo canvas ridisegnato, e su telefono si sente.
     *
     * Torna la funzione che lo spegne — chi accende deve poter spegnere,
     * e un ciclo di requestAnimationFrame lasciato vivo continuerebbe a
     * girare per tutta la sessione.
     */
    function avviaPolvere(scena) {
        const canvas = document.createElement('canvas');
        canvas.className = 'sc-polvere';
        scena.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) { canvas.remove(); return () => {}; }

        let larghezza = 0;
        let altezza = 0;
        let granelli = [];

        function dimensiona() {
            // Densità legata all'AREA, non a un numero fisso: su un
            // telefono stretto cento granelli sono una nevicata, su un
            // desktop largo sono quattro puntini sperduti.
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            // Se la scena non ha ancora una dimensione si riprova al
            // frame dopo invece di costruire un canvas da un pixel:
            // stirato al 100% diventerebbe una lastra d'oro piena.
            if (!scena.clientWidth || !scena.clientHeight) {
                requestAnimationFrame(dimensiona);
                return;
            }
            larghezza = scena.clientWidth;
            altezza = scena.clientHeight;
            canvas.width = Math.max(1, Math.round(larghezza * dpr));
            canvas.height = Math.max(1, Math.round(altezza * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const quanti = Math.round(Math.min(90, Math.max(28, (larghezza * altezza) / 12000)));
            granelli = [];
            for (let i = 0; i < quanti; i++) {
                granelli.push({
                    x: Math.random() * larghezza,
                    y: Math.random() * altezza,
                    r: 0.6 + Math.random() * 1.7,
                    // Salgono, con una deriva laterale lentissima: il
                    // moto verticale da solo legge come pioggia al
                    // contrario, che non è l'effetto voluto.
                    vy: -(4 + Math.random() * 14) / 60,
                    vx: (Math.random() - 0.5) * 6 / 60,
                    // Fase del respiro: se tutti i granelli pulsassero
                    // insieme sembrerebbe un lampeggio dell'intera scena.
                    fase: Math.random() * Math.PI * 2,
                    velocitaFase: 0.6 + Math.random() * 1.2
                });
            }
        }

        let vivo = true;
        let ultimo = performance.now();
        function disegna(ora) {
            if (!vivo) return;
            const dt = Math.min(64, ora - ultimo) / 16.67;
            ultimo = ora;
            ctx.clearRect(0, 0, larghezza, altezza);
            granelli.forEach((g) => {
                g.x += g.vx * dt;
                g.y += g.vy * dt;
                g.fase += 0.02 * g.velocitaFase * dt;
                // Rientro dal basso invece di riposizionamento a caso:
                // un granello che sparisce e riappare altrove si nota.
                if (g.y < -8) { g.y = altezza + 8; g.x = Math.random() * larghezza; }
                if (g.x < -8) g.x = larghezza + 8;
                if (g.x > larghezza + 8) g.x = -8;
                const alfa = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(g.fase));
                ctx.beginPath();
                ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(247, 215, 116, ' + alfa.toFixed(3) + ')';
                ctx.fill();
            });
            requestAnimationFrame(disegna);
        }

        dimensiona();
        window.addEventListener('resize', dimensiona);
        requestAnimationFrame(disegna);

        return function spegni() {
            vivo = false;
            window.removeEventListener('resize', dimensiona);
            canvas.remove();
        };
    }

    /**
     * @param {Array} battute - [{ chi?: string, nome?: string, icona?: string, testo: string }]
     * @param {object} [opzioni] - { titolo, sottotitolo, sfondo, ritratti }
     *   `ritratti`: { idPersonaggio: percorso } per cambiare l'aspetto di
     *   un personaggio solo in questa scena.
     * @returns {Promise<void>} risolta a scena conclusa (o saltata)
     */
    function play(battute, opzioni) {
        const righe = (battute || []).filter((b) => b && b.testo);
        if (righe.length === 0) return Promise.resolve();

        if (inCorso) {
            // Una scena alla volta: questa aspetta il suo turno.
            return new Promise((risolviInCoda) => {
                coda.push(() => play(battute, opzioni).then(risolviInCoda));
            });
        }
        inCorso = true;

        const opt = opzioni || {};
        const veloce = menoAnimazioni();

        return new Promise((risolvi) => {
            // Stato della scena, dichiarato PRIMA di costruirne il DOM:
            // il caricamento dello sfondo qui sotto è asincrono e legge
            // `chiusa` nella propria callback.
            let indice = -1;
            let battitura = null;
            let completa = false;
            let chiusa = false;
            // Ogni voce conserva il proprio lato per tutta la scena: uno
            // scambio fra due personaggi si legge cosi' come un vero campo/
            // controcampo, invece di una serie di ritratti tutti al centro.
            const latiVoci = new Map();
            let prossimoLato = 'sx';
            const scena = document.createElement('div');
            scena.className = 'sc-scena';

            // Il luogo della scena. Si chiede subito, ma la scena non lo
            // aspetta: il dialogo parte comunque e l'immagine compare in
            // dissolvenza quando è pronta — un intermezzo non deve mai
            // restare fermo ad aspettare un file.
            const sfondo = document.createElement('div');
            sfondo.className = 'sc-sfondo';
            scena.appendChild(sfondo);
            const velo = document.createElement('div');
            velo.className = 'sc-velo';
            scena.appendChild(velo);
            risolviSfondo(opt.sfondo).then((src) => {
                if (!src || chiusa) return;
                sfondo.style.backgroundImage = `url('${src}')`;
                // La carrellata si accende solo quando c'è davvero
                // un'immagine da muovere.
                sfondo.classList.add('sc-sfondo--vivo');
            });

            // Cartello d'apertura (facoltativo): il titolo della scena, che
            // dà il "dove siamo" prima ancora che qualcuno parli.
            let cartello = null;
            if (opt.titolo) {
                cartello = document.createElement('div');
                cartello.className = 'sc-cartello';
                const t = document.createElement('div');
                t.className = 'sc-cartello-titolo';
                t.textContent = opt.titolo;
                const filo = document.createElement('div');
                filo.className = 'sc-cartello-filo';
                cartello.appendChild(t);
                cartello.appendChild(filo);
                if (opt.sottotitolo) {
                    const s = document.createElement('div');
                    s.className = 'sc-cartello-sotto';
                    s.textContent = opt.sottotitolo;
                    cartello.appendChild(s);
                }
                scena.appendChild(cartello);
            }

            const ritratto = document.createElement('div');
            ritratto.className = 'sc-ritratto';
            const ritrattoImg = document.createElement('img');
            // Immagine dichiaratamente decorativa: il nome di chi parla è
            // già scritto nel riquadro, e un alt non vuoto lampeggerebbe
            // come testo mentre l'immagine carica (stesso motivo per cui
            // le carte in duello hanno alt="").
            ritrattoImg.alt = '';
            // Il ripiego quando la faccia non c'è: un sigillo dorato col
            // simbolo della battuta (o l'iniziale del nome). Sta sempre
            // nel DOM e si accende solo quando serve — costruirlo al
            // volo dentro il gestore d'errore vorrebbe dire costruirlo
            // mentre la scena è già a schermo, con uno scatto visibile.
            const sigillo = document.createElement('span');
            sigillo.className = 'sc-sigillo';
            ritratto.append(ritrattoImg, sigillo);
            scena.appendChild(ritratto);

            /**
             * Mostra il sigillo al posto della faccia. Chiamata sia quando
             * il personaggio non ha proprio un percorso immagine, sia
             * quando quel percorso esiste ma il file non c'è (il caso più
             * comune: il roster dichiara images/characters/<id>.jpg per
             * tutti, anche per chi il ritratto non ce l'ha ancora).
             */
            function mostraSigillo(simbolo) {
                ritrattoImg.removeAttribute('src');
                ritratto.classList.add('is-sigillo');
                sigillo.textContent = simbolo || '✦';
            }
            ritrattoImg.addEventListener('error', () => {
                const ripiego = ritrattoImg.dataset.ripiego;
                if (ripiego) { ritrattoImg.dataset.ripiego = ''; ritrattoImg.src = ripiego; return; }
                mostraSigillo(ritrattoImg.dataset.simbolo);
            });

            // Polvere dorata sospesa: l'unico effetto "pesante" della
            // scena, quindi acceso solo con i Dettagli video su "Alti",
            // come gli ologrammi e le folate nelle arene. Senza, la scena
            // resta esattamente quella di prima.
            // Si accende DOPO che la scena è entrata nel documento (vedi
            // più sotto): prima di allora `scena.clientWidth` è zero, il
            // canvas nascerebbe di un pixel e lo stiramento al 100% lo
            // trasformerebbe in una lastra d'oro a schermo intero — visto
            // davvero, in uno screenshot, prima di accorgersene.
            let polvere = null;

            const box = document.createElement('div');
            box.className = 'sc-box';
            const chiEl = document.createElement('span');
            chiEl.className = 'sc-chi';
            const testoEl = document.createElement('div');
            testoEl.className = 'sc-testo';
            const avanti = document.createElement('span');
            avanti.className = 'sc-avanti';
            avanti.textContent = '▼';
            const progresso = document.createElement('span');
            progresso.className = 'sc-progresso';
            box.appendChild(chiEl);
            box.appendChild(progresso);
            box.appendChild(testoEl);
            box.appendChild(avanti);
            scena.appendChild(box);

            const salta = document.createElement('button');
            salta.type = 'button';
            salta.className = 'sc-salta';
            salta.textContent = 'Salta ›';
            scena.appendChild(salta);

            document.body.appendChild(scena);
            // Si toglie il fuoco a quello che c'era sotto — quasi sempre
            // il pulsante appena premuto per aprire la scena. Mentre un
            // intermezzo è a schermo nient'altro deve essere
            // raggiungibile, e un pulsante ancora a fuoco si riattiva con
            // la barra spaziatrice o con Invio, cioè proprio i due tasti
            // che qui servono ad andare avanti: chiudendo la scena con
            // Invio, quello stesso tasto la faceva riaprire all'istante.
            if (document.activeElement && document.activeElement !== document.body
                && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            if (window.VideoQuality && VideoQuality.isAlti() && !veloce) {
                polvere = avviaPolvere(scena);
            }
            requestAnimationFrame(() => scena.classList.add('is-visibile'));

            // La barra spaziatrice e Invio avanzano come il tocco, Esc
            // chiude: su desktop sono i gesti che vengono naturali.
            // Dichiarata qui perché sia `chiudi` sia la registrazione più
            // sotto possano riferirsi alla STESSA funzione — un listener
            // rimosso con un riferimento diverso resterebbe attaccato.
            const tasti = (e) => {
                if (chiusa) return;
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); avanza(); }
                else if (e.key === 'Escape') chiudi();
            };

            function fermaBattitura() {
                if (battitura) { clearInterval(battitura); battitura = null; }
            }

            function mostraTutto() {
                fermaBattitura();
                testoEl.textContent = righe[indice].testo;
                completa = true;
                box.classList.add('is-completa');
            }

            function prossima() {
                indice++;
                if (indice >= righe.length) { chiudi(); return; }
                const riga = righe[indice];
                const chi = personaggio(riga.chi);
                // Chi parla: il nome scritto a mano vince sul roster (una
                // voce può non essere un personaggio, vedi `nome` in cima
                // al file), ma il roster resta la fonte del ritratto.
                const nome = riga.nome || (chi ? chi.name : '');
                // Il ritratto: quello passato a mano vince su tutto, poi
                // il roster. Serve per una voce che ha una faccia ma NON è
                // un personaggio del roster — il protagonista di una
                // campagna, che può essere una persona (Giacobbo) o anche
                // una bandiera (il Regio Esercito). Vedi `protagonista` in
                // js/data/story-campaigns.js.
                // `opt.ritratti` ({ idPersonaggio: percorso }) è l'aspetto di
                // un personaggio SOLO in questa scena (Kaiba nel Regno dei
                // Duellanti non è il Kaiba di Battle City): vince sul roster
                // ma non sul ritratto scritto a mano sulla riga.
                const ritrattoContesto = opt.ritratti && riga.chi && opt.ritratti[riga.chi];
                // Anche il ritratto scritto a mano (il protagonista della campagna) passa dalla PEDINA: prima, vincendo
                // "su tutto", restava l'avatar tondo mentre gli altri parlavano con la pedina scontornata.
                const fonteRitratto = (riga.ritratto && typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(riga.ritratto) : riga.ritratto)
                    || (ritrattoContesto && typeof getCharacterPawnImage === 'function'
                        ? getCharacterPawnImage(ritrattoContesto) : ritrattoContesto)
                    || (chi && typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(chi.image) : (chi && chi.image)) || '';

                box.classList.toggle('is-narratore', !nome);
                box.classList.remove('is-completa');
                box.classList.remove('parla-sx', 'parla-dx');
                completa = false;
                progresso.textContent = `${indice + 1} / ${righe.length}`;

                if (nome) {
                    if (!latiVoci.has(nome)) {
                        latiVoci.set(nome, prossimoLato);
                        prossimoLato = prossimoLato === 'sx' ? 'dx' : 'sx';
                    }
                    const lato = latiVoci.get(nome);
                    ritratto.classList.toggle('sc-ritratto--sx', lato === 'sx');
                    ritratto.classList.toggle('sc-ritratto--dx', lato === 'dx');
                    box.classList.add(lato === 'sx' ? 'parla-sx' : 'parla-dx');
                    chiEl.textContent = nome;
                    const nuovaFonte = fonteRitratto;
                    // Il ritratto si ricarica solo se cambia davvero: fra due
                    // battute dello stesso personaggio non deve rifare
                    // l'entrata, altrimenti "sfarfalla" ad ogni riga.
                    if (ritratto.dataset.fonte !== (nuovaFonte || 'sigillo:' + nome)) {
                        ritratto.dataset.fonte = nuovaFonte || 'sigillo:' + nome;
                        ritratto.classList.remove('is-sigillo');
                        // Il simbolo viene letto dal gestore d'errore, che
                        // scatta molto dopo: va messo PRIMA di assegnare
                        // src, non dentro il ramo che segue.
                        ritrattoImg.dataset.simbolo = riga.icona || nome.trim().charAt(0).toUpperCase();
                        // Se la pedina non esiste si prova l'immagine scritta a mano (un protagonista senza pedina),
                        // e solo dopo il sigillo.
                        const avatarOriginale = riga.ritratto || ritrattoContesto || (chi && chi.image) || '';
                        ritrattoImg.dataset.ripiego = (avatarOriginale && avatarOriginale !== nuovaFonte) ? avatarOriginale : '';
                        if (nuovaFonte) ritrattoImg.src = nuovaFonte;
                        else mostraSigillo(ritrattoImg.dataset.simbolo);
                        ritratto.style.transition = 'none';
                        ritratto.style.opacity = '0';
                        ritratto.style.transform = 'translate(var(--sc-ritratto-x, -50%), var(--sc-ritratto-y, 0)) scale(0.94)';
                        requestAnimationFrame(() => {
                            ritratto.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                            ritratto.style.opacity = '1';
                            ritratto.style.transform = '';
                        });
                    }
                } else {
                    chiEl.textContent = '';
                    ritratto.style.opacity = '0';
                    ritratto.dataset.fonte = '';
                    ritrattoImg.removeAttribute('src');
                }

                if (veloce) { mostraTutto(); return; }

                // Testo che si scrive. `slice` invece di concatenare
                // carattere per carattere: se la battuta contiene accenti o
                // emoji, concatenare a mano rischia di spezzarli a metà.
                testoEl.textContent = '';
                let n = 0;
                battitura = setInterval(() => {
                    n++;
                    testoEl.textContent = riga.testo.slice(0, n);
                    if (n >= riga.testo.length) mostraTutto();
                }, PASSO_TESTO);
            }

            function avanza() {
                // Tocco mentre è ancora a schermo il cartello d'apertura,
                // prima che esista una battuta: si salta l'attesa e si va
                // subito al dialogo. Senza questo ramo si finiva in
                // `righe[-1].testo`, cioè un'eccezione — ed è un gesto che
                // capita da solo, perché il cartello resta lì più di un
                // secondo e la voglia di toccare viene prima.
                if (indice < 0) { avvio(); return; }
                // Primo tocco su una battuta ancora in scrittura: la
                // completa invece di saltarla. È la convenzione di ogni
                // gioco con i dialoghi, e evita di perdere una riga per un
                // tocco di troppo.
                if (!completa) { mostraTutto(); return; }
                prossima();
            }

            function chiudi() {
                if (chiusa) return;
                chiusa = true;
                fermaBattitura();
                // La polvere gira su requestAnimationFrame: se non la si
                // ferma qui continua a disegnare su un canvas staccato
                // dal documento, per tutta la sessione.
                if (polvere) { polvere(); polvere = null; }
                // I listener globali non devono sopravvivere alla scena:
                // restare in ascolto della tastiera dopo che l'intermezzo
                // è finito vorrebbe dire intercettare la barra spaziatrice
                // per il resto della sessione.
                document.removeEventListener('keydown', tasti);
                scena.classList.remove('is-visibile');
                const via = () => {
                    scena.remove();
                    inCorso = false;
                    risolvi();
                    // Chi era in attesa parte solo ORA, a scena rimossa.
                    const successiva = coda.shift();
                    if (successiva) successiva();
                };
                if (veloce) via();
                else setTimeout(via, 450);
            }

            scena.addEventListener('click', (e) => {
                if (e.target === salta) return;
                avanza();
            });
            salta.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.NativeHaptics) NativeHaptics.light();
                chiudi();
            });
            document.addEventListener('keydown', tasti);

            // Il cartello resta un istante da solo, poi lascia il posto al
            // primo dialogo. Senza titolo si parte subito.
            let avviata = false;
            const avvio = () => {
                // Il cartello può finire in due modi — il suo tempo che
                // scade, o un tocco che lo salta — e i due possono
                // arrivare quasi insieme: senza questa guardia il
                // dialogo partirebbe due volte e la prima battuta
                // verrebbe saltata.
                if (avviata) return;
                avviata = true;
                if (cartello) {
                    cartello.style.transition = 'opacity 0.4s ease';
                    cartello.style.opacity = '0';
                    setTimeout(() => cartello.remove(), 420);
                }
                box.style.transition = 'opacity 0.35s ease';
                box.style.opacity = '1';
                prossima();
            };

            if (cartello) {
                // Il filo dorato si apre sotto al titolo: un solo dettaglio
                // animato, che dà l'idea del sipario che si alza.
                const filo = cartello.querySelector('.sc-cartello-filo');
                requestAnimationFrame(() => {
                    filo.style.transition = 'transform 0.9s ease';
                    filo.style.transform = 'scaleX(1)';
                });
                setTimeout(avvio, veloce ? 300 : CARTELLO_MS);
            } else {
                requestAnimationFrame(avvio);
            }
        });
    }

    window.StoryCutscene = { play: play };
})();
