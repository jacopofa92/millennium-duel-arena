/**
 * auto-sync.js — il salvataggio arriva sul cloud mentre giochi, non solo
 * quando esci.
 * =====================================================================
 * IL DIFETTO CHE CHIUDE, segnalato dall'utente dopo aver perso il
 * salvataggio più recente: il caricamento sul cloud partiva SOLO da
 * "Esci" e "Cambia account". Chiunque chiuda il gioco in un altro modo —
 * l'APK ucciso dal sistema per fare spazio, la batteria finita, la scheda
 * chiusa, o semplicemente chi non fa mai logout perché non ne ha motivo —
 * lasciava ore di gioco nel solo localStorage di quel dispositivo. Poi
 * bastava rientrare da un altro telefono per trovare il cloud fermo a
 * giorni prima, e sceglierlo cancellava tutto.
 *
 * COME: si ascolta il gancio `SaveManager.onSaved` — cioè OGNI scrittura
 * del salvataggio, da qualunque punto del gioco (fine duello, acquisto,
 * sblocco, mazzo modificato) — e si carica sul cloud poco dopo. Il
 * ritardo serve: una partita scrive più volte di fila, e senza si
 * manderebbe una richiesta per ognuna.
 *
 * DUE MOMENTI IN CUI SI FORZA SUBITO, senza aspettare il ritardo:
 *   - la pagina diventa NASCOSTA (`visibilitychange`): su un telefono è
 *     l'istante in cui si passa a un'altra app, ed è l'ultimo momento in
 *     cui la pagina è ancora viva e può fare una richiesta per bene. È il
 *     segnale che conta davvero su mobile;
 *   - `pagehide`, come seconda rete. Qui la pagina può morire a richiesta
 *     ancora in volo: non è affidabile da solo, e infatti non si conta
 *     su di lui.
 * (`beforeunload` non è nell'elenco apposta: su mobile non scatta.)
 *
 * SE LA RICHIESTA NON RIESCE (offline, rete che va e viene) resta un
 * segno in localStorage, e al prossimo avvio si riprova appena la
 * sessione è nota. È il pezzo che rende il meccanismo affidabile invece
 * che *quasi* affidabile: senza, una giornata giocata in metropolitana
 * non arriverebbe mai sul cloud.
 */
