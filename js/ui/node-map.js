/**
 * node-map.js — Disegna un sentiero di nodi su una mappa esplorabile.
 * =====================================================================
 * Componente condiviso, come js/ui/topbar.js e js/ui/page-loader.js.
 * Prende un elenco di nodi già posizionati e li disegna: pallini
 * collegati da una linea, su uno sfondo più grande dello schermo che si
 * esplora scorrendo o trascinando.
 *
 * NON decide niente. Non sa cosa sia una campagna, un torneo o un
 * duello: riceve nodi con `x`, `y`, `icona`, `label` e uno `stato`, e
 * avvisa chi lo usa quando se ne clicca uno. Tutta la logica (cosa sia
 * sbloccato, cosa succede al click) resta di chi lo chiama.
 *
 * Perché esiste invece di copiare la mappa dei tornei: quelle tre pagine
 * generano il percorso man mano, a bivi, ed è la loro natura — la
 * sorpresa è il punto. Un sentiero di storia è invece scritto in
 * anticipo, quindi qui non c'è niente da generare, solo da disegnare. I
 * tornei potrebbero un giorno passare da qui, ma migrarli adesso
 * vorrebbe dire riscrivere tre pagine grosse senza che nessuno l'abbia
 * chiesto.
 *
 * Gli stati previsti sono tre: 'fatta' (già superata), 'corrente'
 * (l'unica su cui si può cliccare) e 'bloccata'.
 */
