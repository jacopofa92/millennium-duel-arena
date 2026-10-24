/**
 * monster-hologram.js — un ologramma in finto 3D sopra ogni mostro
 * scoperto sul Terreno, stile Master Duel.
 * =====================================================================
 *
 * GENERICO PER TUTTE LE CARTE, NESSUN LAVORO PER CARTA. Serve solo
 * l'illustrazione — che `getCardImagePath(card)` (js/ui/card-renderer.js)
 * risolve già centralmente per id, comprese le carte personalizzate e i
 * set non-Yu-Gi-Oh — più la posizione dello slot a schermo. Non c'è nulla
 * da dichiarare sulla singola carta, né oggi né per una carta aggiunta
 * domani. (Se un giorno servisse un trattamento dedicato per UNA carta,
 * il precedente esiste già: `VisualEffects.getVideoFor` usa un filmato
 * dedicato se c'è e ricade sul generico altrimenti.)
 *
 * PERCHÉ VIVE FUORI DAL TERRENO, ed è la parte che conta davvero.
 * `renderFields()` (game-flow.js) ricostruisce l'INTERO Terreno da zero
 * ad ogni `updateUI()`. Misurato su un duello vero: 23 ricostruzioni in
 * 27,5 secondi — circa una al secondo — con 277 elementi carta ricreati.
 * Un ologramma appeso allo slot verrebbe quindi distrutto e ricreato di
 * continuo: l'animazione ripartirebbe da capo ogni volta e si vedrebbe
 * uno sfarfallio costante (è la stessa causa del lampo "Carta coperta"
 * già corretto altrove).
 *
 * Quindi: livello tutto suo (`#monsterHologramLayer`, `position: fixed`
 * fuori dal campo) e aggiornamento INCREMENTALE per uid — si creano solo
 * gli ologrammi dei mostri nuovi, si tolgono solo quelli spariti, e per
 * tutti gli altri si aggiorna la sola posizione. Gli elementi
 * sopravvivono intatti alle ricostruzioni del Terreno, animazione
 * compresa. Stesso principio di posizionamento per `data-uid` già usato
 * da `renderEquipLinks()`.
 *
 * QUANDO SI VEDE. Ha un'impostazione TUTTA SUA, "Visualizzazione
 * ologramma" (js/ui/hologram-setting.js), accesa di default e
 * indipendente dai "Dettagli video" — vedi lì il perché non è agganciata
 * a quelli. Resta comunque disattivabile: è un effetto continuo e ce ne
 * possono essere fino a 10 insieme.
 */