(function () {
    'use strict';

    /**
     * Quanto si aspetta prima di caricare. Abbastanza da raccogliere in
     * una sola richiesta la raffica di scritture di fine duello (premi,
     * record, sfide, sblocchi arrivano uno dopo l'altro), abbastanza poco
     * da non perdere una partita se l'app viene chiusa di colpo.
     */
    const RITARDO_MS = 15000;

    /**
     * Segni "c'è qualcosa da caricare che non è ancora arrivato". Sopravvivono
     * alla chiusura dell'app, quindi localStorage e non sessionStorage. Due,
     * perché salvataggio e carte personalizzate stanno in due tabelle del
     * cloud: una carta creata non deve costare un caricamento del
     * salvataggio da sola, e viceversa le carte (una sostituzione completa,
     * vedi CloudSync.pushCustomCards) si mandano solo se sono cambiate.
     */
    const CHIAVE_IN_SOSPESO = 'ygoSyncInSospeso';
    const CHIAVE_CARTE_IN_SOSPESO = 'ygoSyncCarteInSospeso';

    let timer = null;
    let inCorso = false;
    /** Qualcosa è cambiato mentre un caricamento era in volo: si riparte alla fine. */
    let ancoraDopo = false;

    function segnaChiave(chiave, attivo) {
        try {
            if (attivo) localStorage.setItem(chiave, '1');
            else localStorage.removeItem(chiave);
        } catch (e) { /* senza il segno si perde solo il recupero differito */ }
    }
    function leggiChiave(chiave) {
        try { return localStorage.getItem(chiave) === '1'; } catch (e) { return false; }
    }
    function segna(attivo) { segnaChiave(CHIAVE_IN_SOSPESO, attivo); avvisaStato(); }

    // --- Stato visibile (indicatore del menu, js/ui/stato-salvataggio.js) ---
    // Non decide nulla: racconta soltanto. 'errore' = l'ultimo tentativo non è
    // arrivato (rete o server); resta finché un tentativo non riesce.
    let ultimoTentativoFallito = false;
    const ascoltatoriStato = [];
    function stato() {
        if (!window.CloudSync || !CloudSync.available || !(CloudSync.getUser && CloudSync.getUser())) return 'nessun-account';
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
        if (inCorso) return 'in-corso';
        if (ultimoTentativoFallito) return 'errore';
        if (timer || leggiChiave(CHIAVE_IN_SOSPESO) || leggiChiave(CHIAVE_CARTE_IN_SOSPESO)) return 'in-attesa';
        return 'salvato';
    }
    function avvisaStato() {
        const s = stato();
        ascoltatoriStato.slice().forEach((f) => { try { f(s); } catch (e) { /* un ascoltatore guasto non ferma gli altri */ } });
    }
    window.addEventListener('online', avvisaStato);
    window.addEventListener('offline', avvisaStato);
    function carteInSospeso() { return leggiChiave(CHIAVE_CARTE_IN_SOSPESO); }
    function inSospeso() { return leggiChiave(CHIAVE_IN_SOSPESO) || carteInSospeso(); }

    function pronto() {
        return !!(window.CloudSync && CloudSync.available && CloudSync.getUser && CloudSync.getUser()
            && window.SaveManager && SaveManager.hasSave());
    }

    /**
     * Carica adesso. `inCorso` evita che due richieste si accavallino —
     * la seconda sovrascriverebbe la prima con dati che potrebbero essere
     * più VECCHI, se arrivasse dopo per un ritardo di rete.
     */
    function caricaOra() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (inCorso) { ancoraDopo = true; return Promise.resolve(false); }
        if (!pronto()) return Promise.resolve(false);
        inCorso = true;
        segna(true);
        const conCarte = carteInSospeso();
        const salvataggio = CloudSync.pushSave()
            .then(() => { ultimoTentativoFallito = false; segna(false); return true; })
            // Silenzioso di proposito: questo gira mentre si gioca, e un
            // avviso a ogni sbalzo di rete sarebbe rumore su qualcosa che
            // si sistema da sé al tentativo successivo. Il segno resta, ed
            // è quello che conta.
            // TRANNE quando il cloud ha già un salvataggio più recente
            // (pushSave si rifiuta di sovrascriverlo, vedi cloud-sync.js):
            // lì non c'è niente di nuovo da mandare, e tenere il segno
            // vorrebbe dire ritentare all'infinito. Ci pensa la
            // riconciliazione a portare qui la copia buona.
            .catch((e) => {
                // Rifiuti "di merito" (cloud più recente, profilo azzerato...) non
                // sono un guasto di rete: non devono accendere l'avviso di errore.
                ultimoTentativoFallito = !(e && (e.code === 'CLOUD_PIU_RECENTE' || e.code === 'PROFILO_AZZERATO' || e.code === 'CLOUD_CAMBIATO'));
                // Stesso discorso se il profilo è stato azzerato altrove:
                // i dati da mandare non esistono più.
                if (e && (e.code === 'CLOUD_PIU_RECENTE' || e.code === 'PROFILO_AZZERATO')) segna(false);
                // Un altro dispositivo ha scritto dopo l'ultimo allineamento
                // di questo: niente da ritentare (sovrascriverebbe i suoi
                // progressi). Si scarica il cloud, e le modifiche di qui
                // restano in una copia di sicurezza.
                if (e && e.code === 'CLOUD_CAMBIATO') { segna(false); riallineaDopoConflitto(); }
                return false;
            });
        // Le carte DOPO il salvataggio, non insieme: ognuno dei due guarda
        // prima il cloud (azzeramento fatto altrove, vedi leggiCloud), e uno
        // alla volta il secondo trova la situazione già sistemata dal primo.
        // Partono anche se il salvataggio è stato rifiutato perché il cloud ne
        // ha uno più recente: le carte cambiate sono quelle fatte QUI.
        const tutto = !conCarte || typeof CloudSync.pushCustomCards !== 'function' || !window.CustomCards
            ? salvataggio
            : salvataggio.then((esito) => CloudSync.pushCustomCards()
                .then(() => { segnaChiave(CHIAVE_CARTE_IN_SOSPESO, false); return esito; })
                .catch(() => false));
        return tutto.then((esito) => {
            inCorso = false;
            if (ancoraDopo) { ancoraDopo = false; programma(); }
            avvisaStato();
            return esito;
        });
    }

    /**
     * Ogni quanto, al massimo, si riguarda il cloud quando si torna sul
     * gioco. Abbastanza da non fare una richiesta a ogni cambio pagina,
     * abbastanza poco da accorgersi di una partita fatta su un altro
     * dispositivo mentre questo era in tasca.
     */
    const INTERVALLO_RICONCILIAZIONE_MS = 2 * 60 * 1000;

    /**
     * Riallinea questo dispositivo al cloud (CloudSync.riconcilia) quando si
     * torna sul gioco dopo un po'. L'APK resta spesso aperto in sottofondo
     * per giorni: senza questo, chi gioca su desktop e poi riprende il
     * telefono troverebbe i dati di prima finché non chiude l'app.
     *
     * Se sono arrivati dati più nuovi, la pagina li sta ancora MOSTRANDO
     * vecchi: si ricarica. Mai durante un duello (gameState esiste solo lì):
     * una partita interrotta di colpo è peggio di un menu da aggiornare, e i
     * dati sotto sono comunque già quelli nuovi — le scritture di fine
     * duello partono da lì.
     */
    function riguardaIlCloud() {
        if (!pronto() || typeof CloudSync.riconcilia !== 'function') return;
        if (CloudSync.msDallUltimaRiconciliazione() < INTERVALLO_RICONCILIAZIONE_MS) return;
        CloudSync.riconcilia({ attesaMassimaMs: 8000 }).then(applicaEsitoRiallineamento);
    }

    /**
     * Cosa fare dopo un riallineamento che ha cambiato i dati di qui. Mai
     * durante un duello (vedi riguardaIlCloud): i dati sotto sono comunque
     * già quelli nuovi.
     */
    function applicaEsitoRiallineamento(r) {
        if (!r || (r.esito !== 'scaricato' && r.esito !== 'azzerato')) return;
        if (typeof gameState !== 'undefined') return;
        // Profilo azzerato da un altro dispositivo: qui non c'è più un
        // salvataggio, e una pagina qualunque non sa ripartire da zero.
        // Si torna al menu, che chiede il nome come la prima volta (e
        // dice perché: l'avviso l'ha lasciato CloudSync).
        if (r.esito === 'azzerato') { location.href = 'index.html'; return; }
        // Se qui c'erano modifiche non ancora sul cloud, l'avviso lo dice:
        // sono state messe da parte, non perse.
        try { sessionStorage.setItem('ygoAvvisoSync', r.divergente ? 'conflitto' : 'scaricato'); } catch (e) { /* noop */ }
        location.reload();
    }

    /** Un caricamento è stato rifiutato perché il cloud è cambiato altrove: allinea questo dispositivo. */
    function riallineaDopoConflitto() {
        if (!window.CloudSync || typeof CloudSync.risolviConflittoCloud !== 'function') return;
        CloudSync.risolviConflittoCloud().then(applicaEsitoRiallineamento).catch(() => { /* si riproverà al prossimo giro */ });
    }

    /**
     * Un salvataggio arrivato prima di sapere CHI è l'utente (la sessione
     * si legge in asincrono all'avvio): senza tenerlo da parte andava
     * perso, e con lui ciò che il salvataggio cambia da sé caricandosi —
     * l'azzeramento delle storie, per esempio. Si riprende appena la
     * sessione è nota (vedi waitForUser in fondo).
     */
    let richiestaPrimaDellUtente = false;

    function programma() {
        if (!pronto()) {
            if (window.CloudSync && CloudSync.available && !(CloudSync.getUser && CloudSync.getUser())) {
                richiestaPrimaDellUtente = true;
            }
            return;
        }
        segna(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(caricaOra, RITARDO_MS);
    }

    /**
     * Le carte personalizzate o la loro terminologia sono cambiate. La
     * chiamano i due punti di scrittura (saveAll di js/data/custom-cards.js e
     * di js/data/custom-taxonomy.js), così una funzione futura che salvi carte
     * o categorie è coperta senza ricordarsene. Prima esisteva un secondo
     * meccanismo a parte (cloud-autosync.js) con un suo timer e una sua coda:
     * caricava salvataggio e carte insieme, accavallandosi a questo. Ora la
     * coda è una sola, e la terminologia (che viaggia DENTRO il salvataggio,
     * vedi CloudSync.pushSave) arriva col caricamento del salvataggio.
     */
    function cartePersonalizzateCambiate() {
        if (!pronto()) return;
        segnaChiave(CHIAVE_CARTE_IN_SOSPESO, true);
        programma();
    }

    /**
     * L'aggancio a SaveManager NON deve dipendere dall'ordine dei tag
     * <script>. Questo file sta in cima alla pagina insieme agli altri di
     * js/cloud/, mentre js/save-manager.js viene caricato molto più in
     * basso: agganciarsi solo al primo tentativo vorrebbe dire non
     * agganciarsi mai. E la lista degli script è duplicata a mano in
     * diciannove pagine, quindi un ordine "giusto" sarebbe una cosa in più
     * da tenere allineata a mano — cioè una deriva che aspetta di
     * succedere, in un progetto dove è già successa.
     */
    let agganciato = false;
    function collega() {
        if (agganciato || !window.SaveManager || typeof SaveManager.onSaved !== 'function') return false;
        SaveManager.onSaved(programma);
        agganciato = true;
        return true;
    }
    if (!collega()) {
        document.addEventListener('DOMContentLoaded', collega);
        window.addEventListener('load', collega);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && (timer || inSospeso())) caricaOra();
        if (document.visibilityState === 'visible') riguardaIlCloud();
    });
    window.addEventListener('pagehide', () => {
        if (timer || inSospeso()) caricaOra();
    });

    // Recupero di ciò che era rimasto indietro: si aspetta di sapere CHI è
    // l'utente (waitForUser, non il primo giro di onAuthChange — vedi il
    // commento su initialSessionPromise in cloud-sync.js) perché senza
    // sessione non c'è niente da caricare e si concluderebbe subito un
    // "non pronto" che nessuno riproverebbe.
    // Poi si riguarda il cloud — dopo il tentativo di caricamento, non
    // insieme, così si parte da una situazione già assestata. Il menu
    // (index.html) lo fa da sé al proprio avvio, PRIMA di aprirsi, e
    // dichiara RICONCILIA_DA_SE: qui si salterebbe solo un doppione.
    if (window.CloudSync && typeof CloudSync.waitForUser === 'function') {
        CloudSync.waitForUser().then(() => {
            if (richiestaPrimaDellUtente) { richiestaPrimaDellUtente = false; programma(); }
            const prima = inSospeso() ? caricaOra() : Promise.resolve();
            return prima.then(() => { if (!window.RICONCILIA_DA_SE) riguardaIlCloud(); });
        }).catch(() => { /* nessuna sessione: si riproverà al prossimo avvio */ });
    }

    window.AutoSync = {
        /** Forza il caricamento adesso. Torna una Promise: usarla quando si DEVE sapere se è arrivato (es. prima di uscire). */
        caricaOra: caricaOra,
        inSospeso: inSospeso,
        /** 'salvato' | 'in-attesa' | 'in-corso' | 'errore' | 'offline' | 'nessun-account' */
        stato: stato,
        /** Chiama f(stato) a ogni cambio; torna la funzione per smettere. */
        onStato: function (f) { ascoltatoriStato.push(f); return function () { const i = ascoltatoriStato.indexOf(f); if (i >= 0) ascoltatoriStato.splice(i, 1); }; },
        cartePersonalizzateCambiate: cartePersonalizzateCambiate
    };
})();