(function () {
    'use strict';

    /**
     * Disegna la mappa dentro `contenitore`.
     *
     * opzioni:
     *   nodi        [{ id, x, y, icona, label, sottotitolo, stato }]
     *   larghezza   dimensioni del mondo in px (lo sfondo si ripete oltre)
     *   altezza
     *   sfondo      immagine di sfondo (facoltativa). Un percorso, oppure
     *               un ELENCO di candidati in ordine di preferenza: si usa
     *               il primo che esiste davvero. Serve a poter già puntare
     *               a un'immagine che il repository non ha ancora —
     *               "images/story/ww1.jpg" — tenendo come ripiego quella
     *               attuale: il giorno in cui il file viene aggiunto, la
     *               mappa lo usa da sola, senza toccare il codice.
     *   onSelect    chiamata col nodo cliccato
     *   cliccabili  quali stati rispondono al click. Default ['corrente'],
     *               cioè il comportamento di sempre: la sola tappa
     *               giocabile. La Storia ci aggiunge 'fatta', perché lì
     *               una tappa superata è un pezzo di racconto che si può
     *               voler rileggere — in un torneo, dove le tappe sono
     *               solo duelli già vinti, non ci sarebbe niente da
     *               riaprire.
     *
     * Un nodo può portare una `classe` in più, per chi lo deve riconoscere
     * o disegnare diverso (i passaggi fra due mappe della Storia).
     *
     * Un singolo nodo può smentire `cliccabili` con `apribile: false`.
     * Serve perché "superata" non vuol dire la stessa cosa per tutte le
     * tappe: nella Storia una scena già vista si rilegge volentieri, ma
     * un duello già vinto NON deve poter ripartire — lo si rigiocherebbe
     * e il suo esito verrebbe contato una seconda volta.
     */
    /**
     * Le tappe COMPLETATE dall'ultima volta che questa mappa e' stata disegnata (il giocatore torna da un duello o da una
     * scena e una tappa e' diventata 'fatta'): servono alla celebrazione WebGL (onda sul sentiero e scintille sul nodo).
     * Il ricordo di cio' che e' gia' stato visto sta in localStorage, per mappa (primo nodo + quanti sono): la PRIMA volta
     * che si vede una mappa non si celebra niente (le tappe gia' fatte non sono "appena completate"), e se le nuove sono
     * troppe insieme (una migrazione dell'avanzamento, non un duello vinto) si segnano viste senza festeggiare.
     * @returns {{x1:number,y1:number,x2:number,y2:number}[]}
     */
    function tappeAppenaCompletate(nodi) {
        if (!nodi.length) return [];
        const chiave = 'ygoMappaFatti:' + nodi[0].id + ':' + nodi.length;
        const fatte = nodi.filter((n) => n.stato === 'fatta').map((n) => String(n.id));
        let visti = null;
        try { visti = JSON.parse(localStorage.getItem(chiave) || 'null'); } catch (e) { visti = null; }
        try { localStorage.setItem(chiave, JSON.stringify(fatte)); } catch (e) { /* senza memoria non si celebra: va bene */ }
        if (!Array.isArray(visti)) return [];
        const nuove = nodi.filter((n) => n.stato === 'fatta' && visti.indexOf(String(n.id)) === -1);
        if (nuove.length === 0 || nuove.length > 3) return [];
        return nuove.map((b) => {
            const i = nodi.indexOf(b);
            const a = b.collegaDa
                ? nodi.find((n) => n.id === b.collegaDa)
                : [...nodi.slice(0, i)].reverse().find((n) => n.parallelo !== true);
            return { x1: a ? a.x : b.x, y1: a ? a.y : b.y, x2: b.x, y2: b.y };
        });
    }
    function render(contenitore, opzioni) {
        const el = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!el) return null;
        const o = opzioni || {};
        const nodi = o.nodi || [];

        el.classList.add('nm-viewport');
        el.innerHTML = '';

        // Tre livelli invece di uno, e il motivo è lo ZOOM:
        //   el        .nm-viewport — ferma, ritaglia, e ospita i comandi
        //   scroll    .nm-scroll   — l'unica cosa che scorre
        //   mondo     .nm-mondo    — grande quanto il mondo PER lo zoom:
        //                            è lui a dire allo scroll quanto c'è
        //                            da percorrere
        //   canvas    .nm-canvas   — grande quanto il mondo, ingrandito
        //                            con una transform
        // I comandi dello zoom devono restare fermi in un angolo: dentro
        // il contenitore che scorre se ne andrebbero via con la mappa,
        // perché `position: absolute` in un elemento con overflow scorre
        // insieme al contenuto.
        const scroll = document.createElement('div');
        scroll.className = 'nm-scroll';
        const mondo = document.createElement('div');
        mondo.className = 'nm-mondo';
        scroll.appendChild(mondo);

        const canvas = document.createElement('div');
        canvas.className = 'nm-canvas';
        // Il mondo è GRANDE QUANTO IL DISEGNO, anche quando la finestra è
        // più grande: a riempirla ci pensa lo zoom (vedi zoomDiCopertura),
        // che ingrandisce disegno e nodi INSIEME.
        //
        // Prima qui c'era un `Math.max(mondo, finestra)`, nato quando lo
        // zoom non esisteva: su un monitor grande (segnalato su un 2K da
        // 27") il mondo si allargava fino alla finestra, il disegno steso
        // al 100% lo seguiva, ma i nodi restavano alle coordinate del
        // disegno originale — tutto il sentiero schiacciato nella parte in
        // alto a sinistra, con le tratte "troppo corte" e i nodi fuori dai
        // loro luoghi. Su un telefono la finestra è più piccola del
        // disegno e il difetto non si vedeva.
        // Senza dimensioni dichiarate si ricade sulla finestra.
        const larghezza = o.larghezza || el.clientWidth || 0;
        const altezza = o.altezza || el.clientHeight || 0;
        canvas.style.width = larghezza + 'px';
        canvas.style.height = altezza + 'px';
        // Lo sfondo non blocca il disegno: la mappa compare subito sul
        // proprio fondo scuro e l'immagine si posa quando è pronta.
        //
        // DUE MODI DI STENDERLA, e la differenza si vede eccome:
        //   - il PRIMO candidato è la mappa DISEGNATA della campagna, e va
        //     mostrata INTERA, una volta sola, stesa su tutto il mondo. Una
        //     mappa piastrellata mostra il mare due volte con una cucitura
        //     in mezzo — visto davvero, sulla mappa di Freedom;
        //   - i candidati SUCCESSIVI sono ripieghi presi in prestito dalle
        //     arene: sono texture, e vanno ripetute, perché stirarne una da
        //     1536px su un mondo alto 2600 la renderebbe una poltiglia.
        // Il modo si deduce da QUALE candidato ha vinto, senza un campo in
        // più da tenere allineato nei dati.
        primaImmagineEsistente(o.sfondo).then((esito) => {
            if (!esito || !canvas.isConnected) return;
            const velo = 'linear-gradient(180deg, rgba(6,7,12,0.45), rgba(6,7,12,0.65))';
            canvas.style.backgroundImage = `${velo}, url('${esito.src}')`;
            if (esito.indice === 0) {
                canvas.style.backgroundSize = '100% 100%, 100% 100%';
                canvas.style.backgroundRepeat = 'no-repeat, no-repeat';
            }
            // Gli effetti ambientali WebGL della mappa disegnata (nebbia, luci, vento...):
            // un canvas dentro il mondo, tra lo sfondo e le linee, che scorre e si ingrandisce
            // con la mappa. Solo per la mappa disegnata (candidato 0), mai per le texture di
            // ripiego, e solo se la mappa ha una voce in js/ui/ambiente-mappe-storia.js.
            if (esito.indice === 0 && window.AmbienteWebGL && typeof window.AmbienteWebGL.haMappa === 'function') {
                const nomeMappa = String(esito.src).split('?')[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '');
                if (window.AmbienteWebGL.haMappa(nomeMappa)) {
                    window.AmbienteWebGL.avviaMappa(nomeMappa, canvas, { larghezza: larghezza, altezza: altezza });
                }
            }
        });

        // Le linee stanno in un SVG con viewBox uguale al mondo IN PX:
        // pallini e linee usano così lo stesso sistema di coordinate e
        // non possono sfasarsi quando il contenitore cambia dimensione.
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'nm-lines');
        svg.setAttribute('viewBox', `0 0 ${larghezza} ${altezza}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        // Le tratte percorse e quella verso la tappa corrente, per la luce WebGL del sentiero (vedi sotto).
        const tratteLuce = [];
        for (let i = 1; i < nodi.length; i++) {
            const b = nodi[i];
            const a = b.collegaDa
                ? nodi.find((n) => n.id === b.collegaDa)
                : [...nodi.slice(0, i)].reverse().find((n) => n.parallelo !== true);
            if (!a) continue;
            const linea = document.createElementNS(svgNS, 'line');
            linea.setAttribute('x1', a.x); linea.setAttribute('y1', a.y);
            linea.setAttribute('x2', b.x); linea.setAttribute('y2', b.y);
            // Una tratta è "percorsa" se porta a un nodo già superato:
            // così la linea racconta da sola fin dove sei arrivato. La
            // tratta che porta alla tappa CORRENTE è invece il passo che
            // stai per fare, e si muove: è l'unico tratto animato della
            // mappa, quindi l'occhio ci va da solo anche su un sentiero
            // lungo duemila pixel.
            let classe = 'nm-line';
            if (b.stato === 'fatta') classe += ' nm-line--fatta';
            else if (b.stato === 'corrente' || b.stato === 'disponibile') classe += ' nm-line--prossima';
            linea.setAttribute('class', classe);
            svg.appendChild(linea);
            if (b.stato === 'fatta') tratteLuce.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, tipo: 'fatta' });
            else if (b.stato === 'corrente' || b.stato === 'disponibile') tratteLuce.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, tipo: 'prossima' });
        }
        canvas.appendChild(svg);
        // La luce del sentiero e il faro sulla tappa corrente, in WebGL: sopra le linee, sotto i nodi (che si
        // aggiungono dopo, quindi stanno sopra nell'ordine del DOM). Se non si puo' restano le sole linee SVG.
        if (window.MappaPercorsoGL) {
            const nodoCorrente = nodi.find((n) => n.stato === 'corrente');
            const glPercorso = MappaPercorsoGL.crea({ larghezza: larghezza, altezza: altezza, tratte: tratteLuce, corrente: nodoCorrente ? { x: nodoCorrente.x, y: nodoCorrente.y } : null, celebrazioni: tappeAppenaCompletate(nodi) });
            if (glPercorso) canvas.appendChild(glPercorso);
        }

        const cliccabili = o.cliccabili || ['corrente'];
        nodi.forEach((nodo) => {
            const el2 = document.createElement('button');
            el2.type = 'button';
            const apribile = nodo.apribile === false
                ? false
                : cliccabili.indexOf(nodo.stato) !== -1;
            el2.className = `nm-node nm-node--${nodo.stato || 'bloccata'}` + (apribile ? ' nm-node--apribile' : '')
                + (nodo.classe ? ' ' + nodo.classe : '');
            el2.style.left = nodo.x + 'px';
            el2.style.top = nodo.y + 'px';
            el2.disabled = !apribile;
            const dot = document.createElement('span');
            dot.className = 'nm-dot';
            if (nodo.stato === 'bloccata') {
                dot.textContent = '🔒';
            } else if (nodo.immagine) {
                // Il volto di chi ti aspetta dice molto piu' di
                // un'emoji: si riconosce l'avversario prima ancora di
                // leggerne il nome. Se l'immagine non c'e' (un
                // personaggio senza ritratto), si ricade sull'icona —
                // mai su un riquadro rotto.
                const img = document.createElement('img');
                img.className = 'nm-ritratto';
                img.src = nodo.immagine;
                img.alt = '';
                img.addEventListener('error', () => {
                    img.remove();
                    dot.textContent = nodo.icona || '•';
                });
                dot.appendChild(img);
                dot.classList.add('nm-dot--ritratto');
            } else {
                dot.textContent = nodo.icona || '•';
            }
            const label = document.createElement('span');
            label.className = 'nm-label';
            // Un nodo bloccato non rivela chi ci aspetta: sarebbe come
            // leggere l'ultima pagina prima della prima.
            label.textContent = nodo.stato === 'bloccata' ? '???' : (nodo.label || '');
            el2.append(dot, label);
            // Seconda riga, più piccola e facoltativa: serve quando il
            // nome sul nodo non basta a dire DOVE si è. Su una mappa
            // geografica lo stesso avversario torna in capitoli diversi
            // (il Kaiserjäger sul Carso, sull'Altopiano, sul Grappa) e
            // senza il luogo i tre nodi sono indistinguibili. Nascosta su
            // un nodo bloccato come l'etichetta, per lo stesso motivo.
            if (nodo.sottotitolo && nodo.stato !== 'bloccata') {
                const sub = document.createElement('span');
                sub.className = 'nm-sublabel';
                sub.textContent = nodo.sottotitolo;
                el2.appendChild(sub);
            }
            if (apribile && typeof o.onSelect === 'function') {
                el2.addEventListener('click', () => {
                    if (window.NativeHaptics) NativeHaptics.light();
                    o.onSelect(nodo);
                });
            }
            canvas.appendChild(el2);
        });

        mondo.appendChild(canvas);
        el.appendChild(scroll);
        abilitaTrascinamento(scroll, el);
        abilitaZoom(el, scroll, mondo, canvas, larghezza, altezza);
        centraSu(el, nodi.find((n) => n.stato === 'corrente') || nodi[nodi.length - 1], { morbido: true });
        return canvas;
    }

    /** Fin dove si può ingrandire. In basso non serve un numero: vedi sotto. */
    const ZOOM_MAX = 2.2;
    /** Di quanto cambia lo zoom a ogni tocco dei pulsanti + e −. */
    const ZOOM_PASSO = 1.25;

    /**
     * Zoom della mappa: pulsanti, rotellina col tasto Ctrl, e pizzico a
     * due dita. Il valore vive sull'elemento (`el.__nmZoom`) invece che in
     * una variabile del modulo perché ci può essere più di una mappa nella
     * stessa pagina, e perché `centraSu` — che è pubblica — deve poterlo
     * leggere per convertire le coordinate del mondo in pixel a schermo.
     *
     * Come funziona: il canvas resta grande quanto il mondo e viene
     * ingrandito con una transform (l'unica cosa che il browser sa animare
     * senza rifare il layout di centinaia di nodi); è `.nm-mondo`, il suo
     * contenitore, a crescere davvero, ed è quello a dire al contenitore
     * che scorre quanto c'è da percorrere. Ridimensionare invece ogni nodo
     * significherebbe ricalcolare il layout dell'intera mappa a ogni
     * frame di un pizzico.
     */
    function abilitaZoom(el, scroll, mondo, canvas, larghezza, altezza) {
        /**
         * IL MINIMO: lo zoom sotto il quale comparirebbero zone vuote.
         *
         * Non è un numero fisso ed è calcolato con `max`, non con `min`.
         * La differenza è tutta qui:
         *   min(w/W, h/H)  fa entrare TUTTA la mappa — e quindi lascia per
         *                  forza due bande vuote sul lato in eccesso,
         *                  perché mappa e finestra non hanno mai la stessa
         *                  forma;
         *   max(w/W, h/H)  fa COPRIRE la finestra: la mappa sborda da
         *                  entrambi i lati, se ne vede una parte sola, e
         *                  di vuoto non ce n'è mai.
         * Il secondo è quello giusto: sotto quel valore il mondo
         * diventerebbe più piccolo della finestra su almeno un asse e si
         * vedrebbe il fondo nero attorno.
         *
         * Dipende dalla FINESTRA, quindi cambia da solo ruotando lo
         * schermo: è ricalcolato ad ogni chiamata invece di essere messo
         * da parte, e `adattaAllaFinestra` lo rilegge dopo ogni resize.
         */
        function zoomDiCopertura() {
            if (!scroll.clientWidth || !scroll.clientHeight) return 1;
            return Math.max(scroll.clientWidth / larghezza, scroll.clientHeight / altezza);
        }
        function limita(zoom) {
            // Il minimo ha la precedenza sul massimo: su una finestra
            // enorme la copertura può superare ZOOM_MAX, e in quel caso
            // rispettare il massimo vorrebbe dire mostrare il vuoto.
            return Math.max(zoomDiCopertura(), Math.min(ZOOM_MAX, zoom));
        }

        /** Scrive lo zoom senza decidere nulla: dimensioni, scala, etichetta. */
        function imposta(zoom) {
            el.__nmZoom = zoom;
            mondo.style.width = (larghezza * zoom) + 'px';
            mondo.style.height = (altezza * zoom) + 'px';
            canvas.style.transform = 'scale(' + zoom + ')';
            // I NODI NON SEGUONO LO ZOOM FINO IN FONDO.
            //
            // La transform sul canvas scala tutto quello che c'è dentro,
            // nodi compresi: giusto per il disegno della mappa, sbagliato
            // per i pallini. Misurato: rimpicciolendo al minimo, un
            // pallino passava da 56px a 20 e il suo nome a meno di cinque
            // pixel — né leggibile né toccabile, proprio nella vista
            // d'insieme in cui serve capire dove si è.
            //
            // Qui ognuno si ri-scala in senso opposto della RADICE dello
            // zoom, che è la via di mezzo fra i due estremi sbagliati:
            // seguirlo del tutto (illeggibili da lontano) e non seguirlo
            // affatto (grandi uguali, quindi ammassati uno sull'altro
            // quando la mappa si stringe). Così a metà zoom un nodo resta
            // grande il 70%, e continua a rimpicciolire — solo più piano
            // della mappa sotto.
            //
            // La POSIZIONE non cambia di una virgola: la scala agisce
            // attorno al centro del nodo, che resta inchiodato al suo
            // punto della mappa (verificato a ogni zoom e dopo ogni
            // rotazione).
            const controScala = Math.min(2.2, Math.max(0.6, 1 / Math.sqrt(zoom)));
            canvas.style.setProperty('--nm-contro-scala', controScala);
            if (etichetta) etichetta.textContent = Math.round(zoom * 100) + '%';
        }

        function applica(zoom, fuocoX, fuocoY) {
            const precedente = el.__nmZoom || 1;
            const nuovo = limita(zoom);
            if (Math.abs(nuovo - precedente) < 0.0005) return;

            // Il punto del MONDO che sta sotto al centro dello sguardo (o
            // sotto le dita) deve restarci anche dopo: senza questo, ogni
            // zoom riporta la vista in un punto a caso e la mappa diventa
            // impossibile da esplorare.
            const cx = (fuocoX === undefined) ? scroll.clientWidth / 2 : fuocoX;
            const cy = (fuocoY === undefined) ? scroll.clientHeight / 2 : fuocoY;
            const mondoX = (scroll.scrollLeft + cx) / precedente;
            const mondoY = (scroll.scrollTop + cy) / precedente;

            imposta(nuovo);
            scroll.scrollLeft = mondoX * nuovo - cx;
            scroll.scrollTop = mondoY * nuovo - cy;
        }
        el.__nmApplicaZoom = applica;

        /**
         * ROTAZIONE DELLO SCHERMO (e qualunque altro cambio di dimensione).
         *
         * Ruotando il telefono la finestra cambia forma, quindi cambia
         * anche lo zoom minimo che evita le zone vuote: uno zoom che in
         * verticale copriva tutto, in orizzontale può lasciare scoperte le
         * fasce laterali. Qui si rilegge il minimo e, se lo zoom corrente
         * gli è finito sotto, lo si rialza — l'unico modo di mantenere la
         * promessa "mai zone vuote" senza impedire lo zoom prima ancora
         * che serva.
         *
         * Il punto che si stava guardando viene tenuto al centro: dopo una
         * rotazione ci si aspetta di essere ancora dov'eravamo, non in
         * cima alla mappa.
         */
        function adattaAllaFinestra() {
            if (!scroll.clientWidth || !scroll.clientHeight) return;
            const z = el.__nmZoom || 1;
            const centroX = (scroll.scrollLeft + scroll.clientWidth / 2) / z;
            const centroY = (scroll.scrollTop + scroll.clientHeight / 2) / z;
            imposta(limita(z));
            const nuovo = el.__nmZoom;
            scroll.scrollLeft = centroX * nuovo - scroll.clientWidth / 2;
            scroll.scrollTop = centroY * nuovo - scroll.clientHeight / 2;
        }

        // Un solo ascoltatore per mappa, anche se la pagina la ridisegna
        // molte volte: `render()` svuota il DOM ma non toglierebbe i
        // listener su window, che si accumulerebbero uno per render.
        if (el.__nmResize) window.removeEventListener('resize', el.__nmResize);
        let attesaResize = null;
        el.__nmResize = () => {
            // Su rotazione il browser riporta le nuove dimensioni in due
            // tempi: aspettare un attimo evita di calcolare il minimo su
            // una finestra a metà strada.
            clearTimeout(attesaResize);
            attesaResize = setTimeout(adattaAllaFinestra, 120);
        };
        window.addEventListener('resize', el.__nmResize);

        const comandi = document.createElement('div');
        comandi.className = 'nm-zoom';
        const etichetta = document.createElement('span');
        etichetta.className = 'nm-zoom-valore';
        etichetta.textContent = '100%';

        function pulsante(testo, titolo, onClick) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'nm-zoom-btn';
            b.textContent = testo;
            b.title = titolo;
            b.setAttribute('aria-label', titolo);
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.NativeHaptics) NativeHaptics.light();
                onClick();
            });
            return b;
        }

        comandi.append(
            pulsante('−', 'Riduci', () => applica((el.__nmZoom || 1) / ZOOM_PASSO)),
            etichetta,
            pulsante('+', 'Ingrandisci', () => applica((el.__nmZoom || 1) * ZOOM_PASSO)),
            // "Quanta più mappa possibile", non "tutta la mappa": lo zoom
            // si ferma dove la mappa smette di riempire lo schermo. Una
            // vista d'insieme completa mostrerebbe per forza del vuoto ai
            // lati, ed è proprio la cosa che non deve succedere.
            pulsante('⤢', 'Più mappa possibile', () => applica(zoomDiCopertura()))
        );
        el.appendChild(comandi);

        // Rotellina SOLO con Ctrl/Cmd: da sola deve continuare a far
        // scorrere la mappa, che è quello che ci si aspetta da un
        // contenitore lungo. È la stessa convenzione di qualunque mappa
        // sul web.
        scroll.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const r = scroll.getBoundingClientRect();
            const fattore = Math.exp(-e.deltaY * 0.0015);
            applica((el.__nmZoom || 1) * fattore, e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });

        // Pizzico a due dita. Si seguono i puntatori a mano invece di
        // affidarsi agli eventi `gesture*`, che esistono solo su Safari.
        const dita = new Map();
        let distanzaIniziale = 0;
        let zoomIniziale = 1;
        scroll.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (dita.size === 2) {
                const [a, b] = [...dita.values()];
                distanzaIniziale = Math.hypot(a.x - b.x, a.y - b.y);
                zoomIniziale = el.__nmZoom || 1;
            }
        });
        scroll.addEventListener('pointermove', (e) => {
            if (!dita.has(e.pointerId)) return;
            dita.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (dita.size !== 2 || !distanzaIniziale) return;
            e.preventDefault();
            const [a, b] = [...dita.values()];
            const distanza = Math.hypot(a.x - b.x, a.y - b.y);
            const r = scroll.getBoundingClientRect();
            applica(
                zoomIniziale * (distanza / distanzaIniziale),
                (a.x + b.x) / 2 - r.left,
                (a.y + b.y) / 2 - r.top
            );
        }, { passive: false });
        const alzaDito = (e) => {
            dita.delete(e.pointerId);
            if (dita.size < 2) distanzaIniziale = 0;
        };
        scroll.addEventListener('pointerup', alzaDito);
        scroll.addEventListener('pointercancel', alzaDito);

        // Stato di partenza: grandezza naturale, cioè esattamente la mappa
        // di sempre, centrata sulla tappa corrente. Un primo tentativo
        // apriva già rimpicciolito quanto bastava a vedere tutta la
        // larghezza, ma su un telefono voleva dire aprire al 24%, con i
        // nomi delle tappe illeggibili: la richiesta era POTER cambiare
        // ingrandimento, non partire da un altro.
        //
        // `limita` anche qui, e non per prudenza: su una finestra molto
        // larga (un desktop affiancato a una mappa stretta) la grandezza
        // naturale lascerebbe già del vuoto ai lati all'apertura.
        imposta(limita(1));
    }

    /**
     * Il primo fra i candidati che esiste davvero.
     *
     * Si prova a caricarlo invece di chiedere al server se c'è: una fetch
     * non direbbe nulla di utile su file://, dove il gioco si apre anche
     * con un doppio click. Stesso schema di `risolviSfondo` in
     * js/ui/story-cutscene.js — sono due componenti indipendenti, e
     * mettere in comune quattro righe costringerebbe a caricare l'uno per
     * avere l'altro.
     */
    function primaImmagineEsistente(candidati) {
        const lista = (Array.isArray(candidati) ? candidati : [candidati])
            .filter((v) => typeof v === 'string' && v);
        if (lista.length === 0) return Promise.resolve(null);
        return new Promise((risolvi) => {
            let i = 0;
            const prova = () => {
                if (i >= lista.length) { risolvi(null); return; }
                const indice = i++;
                const src = lista[indice];
                const sonda = new Image();
                // Torna anche QUALE candidato ha vinto: chi chiama ne ha
                // bisogno per sapere se sta guardando la mappa disegnata
                // (la prima) o un ripiego preso da un'arena.
                sonda.onload = () => risolvi({ src: src, indice: indice });
                sonda.onerror = prova;
                sonda.src = src;
            };
            prova();
        });
    }

    /**
     * Porta il nodo indicato al centro della finestra. Senza, una mappa
     * alta duemila pixel si apre sempre in cima e il giocatore deve
     * cercarsi da solo il punto in cui era arrivato.
     *
     * Con `morbido` la camera non ci salta sopra: si posiziona un po'
     * più in basso e poi scivola in posizione. È un movimento breve, di
     * un centinaio di pixel — NON uno scorrimento animato dall'inizio
     * della mappa, che su un sentiero lungo duemila pixel durerebbe
     * secondi e sembrerebbe una pagina che scappa. Serve solo a far
     * capire che la mappa è un luogo in cui ci si muove, invece di
     * comparire già ferma.
     */
    function centraSu(viewport, nodo, opzioni) {
        if (!nodo) return;
        // A scorrere è il livello interno, non la finestra: chi chiama
        // passa il contenitore che conosce (#mappaViewport) e non deve
        // sapere com'è fatta la mappa dentro.
        const scroll = viewport.querySelector('.nm-scroll') || viewport;
        // Le coordinate dei nodi sono nel MONDO: con lo zoom attivo vanno
        // moltiplicate, altrimenti si centra su un punto sbagliato tanto
        // quanto lo zoom è lontano da 1.
        const zoom = viewport.__nmZoom || 1;
        const x = Math.max(0, nodo.x * zoom - scroll.clientWidth / 2);
        const y = Math.max(0, nodo.y * zoom - scroll.clientHeight / 2);
        const morbido = opzioni && opzioni.morbido
            && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            && typeof scroll.scrollTo === 'function';
        if (!morbido) {
            scroll.scrollLeft = x;
            scroll.scrollTop = y;
            return;
        }
        // Si parte da sotto il bersaglio, mai da sopra: la storia sale
        // verso l'alto della mappa, quindi arrivare dal basso è il verso
        // in cui si sta già andando.
        scroll.scrollLeft = x;
        scroll.scrollTop = Math.max(0, y + 110);
        requestAnimationFrame(() => {
            scroll.scrollTo({ left: x, top: y, behavior: 'smooth' });
        });
    }

    /**
     * Trascinamento col mouse. Su touch non serve: il browser fa già
     * scorrere un contenitore con overflow, e intercettare il tocco qui
     * romperebbe quello che funziona da solo.
     */
    function abilitaTrascinamento(viewport, el) {
        let attivo = false, partenzaX = 0, partenzaY = 0, scrollX = 0, scrollY = 0;
        viewport.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse') return;
            // Un click su un nodo deve restare un click, non un
            // trascinamento da zero pixel.
            if (e.target.closest('.nm-node')) return;
            // Nemmeno i comandi dello zoom devono trascinare la mappa.
            if (e.target.closest('.nm-zoom')) return;
            attivo = true;
            partenzaX = e.clientX; partenzaY = e.clientY;
            scrollX = viewport.scrollLeft; scrollY = viewport.scrollTop;
            viewport.classList.add('nm-dragging');
        });

        // I due ascoltatori su window vanno TOLTI quando la mappa viene
        // ridisegnata: `render()` svuota il DOM, ma questi sopravvivono e
        // se ne accumulerebbe una coppia per ogni render — e la pagina
        // della Storia ridisegna la mappa ad ogni tappa superata, ad ogni
        // ritorno da un duello e ad ogni apertura di una scena.
        if (el && el.__nmDrag) {
            window.removeEventListener('pointermove', el.__nmDrag.muovi);
            window.removeEventListener('pointerup', el.__nmDrag.alza);
        }
        const muovi = (e) => {
            if (!attivo) return;
            viewport.scrollLeft = scrollX - (e.clientX - partenzaX);
            viewport.scrollTop = scrollY - (e.clientY - partenzaY);
        };
        const alza = () => {
            attivo = false;
            viewport.classList.remove('nm-dragging');
        };
        if (el) el.__nmDrag = { muovi: muovi, alza: alza };
        window.addEventListener('pointermove', muovi);
        window.addEventListener('pointerup', alza);
    }

    window.NodeMap = { render: render, centraSu: centraSu };
})();
