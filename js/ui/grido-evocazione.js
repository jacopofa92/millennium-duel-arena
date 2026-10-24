/**
 * grido-evocazione.js — il duellante a figura intera che annuncia la sua
 * carta simbolo prima che venga Evocata (Kaiba e il Drago Bianco Occhi
 * Blu, Yugi e il Mago Nero...). Dati: js/data/gridi-evocazione.js.
 * =====================================================================
 * COME SI AGGANCIA. Le regole non sanno nulla di questa scena: emettono
 * l'attesa 'grido-evocazione' ({ posto, carta, speciale? }, fatto) in due
 * punti soltanto — l'Evocazione Normale (evocazioni.js, PRIMA del volo
 * della carta) e quella Speciale (ACTIONS.specialSummon in
 * duel-engine.js, PRIMA dell'effetto visivo di Evocazione). Se il
 * duellante non ha un grido per quella carta, o la scena è spenta, `fatto`
 * parte subito e il duello scorre come sempre; altrimenti parte quando la
 * scena finisce, ed è lì che comincia il flusso standard (volo della
 * carta, cerchio o convergenza, finestra di risposta).
 *
 * PERCHÉ NELL'EVOCAZIONE SPECIALE LO STATO È GIÀ CAMBIATO. La Special
 * Summon è sincrona (chi la chiama legge subito il risultato), quindi non
 * si può far aspettare la regola: la carta è già sul Terreno e sotto il
 * velo scuro della scena. Si ritarda solo la parte VISIVA, e il bot
 * aspetta comunque grazie al contatore delle cinematiche (FX.begin/
 * endSummonCinematic, lo stesso dei filmati di Evocazione).
 *
 * LA SCENA (3 secondi): velo del colore dell'Attributo, la
 * sagoma trasparente del duellante che entra dal suo lato spinta dal
 * vento (strisce e pulviscolo che attraversano lo schermo senza fermarsi
 * per tutta la scena), e la frase in una sola banda. Un tocco la salta. Si chiude da sola anche se si apre
 * una scelta a schermo (una finestra di risposta): non deve mai stare
 * sopra una decisione. Rispetta l'interruttore "filmati di Evocazione" e
 * il movimento ridotto; con i Dettagli video su "Alti" ha più vento.
 */