(function () {
    'use strict';

    const LAYER_ID = 'monsterHologramLayer';
    // Geometria, trovata guardando il risultato invece che a tavolino.
    // Primo tentativo: stessa larghezza della carta e altezza 1.9× —
    // l'illustrazione (all'incirca quadrata) veniva ritagliata a una
    // striscia verticale e leggeva come una seconda copia della carta,
    // non come una proiezione. Ora è LARGA più della carta e poco più
    // alta, con l'arte contenuta invece che ritagliata.
    // SU SCHERMO LARGO LA PROIEZIONE È PIÙ GRANDE, e non è un vezzo:
    // queste misure sono in frazioni della CARTA, e su desktop la carta è
    // proporzionalmente molto più piccola che su un telefono. Misurato a
    // parità di impostazione accesa: lo stesso ologramma occupava l'8,5%
    // della larghezza dello schermo su desktop contro il 17,5% su
    // telefono — c'era, ma non si notava, ed è il motivo per cui sembrava
    // spento di là. Alzando le frazioni su desktop l'effetto torna a
    // pesare quanto pesa in mano.
    // Sul telefono la base prima cadeva al 45% dell'altezza della carta,
    // cioe' appena sopra la meta': visivamente la figura sembrava partire
    // dal centro. Un sollevamento di 0.45 la porta al 55%, poco sotto la
    // meta', conservando pero' abbastanza carta sotto da leggere il varco.
    // Larghezza e altezza restano quelle gia' calibrate per mobile.
    // Poi abbassata ancora un po' su richiesta dell'utente (2026-10-16, "un
    // po' più in basso ma non troppo"): 0.32, cioè base al 68% della carta.
    // Non scendere oltre: su mobile ATK/DEF sta sul FONDO della carta (vedi
    // .field-stats-badge in duelMonstersCore.html) e la base dell'ologramma
    // deve restare sopra quei numeri, non coprirli.
    const MISURE_COMPATTE = { larghezza: 1.5, altezza: 1.25, sollevamento: 0.32 };
    // Ritoccate dopo averle viste su un monitor 2K (segnalazione
    // dell'utente: "troppo grandi e troppo oltre la carta"). Con 2.0 × 1.7
    // e il fondo sollevato dell'85% della carta, la figura partiva quasi
    // dal bordo superiore della carta e saliva di una carta e mezza oltre:
    // quelle dei propri mostri finivano a metà fra le due file, staccate
    // dalla loro carta. Ora il fondo resta a un terzo dell'altezza della
    // carta, così la figura nasce DALLA carta e la copre per due terzi, e
    // sopra ne esce di poco più di mezza carta.
    const MISURE_AMPIE = { larghezza: 1.6, altezza: 1.35, sollevamento: 0.35 };
    // La soglia è la stessa del breakpoint che il duello usa già ovunque
    // per distinguere "telefono" da "schermo vero" (vedi i @media di
    // duelMonstersCore.html): un valore in più, tutto suo, si
    // disallineerebbe al primo ritocco.
    const SOGLIA_SCHERMO_AMPIO = 900;

    function misure() {
        return window.innerWidth > SOGLIA_SCHERMO_AMPIO ? MISURE_AMPIE : MISURE_COMPATTE;
    }

    /** Gli ologrammi vivi adesso, per uid — è questa mappa a evitare i redraw. */
    const vivi = new Map();
    let sospeso = false;

    function layer() {
        let el = document.getElementById(LAYER_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = LAYER_ID;
            document.body.appendChild(el);
        }
        return el;
    }

    function attivo() {
        // Impostazione DEDICATA (js/ui/hologram-setting.js), non più i
        // "Dettagli video": quelli partono da "Normali", e agganciarci un
        // effetto che deve essere acceso di default lo avrebbe lasciato
        // invisibile alla stragrande maggioranza dei giocatori.
        // Se il modulo non è caricato l'effetto resta spento: una pagina
        // che non lo include non deve ritrovarselo addosso.
        return !!(window.HologramSetting && typeof HologramSetting.isAttivo === 'function' && HologramSetting.isAttivo());
    }

    function creaOlogramma(card, owner) {
        const item = document.createElement('div');
        item.className = 'mh-item';
        item.dataset.uid = card.uid;
        item.dataset.owner = owner;

        const corpo = document.createElement('div');
        corpo.className = 'mh-corpo';

        const art = document.createElement('img');
        art.className = 'mh-art';
        // alt vuoto: immagine dichiaratamente decorativa (la carta vera è
        // lì sotto, leggibile). Stessa ragione già applicata alle <img>
        // di card-renderer.js — un alt non vuoto viene DIPINTO mentre
        // l'immagine carica, e qui apparirebbe a mezz'aria.
        art.alt = '';
        art.src = window.getCardImagePath ? getCardImagePath(card) : '';
        // Se l'illustrazione non esiste, niente ologramma: una figura
        // vuota sarebbe peggio dell'assenza.
        art.onerror = () => rimuovi(card.uid);

        const scan = document.createElement('div');
        scan.className = 'mh-scan';
        const base = document.createElement('div');
        base.className = 'mh-base';

        corpo.appendChild(art);
        corpo.appendChild(scan);
        item.appendChild(corpo);
        item.appendChild(base);
        layer().appendChild(item);
        return item;
    }

    function rimuovi(uid) {
        const item = vivi.get(uid);
        if (item && item.parentNode) item.parentNode.removeChild(item);
        vivi.delete(uid);
    }

    /**
     * Dove sta l'ologramma di questa carta, in px dalla finestra: { left, top, w, h }, o null se la carta non è
     * ancora disposta. Lo usano sia gli ologrammi CSS (posiziona) sia quelli WebGL
     * (js/ui/monster-hologram-webgl.js), così le due versioni stanno sempre nello stesso punto.
     */
    function calcolaRect(cardEl) {
        const r = cardEl.getBoundingClientRect();
        // Un rect a 0x0 (carta non ancora disposta dal layout) darebbe un
        // ologramma grande zero in alto a sinistra: si salta, stesso
        // accorgimento di renderEquipLinks().
        if (r.width === 0 && r.height === 0) return null;
        const m = misure();
        // Un mostro in DIFESA è la stessa carta ruotata di 90°: il suo
        // riquadro a schermo è orizzontale. Misurato prima di questa
        // correzione (segnalazione dell'utente, "bug con gli olografici
        // quando si scopre una carta"): su una carta 116×79 la proiezione
        // usciva 185×107, bassa e larga, schiacciata sulla carta. Le misure
        // si prendono quindi dalla carta "in piedi" (lati scambiati),
        // centrate sul suo riquadro vero; il sollevamento resta sull'altezza
        // VISIBILE, così la figura nasce comunque dalla carta.
        const inDifesa = cardEl.classList.contains('defense-pos');
        const larga = inDifesa ? r.height : r.width;
        const alta = inDifesa ? r.width : r.height;
        const w = larga * m.larghezza;
        const h = alta * m.altezza;
        // Centrato sulla carta e sollevato: la base del fascio resta
        // dentro la carta, così la figura sembra uscire DA LÌ.
        return {
            left: Math.round(r.left + r.width / 2 - w / 2),
            top: Math.round(r.bottom - h - r.height * m.sollevamento),
            w: Math.round(w),
            h: Math.round(h)
        };
    }

    /** Riporta l'ologramma sopra la carta, senza toccarne le animazioni. */
    function posiziona(item, cardEl) {
        const q = calcolaRect(cardEl);
        if (!q) return false;
        item.style.left = `${q.left}px`;
        item.style.width = `${q.w}px`;
        item.style.height = `${q.h}px`;
        item.style.top = `${q.top}px`;
        return true;
    }

    /**
     * La carta da misurare, e se sta ancora GIRANDO.
     *
     * Scoprire un mostro (Flip Summon, o un attacco contro un coperto) lo
     * fa girare in 3D: CardRenderer.playFlipReveal mette nella casella un
     * contenitore con DUE copie della carta, dorso e fronte, che ruotano.
     * Prima l'ologramma nasceva all'istante — lo stato dice già "scoperto"
     * — sopra una carta ancora di dorso a metà giro (misurato: presente
     * dopo 30 ms), e veniva misurato sulla faccia che ruotava. Si guarda
     * invece il contenitore, che resta fermo, e finché il giro non finisce
     * l'ologramma aspetta: la proiezione arriva DOPO la rivelazione, che è
     * il momento da vedere.
     */
    const inAttesaDelGiro = new Set();
    function cartaDaMisurare(cardEl, uid) {
        const giro = cardEl.closest('.card-flip-outer');
        if (!giro) return { el: cardEl, gira: false };
        const interno = giro.querySelector('.card-flip-inner');
        const animazioni = interno && typeof interno.getAnimations === 'function' ? interno.getAnimations() : [];
        const inCorso = animazioni.filter((a) => a.playState === 'running' || a.playState === 'pending');
        if (inCorso.length && !inAttesaDelGiro.has(uid)) {
            inAttesaDelGiro.add(uid);
            Promise.all(inCorso.map((a) => a.finished.catch(() => null)))
                .then(() => { inAttesaDelGiro.delete(uid); sync(); });
        }
        // A giro finito si misura la FACCIA (davanti): è lei a portare
        // l'eventuale rotazione della Difesa, il contenitore resta in piedi.
        return { el: giro.querySelector('.card-flip-face-front') || giro, gira: inCorso.length > 0 };
    }

    /**
     * Allinea gli ologrammi allo stato attuale del Terreno. Chiamata alla
     * fine di updateUI() e sul resize — mai un "ridisegna tutto": crea,
     * toglie e riposiziona solo ciò che è cambiato davvero.
     */
    /**
     * CARTE SETTATE (coperte) sul Terreno, per il riflesso WebGL (vedi monster-hologram-webgl.js). Si guarda il DOM, cioe'
     * cio' che e' VISIVAMENTE coperto adesso — mostri in Difesa coperta, Magie/Trappole Set, Magia Terreno coperta — e di
     * ogni carta si prende SOLO il posto: la chiave dice lato, tipo di casella e numero, mai la carta. Cosi' e' impossibile
     * che il riflesso racconti qualcosa di una carta nascosta.
     */
    const settatePrima = new Map();
    function settateInCampo() {
        const lista = [];
        ['playerFieldBoard', 'botFieldBoard'].forEach((id) => {
            const board = document.getElementById(id);
            if (!board) return;
            board.querySelectorAll('.field-slot[data-type="monster"], .field-slot[data-type="st"], .field-slot[data-type="field-spell"]').forEach((slotEl) => {
                const el = /** @type {HTMLElement|null} */ (slotEl.querySelector('.card.face-down'));
                if (!el) return;
                // Una carta che sta girando (rivelazione in corso) non brilla: ha gia' la sua animazione.
                if (el.closest('.card-flip-outer')) return;
                const r = el.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) return;
                const d = /** @type {HTMLElement} */ (slotEl).dataset;
                lista.push({ chiave: `${d.owner}:${d.type}:${d.index === undefined ? 0 : d.index}`, rect: { left: r.left, top: r.top, w: r.width, h: r.height } });
            });
        });
        return lista;
    }

    function syncSettate() {
        const gl = window.MonsterHologramGL;
        if (!gl || typeof gl.aggiornaSettate !== 'function') return;
        // Come gli altri effetti d'ambiente: solo con "Dettagli video: Alti".
        const alti = !!(document.documentElement && document.documentElement.dataset.dettagli === 'alti');
        const lista = alti && !sospeso ? settateInCampo() : [];
        // Una carta che era coperta, e nello STESSO posto c'e' ancora una carta ma non piu' coperta, si e' appena scoperta:
        // lampo. Se il posto e' vuoto (distrutta, tornata in mano) non c'e' niente da rivelare.
        if (alti && !sospeso && settatePrima.size) {
            const ora = new Set(lista.map((e) => e.chiave));
            settatePrima.forEach((rect, chiave) => {
                if (ora.has(chiave)) return;
                const [owner, type, index] = chiave.split(':');
                const slot = document.querySelector(`.field-slot[data-owner="${owner}"][data-type="${type}"][data-index="${index}"]`);
                if (slot && slot.querySelector('.card:not(.face-down), .card-flip-outer')) gl.lampoSettata(rect);
            });
        }
        settatePrima.clear();
        lista.forEach((e) => settatePrima.set(e.chiave, e.rect));
        gl.aggiornaSettate(lista);
    }

    function sync() {
        syncSettate();
        if (sospeso) return;
        if (!attivo()) {
            if (vivi.size) { vivi.forEach((_, uid) => rimuovi(uid)); }
            if (window.MonsterHologramGL) MonsterHologramGL.aggiorna([]);
            return;
        }
        if (typeof gameState === 'undefined' || !gameState || !gameState.playerMonsterField || !gameState.botMonsterField) return;

        const attesi = new Set();
        /** Gli ologrammi che devono esistere ora: li disegna il WebGL se c'è, altrimenti il CSS qui sotto. */
        const trovati = [];
        ['player', 'bot'].forEach((owner) => {
            const campo = owner === 'player' ? gameState.playerMonsterField : gameState.botMonsterField;
            campo.forEach((slot) => {
                // Solo mostri SCOPERTI: una carta coperta è
                // un'informazione nascosta, proiettarla la rivelerebbe.
                if (!slot || slot.isFaceDown || !slot.card || !slot.card.uid) return;
                // MAI un querySelector sull'intero documento: lo stesso
                // uid vive anche nelle carte che il picker delle scelte
                // lascia nel DOM a modale chiuso, larghe zero — e
                // trovando quelle l'ologramma non nasceva affatto (bug
                // reale su Richiamo della Mummia). Vedi il commento
                // completo su findFieldCardElementByUid in game-flow.js.
                const cardEl = typeof findFieldCardElementByUid === 'function'
                    ? findFieldCardElementByUid(slot.card.uid)
                    : document.querySelector(`#${owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard'} .card[data-uid="${slot.card.uid}"]`);
                if (!cardEl) return;
                // Una carta che si sta scoprendo: niente ologramma finché
                // il giro non finisce (vedi cartaDaMisurare).
                const daMisurare = cartaDaMisurare(cardEl, slot.card.uid);
                if (daMisurare.gira) return;
                trovati.push({ card: slot.card, owner: owner, el: daMisurare.el });
            });
        });

        // WebGL, se si può (js/ui/monster-hologram-webgl.js): disegna tutto in un solo canvas e il CSS resta spento.
        if (window.MonsterHologramGL) {
            const lista = trovati.map((t) => ({ uid: t.card.uid, owner: t.owner, card: t.card, rect: calcolaRect(t.el) })).filter((x) => x.rect);
            if (MonsterHologramGL.aggiorna(lista)) {
                if (vivi.size) vivi.forEach((_, uid) => rimuovi(uid));
                return;
            }
        }

        // Altrimenti gli ologrammi CSS di sempre.
        trovati.forEach((t) => {
            const uid = t.card.uid;
            let item = vivi.get(uid);
            if (!item) {
                item = creaOlogramma(t.card, t.owner);
                vivi.set(uid, item);
            } else if (item.dataset.owner !== t.owner) {
                // Il mostro ha cambiato lato (Cambio di Cuore e
                // simili): cambia solo l'attributo, così l'inclinazione
                // si gira senza ricreare nulla.
                item.dataset.owner = t.owner;
            }
            if (posiziona(item, t.el)) attesi.add(uid);
        });

        // Spariti dal Terreno (distrutti, tornati in mano, girati coperti).
        vivi.forEach((_, uid) => { if (!attesi.has(uid)) rimuovi(uid); });
    }

    let timerResize = null;
    window.addEventListener('resize', () => {
        clearTimeout(timerResize);
        timerResize = setTimeout(sync, 120);
    });

    /**
     * Nasconde per un attimo l'ologramma di UNA carta, che sta per
     * muoversi davvero sul campo.
     *
     * L'ologramma segue lo slot al quale la carta appartiene, e si
     * riposiziona solo quando il Terreno viene ridisegnato — non
     * fotogramma per fotogramma, che sarebbe uno spreco per un elemento
     * che sta fermo per il 99% del tempo. Finché la carta resta nella
     * sua casella la cosa non si nota; ma quando si LANCIA (la rincorsa
     * d'attacco, vedi showBattleEffect in game-flow.js) la proiezione
     * resterebbe indietro, e si leggerebbe come un fantasma dimenticato
     * a mezz'aria invece che come la proiezione di quel mostro.
     *
     * Nasconderla è meglio che farla inseguire: un mostro che carica sta
     * lasciando la sua postazione, quindi è giusto che la proiezione si
     * spenga. E costa un'opacità, non un calcolo per fotogramma.
     */
    function nascondiPer(uid, durataMs) {
        if (window.MonsterHologramGL) MonsterHologramGL.nascondiPer(uid, durataMs);
        const item = vivi.get(uid);
        if (!item) return;
        item.classList.add('mh-nascosto');
        setTimeout(() => {
            // Può essere stato rimosso nel frattempo (il mostro è morto
            // proprio in quell'attacco): togliere una classe a un
            // elemento staccato è innocuo, ma la mappa va ricontrollata
            // perché potrebbe ora contenere un ALTRO elemento per lo
            // stesso uid.
            const attuale = vivi.get(uid);
            if (attuale) attuale.classList.remove('mh-nascosto');
        }, durataMs);
    }

    // Un video fullscreen non deve contendersi la GPU con trasparenze e
    // scansioni nascoste dietro di lui. Il layer viene escluso dal layout e
    // riallineato al Terreno quando la cinematica termina.
    function sospendi() {
        sospeso = true;
        const el = document.getElementById(LAYER_ID);
        if (el) el.hidden = true;
        if (window.MonsterHologramGL) MonsterHologramGL.sospendi();
    }

    function riprendi() {
        sospeso = false;
        const el = document.getElementById(LAYER_ID);
        if (el) el.hidden = false;
        if (window.MonsterHologramGL) MonsterHologramGL.riprendi();
        sync();
    }

    window.MonsterHolograms = {
        /** Il contenitore (creato se manca): ci disegna dentro anche il WebGL, ereditando opacità e nascondimenti. */
        layer: layer,
        sync: sync, isAttivo: attivo, nascondiPer: nascondiPer,
        sospendi: sospendi, riprendi: riprendi, isSospeso: () => sospeso
    };
})();