(function () {
    'use strict';

    const DURATA_MS = 3000;
    const DURATA_RIDOTTA_MS = 1500;
    const USCITA_MS = 300;
    // Attesa per la posa dedicata (file da 1-2,5 MB): abbastanza da non ripiegare per una rete lenta; se e' gia' stata
    // precaricata (vedi `precarica`) risolve subito. La pedina di ripiego e' piccola: basta l'attesa breve.
    const ATTESA_POSA_MS = 3500;
    const ATTESA_IMMAGINE_MS = 900;

    // Colori per Attributo (stessi nomi di data/cards.json).
    const COLORI = {
        'LUCE': '#ffe27a', 'OSCURITÀ': '#a56bff', 'FUOCO': '#ff7a3d', 'ACQUA': '#4fb3ff',
        'VENTO': '#59e6a0', 'TERRA': '#d19a5a', 'DIVINO': '#ffd35c'
    };

    // Un grido per carta e per duellante in tutto il duello: il primo è
    // un'entrata in scena, il quinto sarebbe una zavorra.
    const giaMostrati = new Set();
    let sceneAttive = 0;

    function identita(posto) {
        const s = window.DuelSession;
        if (!s) return null;
        return posto === 'player' ? s.player : s.opponent;
    }

    /**
     * C'è una scelta a schermo che la scena non deve coprire? NON si usa
     * isBlockingModalOpen(): quella risponde "sì" anche mentre è a schermo
     * una cinematica di Evocazione, cioè la scena stessa (che si segna come
     * tale per far aspettare il bot) — si chiuderebbe da sola subito.
     */
    function sceltaAperta() {
        if (document.querySelector('.modal-backdrop.open, #quickPopover')) return true;
        if (window.gameState && (gameState.pendingTributeSummon || gameState.pendingHandDiscard)) return true;
        return !!(window.Decisioni && Decisioni.inSospeso && Decisioni.inSospeso());
    }

    function ridotto() {
        return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function dettagliAlti() {
        return !window.VideoQuality || typeof VideoQuality.isAlti !== 'function' || VideoQuality.isAlti();
    }

    // Il caricamento di ogni immagine e' UNO per indirizzo e NON si interrompe quando scade l'attesa di chi la chiede: la posa
    // dedicata pesa 1-2,5 MB, e se la scena la aspettava solo 900 ms (rete lenta, APK, prima volta) ripiegava sulla pedina
    // normale — il difetto segnalato ("a volte vedo la pedina normale e non quella del grido"). Cosi' una richiesta scaduta
    // lascia comunque finire il download, e la scena dopo la trova pronta; `precarica` lo avvia prima che serva.
    const caricamenti = {};
    function avviaCaricamento(src) {
        if (!caricamenti[src]) {
            caricamenti[src] = new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = src;
            });
        }
        return caricamenti[src];
    }
    /** Carica un'immagine; risolve con l'elemento o con null (errore o tempo scaduto). */
    function carica(src, tetto) {
        return Promise.race([avviaCaricamento(src), new Promise((resolve) => setTimeout(() => resolve(null), tetto))]);
    }

    function nomeFile(image) {
        return String(image || '').split(/[\\/]/).pop().replace(/\.[a-z0-9]+(?:\?.*)?$/i, '');
    }
    /** I nomi di file della posa dedicata da provare, in ordine: l'aspetto preciso e poi la variante canonica. */
    function nomiPosa(image) {
        const nome = nomeFile(image);
        if (!nome) return [];
        const chiaveBase = window.chiavePersonaggio ? chiavePersonaggio(image) : nome.replace(/_.*$/, '').replace(/V2$/, '');
        const canonica = chiaveBase === 'kaiba' ? 'setoKaiba' : chiaveBase;
        return Array.from(new Set([nome, canonica].filter(Boolean)));
    }

    /**
     * Scarica in anticipo le pose dedicate dei DUE duellanti (se hanno almeno un grido): sono file da 1-2,5 MB, e il momento
     * dell'Evocazione e' il peggiore per cominciare a scaricarli. Si prova piu' volte perche' DuelSession sa chi sono solo dopo
     * l'avvio; l'esito si tiene (vedi `avviaCaricamento`), quindi la scena lo trova gia' pronto.
     */
    function precarica() {
        if (window.DUEL_FAST_OPENING && !window.GRIDO_EVOCAZIONE_FORZA) return;
        if (ridotto() || (window.SaveManager && SaveManager.getSetting('summonVideos') === false)) return;
        ['player', 'opponent'].forEach((posto) => {
            const chi = identita(posto);
            if (!chi || !chi.image || !window.chiavePersonaggio || !window.GRIDI_EVOCAZIONE) return;
            const chiave = chiavePersonaggio(chi.image);
            if (!GRIDI_EVOCAZIONE.some((v) => v.chi.indexOf(chiave) !== -1)) return;
            nomiPosa(chi.image).forEach((n) => avviaCaricamento('images/characters/pedine-esclamazione/' + n + '.png'));
        });
    }
    [1500, 5000].forEach((ms) => setTimeout(precarica, ms));

    /**
     * La sagoma trasparente: l'originale grande (i file di avatarTrasparenza,
     * ~1 MB l'uno) sugli schermi larghi, dove la figura è alta mezzo
     * schermo, la pedina da 320 px altrove. Se l'originale manca si ricade
     * sulla pedina, e se manca anche quella la scena parte senza figura.
     */
    async function sagoma(image) {
        // Il nome del file, con tutto il suffisso di contesto: i file di
        // avatarTrasparenza/pedine si chiamano come l'immagine (es.
        // setoKaiba_duelist_Kingdom), non come la chiave breve dei gridi.
        const nome = nomeFile(image);
        if (!nome) return null;

        // Prima usa la posa dedicata al grido. Gli aspetti contestuali
        // (es. setoKaiba_duelist_Kingdom) ricadono sulla variante canonica.
        const nomiEsclamazione = nomiPosa(image);
        // Le prove partono insieme: un costume privo di asset dedicato non
        // aggiunge un secondo timeout prima del fallback canonico.
        const esclamazioni = await Promise.all(nomiEsclamazione.map((n) =>
            carica('images/characters/pedine-esclamazione/' + n + '.png', ATTESA_POSA_MS)
        ));
        const esclamazione = esclamazioni.find(Boolean);
        if (esclamazione) return esclamazione.src;

        const pedina = 'images/characters/pedine/' + nome + '.png';
        if (window.innerWidth > 900) {
            const grande = await carica('images/characters/avatarTrasparenza/' + nome + '.png', ATTESA_IMMAGINE_MS);
            if (grande) return grande.src;
        }
        const piccola = await carica(pedina, ATTESA_IMMAGINE_MS);
        return piccola ? piccola.src : null;
    }

    function costruisciVento(scena, direzione, alti) {
        const vento = scena.querySelector('.ge-vento');
        const strisce = alti ? 22 : 11;
        for (let i = 0; i < strisce; i++) {
            const s = document.createElement('i');
            s.style.top = (4 + Math.random() * 92) + '%';
            s.style.width = (16 + Math.random() * 30) + 'vw';
            s.style.animationDelay = Math.round(Math.random() * 520) + 'ms';
            s.style.animationDuration = Math.round(480 + Math.random() * 420) + 'ms';
            s.style.opacity = String(0.35 + Math.random() * 0.5);
            vento.appendChild(s);
        }
        const granelli = alti ? 26 : 10;
        for (let i = 0; i < granelli; i++) {
            const g = document.createElement('b');
            g.style.top = (6 + Math.random() * 88) + '%';
            g.style.setProperty('--ge-dy', (Math.random() * 90 - 45) + 'px');
            g.style.setProperty('--ge-s', (2 + Math.random() * 5).toFixed(1) + 'px');
            g.style.animationDelay = Math.round(Math.random() * 700) + 'ms';
            g.style.animationDuration = Math.round(900 + Math.random() * 800) + 'ms';
            vento.appendChild(g);
        }
        scena.style.setProperty('--ge-dir', String(direzione));
    }

    /**
     * L'attesa 'grido-evocazione'. `fatto` si chiama UNA volta sola, su
     * qualunque strada (scena finita, saltata, mai partita).
     */
    function mostra(dati, fatto) {
        let finito = false;
        const chiudiAttesa = () => { if (!finito) { finito = true; fatto(); } };
        try {
            const carta = dati && dati.carta;
            const posto = dati && dati.posto;
            if (!carta || carta.id < 0 || !document.body) return chiudiAttesa();
            if (window.SaveManager && SaveManager.getSetting('summonVideos') === false) return chiudiAttesa();
            // La suite di test gira con le aperture rapide: nessuna scena, a meno
            // che il test non la chieda apposta.
            if (window.DUEL_FAST_OPENING && !window.GRIDO_EVOCAZIONE_FORZA) return chiudiAttesa();
            if (window.gameState && gameState.gameOver) return chiudiAttesa();
            if (sceneAttive > 0) return chiudiAttesa();

            const chi = identita(posto);
            const grido = chi && window.trovaGridoEvocazione ? trovaGridoEvocazione(chi.image, carta.id) : null;
            const chiave = posto + ':' + carta.id;
            if (!grido || giaMostrati.has(chiave)) return chiudiAttesa();
            giaMostrati.add(chiave);

            sceneAttive++;
            sagoma(chi.image).then((src) => avvia(dati, chi, grido, src, chiudiAttesa));
        } catch (errore) {
            if (typeof reportError === 'function') reportError(errore);
            chiudiAttesa();
        }
    }

    /**
     * Il grido in frasi, una per riga: si spezza dopo ! ? . e, se la frase è
     * una sola, dopo la prima virgola ("Mago Nero, / scendi in campo!").
     * Il segno di punteggiatura resta con la frase che chiude.
     * @param {string} testo
     * @returns {string[]}
     */
    function frasi(testo) {
        const pulita = String(testo || '').trim();
        let parti = pulita.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [pulita];
        if (parti.length === 1) parti = pulita.match(/[^,]+,|[^,]+$/g) || [pulita];
        // Solo la prima virgola: una frase con tre virgole non diventa quattro righe.
        if (parti.length > 2) parti = [parti[0], parti.slice(1).join('')];
        return parti.map((p) => p.trim()).filter(Boolean);
    }

    /**
     * Rimpicciolisce il testo finché ogni frase sta su UNA riga (fino a un
     * minimo leggibile): meglio un carattere un po' più piccolo che una
     * frase spezzata a metà. Si misura prima di mostrare la scena (è ancora
     * a opacità 0), così a schermo il testo ha già la sua forma definitiva e
     * non cambia numero di righe mentre entra.
     * @param {HTMLElement} scena
     */
    function adatta(scena) {
        const grido = scena.querySelector('.ge-grido');
        if (!grido) return;
        const righe = Array.from(grido.querySelectorAll('.ge-riga'));
        const base = parseFloat(getComputedStyle(grido).fontSize) || 32;
        const minimo = Math.max(15, base * 0.55);
        let corpo = base;
        const troppoLunga = () => righe.some((r) => r.offsetHeight > corpo * 1.1 * 1.5);
        while (corpo > minimo && troppoLunga()) {
            corpo -= 1;
            grido.style.fontSize = corpo + 'px';
        }
    }

    function avvia(dati, chi, grido, src, chiudiAttesa) {
        const { carta, posto } = dati;
        const rid = ridotto();
        const durata = rid ? DURATA_RIDOTTA_MS : DURATA_MS;
        const direzione = posto === 'player' ? 1 : -1; // il vento soffia da dove entra il duellante
        const colore = COLORI[carta.attribute] || COLORI.LUCE;

        const scena = document.createElement('div');
        scena.id = 'gridoEvocazione';
        scena.className = 'ge ' + (posto === 'player' ? 'ge--sinistra' : 'ge--destra') + (rid ? ' ge--ridotto' : '');
        scena.style.setProperty('--ge-colore', colore);
        scena.style.setProperty('--ge-durata', durata + 'ms');
        scena.setAttribute('role', 'presentation');
        scena.innerHTML = `
            <div class="ge-velo"></div>
            <div class="ge-lampo"></div>
            <div class="ge-vento" aria-hidden="true"></div>
            <div class="ge-onda"></div>
            <div class="ge-banda"><strong class="ge-grido"></strong></div>
            <img class="ge-figura" alt="" ${src ? `src="${src}"` : 'hidden'}>
            <span class="ge-salta">Tocca per saltare</span>`;
        // Il testo non passa da innerHTML: il nome di una carta personalizzata è libero.
        // Una riga per frase, mai spezzata a metà: solo una frase troppo lunga per
        // lo schermo va a capo da sola. Il testo resta fuori da innerHTML.
        frasi(grido).forEach((f) => {
            const riga = document.createElement('span');
            riga.className = 'ge-riga';
            riga.textContent = f + ' '; // lo spazio tiene il testo leggibile per chi lo copia o lo legge a voce
            scena.querySelector('.ge-grido').appendChild(riga);
        });
        if (!rid) costruisciVento(scena, direzione, dettagliAlti());
        document.body.appendChild(scena);
        adatta(scena);

        if (window.FX && typeof FX.beginSummonCinematic === 'function') FX.beginSummonCinematic();
        if (window.SFX && typeof SFX.wind === 'function' && !rid) SFX.wind();

        let chiusa = false;
        let sorveglia = null;
        const chiudi = (veloce) => {
            if (chiusa) return;
            chiusa = true;
            clearInterval(sorveglia);
            scena.classList.add('ge--esce');
            setTimeout(() => {
                scena.remove();
                sceneAttive = Math.max(0, sceneAttive - 1);
                if (window.FX && typeof FX.endSummonCinematic === 'function') FX.endSummonCinematic();
                chiudiAttesa();
            }, veloce ? 140 : USCITA_MS);
        };

        scena.addEventListener('pointerdown', (e) => { e.stopPropagation(); chiudi(true); });
        // Una scelta a schermo (finestra di risposta, picker) passa sempre avanti.
        // (Parte dopo un momento: appena chiusa la scelta che ha portato qui
        // — una posizione, un Tributo — il suo velo può ancora essere in uscita.)
        setTimeout(() => {
            if (chiusa) return;
            sorveglia = setInterval(() => {
                if (sceltaAperta()) chiudi(true);
            }, 120);
        }, 400);
        // Il tempo comprende l'uscita: la scena dura `durata` in totale.
        setTimeout(() => chiudi(false), Math.max(300, durata - USCITA_MS));
        scena.getBoundingClientRect(); // forza il primo disegno prima di avviare
        scena.classList.add('ge--play');
    }

    if (window.EventiDuello) EventiDuello.ascolta('grido-evocazione', mostra);

    window.GridoEvocazione = {
        DURATA_MS,
        /** Per i test: dimentica i gridi già mostrati in questo duello. */
        azzera() { giaMostrati.clear(); },
        mostra,
        frasi
    };
})();
