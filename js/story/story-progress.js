/**
 * story-progress.js — Dove sei arrivato nella Modalità Storia.
 * =====================================================================
 * Il catalogo delle campagne sta in js/data/story-campaigns.js (solo
 * dati), il disegno della mappa in js/ui/node-map.js (solo disegno).
 * Qui c'è l'unica cosa che sa entrambe: a che punto è il giocatore.
 *
 * COM'È FATTO L'AVANZAMENTO. Una campagna è un elenco ORDINATO di tappe
 * (i capitoli servono solo a raggrupparle per il giocatore), quindi
 * l'avanzamento è un numero solo: quante tappe ha superato. Niente
 * elenco di id completati, che sarebbe la stessa informazione scritta in
 * modo più fragile — un id rinominato nel catalogo perderebbe il
 * progresso, mentre un indice no.
 *
 * Lo stato vive in SaveManager.getStoryState/setStoryState (contenitore
 * generico, come per i tornei):
 *   { completate: <numero di tappe superate>, finita: <bool>, premiata: <bool>,
 *     sotto: { <id area/torneo>: <prove superate> }, separazioni: [<id>] }
 * `separazioni` è il timbro delle migrazioni già applicate: vedi
 * applicaSeparazioni più sotto e `separazioni` nel catalogo.
 * `premiata` esiste perché il premio finale si paga UNA volta sola: la
 * campagna resta rigiocabile, il premio no.
 *
 * COME TORNA L'ESITO DI UN DUELLO. Non serve niente di nuovo: ogni duello
 * di ogni modalità lascia una breadcrolla in
 * sessionStorage['ygoLastDuelOutcome'] (js/duel-session.js), e qui si
 * legge quella. È lo stesso meccanismo dei tre tornei — se un giorno
 * cambia il modo in cui un duello racconta com'è finito, cambia in un
 * punto solo.
 */
(function () {
    'use strict';

    const OUTCOME_KEY = 'ygoLastDuelOutcome';

    function getCampaigns() {
        return (typeof storyCampaignsDatabase !== 'undefined') ? storyCampaignsDatabase : [];
    }

    /**
     * Il personaggio del roster dietro un id, o null.
     *
     * Serve a ritratto e nome vero: una tappa dice solo `characterId`, e
     * ripetere nome e immagine anche nel catalogo delle campagne
     * vorrebbe dire tenerli allineati a mano per sempre. Se
     * characters-db.js non e' caricato la Storia funziona lo stesso,
     * semplicemente senza volti — la pagina non deve rompersi per una
     * cosa decorativa.
     */
    function getPersonaggio(characterId) {
        if (!characterId || typeof characterDatabase === 'undefined') return null;
        return characterDatabase.find((c) => c.id === characterId) || null;
    }

    function getCampaign(campaignId) {
        return getCampaigns().find((c) => c.id === campaignId) || null;
    }

    /**
     * Tutte le tappe di una campagna in fila, con dentro il capitolo di
     * appartenenza e la propria posizione assoluta. È la forma con cui
     * lavora tutto il resto del file: i capitoli sono un modo di
     * RACCONTARE l'elenco, non un secondo livello da attraversare ogni
     * volta.
     */
    function getTappe(campaignId) {
        const campagna = getCampaign(campaignId);
        if (!campagna) return [];
        const out = [];
        (campagna.capitoli || []).forEach((cap, iCap) => {
            (cap.tappe || []).forEach((tappa) => {
                const pg = tappa.kind === 'duel' ? getPersonaggio(tappa.characterId) : null;
                out.push(Object.assign({}, tappa, {
                    indice: out.length,
                    capitoloId: cap.id,
                    capitoloNome: cap.nome,
                    capitoloTesto: cap.testo || '',
                    capitoloIndice: iCap,
                    // CHI SEI in questa tappa: il protagonista del capitolo
                    // se ne dichiara uno, altrimenti quello della campagna.
                    // Serve perché dentro una sola storia si può cambiare
                    // panni — in Memorie Proibite sei Atem, ma nel capitolo
                    // del presente sei Yugi Muto. Risolto QUI, una volta,
                    // invece che da ogni punto che ne ha bisogno (la mappa,
                    // le cutscene, il duello): sono tre posti diversi, e
                    // tre copie della stessa regola divergono.
                    // La TAPPA può dichiarare il suo, e vince sul capitolo:
                    // serve al momento esatto in cui il comando cambia
                    // mani a metà capitolo (Grande Guerra: la scena del
                    // Piave, novembre 1917, la parla già Diaz mentre il
                    // capitolo di Caporetto è ancora di Cadorna). È la
                    // stessa precedenza che js/duel-session.js usava già.
                    protagonista: tappa.protagonista || cap.protagonista || campagna.protagonista || null,
                    // Stessa idea, per l'arena e la colonna sonora del
                    // duello: un nodo che non le dichiara eredita quelle
                    // del CAPITOLO (stesse chiavi, `field`/`music`) — utile
                    // quando un capitolo È un'area/macromappa (un capitolo
                    // per area nella campagna 'anime', vedi il commento lì):
                    // basta dichiararle UNA volta sul capitolo perché ogni
                    // nodo dell'area le erediti, invece di ripeterle su
                    // ciascuno. Il fallback ULTERIORE alla campagna intera
                    // (`campoDuello`/`musicaDuello`, vedi il commento in
                    // cima a story-campaigns.js) resta in urlDuello più
                    // sotto, non qui: `campoDuello` può essere un elenco
                    // scelto in modo stabile dall'id della tappa, e quella
                    // logica non va duplicata qui.
                    field: tappa.field || cap.field || campoDellaCampagna(campagna, tappa.id) || null,
                    music: tappa.music || cap.music || campagna.musicaDuello || null,
                    // Nelle campagne a livelli non esiste una difficoltà
                    // propria del nodo: tutta la partita usa la scelta
                    // iniziale. Esporre qui il valore risolto evita che UI,
                    // editor o audit mostrino vecchi valori ormai inerti.
                    difficulty: difficoltaEsposta(campaignId, tappa.difficulty),
                    // Ritratto e nome vero arrivano dal roster, non dal
                    // catalogo: una campagna dichiara CHI si affronta, non
                    // che faccia abbia.
                    immagine: pg && typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(pg.image) : (pg ? pg.image : null),
                    nomeAvversario: pg ? pg.name : null,
                    titoloAvversario: pg ? pg.title : null
                }));
            });
        });
        return out;
    }

    function capitoliCompletati(tappe, quante) {
        const ids = [...new Set(tappe.map((t) => t.capitoloId))];
        return ids.filter((id) => tappe
            .filter((t) => t.capitoloId === id)
            .every((t) => t.indice < quante));
    }

    // =================================================================
    // LIVELLI DI DIFFICOLTÀ (Facile / Normale / Difficile)
    // =================================================================
    // Ogni campagna si gioca tre volte, una per livello, e ogni livello ha
    // il SUO avanzamento: la stessa storia, gli stessi avversari, ma coi
    // loro mazzi Facile, Normale o Difficile (le tre liste scritte per
    // ciascun Duellante in js/data/character-decks.js). All'inizio c'è solo
    // Facile; finita la storia una volta si sbloccano Normale e Difficile
    // insieme — richiesta esplicita dell'utente.
    //
    // DOVE SI SALVA. Facile vive nella chiave di sempre, `story[<id>]`: è
    // l'avanzamento che c'era prima dei livelli, e chi aveva già giocato
    // se lo ritrova come partita a Facile invece di perderlo. È anche la
    // chiave che legge il Negozio per i suoi sblocchi (shop-catalog.js,
    // `requisitoStoriaOk`), che così continuano a chiedere "hai fatto
    // la storia", non "l'hai fatta a un certo livello". Normale e
    // Difficile stanno in `story[<id>@normale]`/`story[<id>@difficile]`,
    // e il livello scelto in `story[<id>@livello]`: nel salvataggio, non
    // nell'URL, così tornando da un duello si rientra nel livello da cui
    // si era partiti senza che il duello debba saperne nulla.
    //
    // Una campagna con `senzaLivelli: true` (la Grande Guerra, i cui mazzi
    // sono congelati e non hanno tre versioni) resta com'era: un solo
    // avanzamento, e la difficoltà di ogni duello è quella scritta sulla
    // tappa.
    const LIVELLI = [
        // `duello`: l'etichetta di difficoltà che il duello capisce (vedi
        // DIFFICULTY_LABEL_TO_KEY in js/duel-session.js).
        // `moltiplicatorePremio`: quanto vale il premio finale a quel
        // livello rispetto a quello scritto nel catalogo.
        { id: 'facile', nome: 'Facile', duello: 'Facile', moltiplicatorePremio: 1 },
        { id: 'normale', nome: 'Normale', duello: 'Medio', moltiplicatorePremio: 1.5 },
        { id: 'difficile', nome: 'Difficile', duello: 'Difficile', moltiplicatorePremio: 2 }
    ];

    function haLivelli(campaignId) {
        const c = getCampaign(campaignId);
        return !!c && !c.senzaLivelli;
    }

    function chiaveStato(campaignId, livello) {
        return (!livello || livello === 'facile') ? campaignId : campaignId + '@' + livello;
    }

    /** Scelta del livello e sblocco, in `story[<id>@livello]`: { livello, sbloccati } */
    function statoLivelli(campaignId) {
        return (window.SaveManager && SaveManager.getStoryState(campaignId + '@livello')) || {};
    }

    /**
     * Il livello è giocabile? Facile sempre; gli altri dopo aver finito la
     * storia a Facile. Lo sblocco è PERMANENTE (`sbloccati`, scritto da
     * segnaSblocco nell'istante in cui Facile finisce): leggere solo
     * "Facile è finita" voleva dire che un "Ricomincia" a Facile richiudeva
     * Normale e Difficile, anche a partita Normale già a metà. Il controllo
     * su `finita` resta per i salvataggi di prima dei livelli, che la storia
     * l'hanno finita senza che nessuno scrivesse il segno.
     */
    function livelloSbloccato(campaignId, livello) {
        if (!haLivelli(campaignId)) return livello === 'facile';
        if (livello === 'facile') return true;
        if (!LIVELLI.some((l) => l.id === livello)) return false;
        return !!statoLivelli(campaignId).sbloccati || leggiProgresso(campaignId, 'facile').finita;
    }

    function segnaSblocco(campaignId) {
        if (!haLivelli(campaignId) || !window.SaveManager) return;
        SaveManager.setStoryState(campaignId + '@livello', Object.assign({}, statoLivelli(campaignId), { sbloccati: true }));
    }

    /**
     * Il livello su cui si sta giocando la campagna, o null per una
     * campagna senza livelli. Un livello salvato ma non (più) sbloccato
     * ricade su Facile: non deve bastare scrivere una chiave per saltare
     * la prima partita.
     */
    function getLivelloAttivo(campaignId) {
        if (!haLivelli(campaignId)) return null;
        const livello = statoLivelli(campaignId).livello;
        return (livello && livelloSbloccato(campaignId, livello)) ? livello : 'facile';
    }

    /** Sceglie il livello. Torna false (e non cambia niente) se è ancora bloccato. */
    function setLivelloAttivo(campaignId, livello) {
        if (!haLivelli(campaignId) || !livelloSbloccato(campaignId, livello) || !window.SaveManager) return false;
        SaveManager.setStoryState(campaignId + '@livello', Object.assign({}, statoLivelli(campaignId), { livello: livello }));
        return true;
    }

    /** I tre livelli con il loro stato, per disegnarli: [{ id, nome, sbloccato, attivo, finita, completate }] */
    function getLivelliConStato(campaignId) {
        if (!haLivelli(campaignId)) return [];
        const attivo = getLivelloAttivo(campaignId);
        return LIVELLI.map((l) => {
            const p = leggiProgresso(campaignId, l.id);
            return Object.assign({}, l, {
                sbloccato: livelloSbloccato(campaignId, l.id),
                attivo: l.id === attivo,
                finita: p.finita,
                completate: p.completate
            });
        });
    }

    function datiLivello(campaignId) {
        const id = getLivelloAttivo(campaignId);
        return id ? LIVELLI.find((l) => l.id === id) : null;
    }

    // Variante senza lettura del progresso, usata mentre getTappe sta
    // costruendo il catalogo risolto. Chiamare datiLivello da getTappe
    // creerebbe un giro getTappe -> progresso -> getTappe.
    function difficoltaEsposta(campaignId, fallback) {
        if (!haLivelli(campaignId)) return fallback || 'Medio';
        const id = statoLivelli(campaignId).livello || 'facile';
        const livello = LIVELLI.find((l) => l.id === id) || LIVELLI[0];
        return livello.duello;
    }

    /**
     * L'avanzamento salvato del livello ATTIVO, mai null: una campagna
     * mai iniziata è semplicemente a zero. Tutto il resto del file passa
     * da qui e da setProgress, quindi non sa nemmeno che i livelli esistono.
     */
    function getProgress(campaignId) {
        return leggiProgresso(campaignId, getLivelloAttivo(campaignId));
    }

    /** L'avanzamento di un livello preciso (null = la campagna senza livelli). */
    function leggiProgresso(campaignId, livello) {
        const salvato = window.SaveManager ? SaveManager.getStoryState(chiaveStato(campaignId, livello)) : null;
        const progress = {
            completate: (salvato && salvato.completate) || 0,
            finita: !!(salvato && salvato.finita),
            premiata: !!(salvato && salvato.premiata),
            // Quanto si è arrivati DENTRO ogni tappa che è a sua volta un
            // percorso (un torneo, vedi `kind: 'torneo'` nel catalogo):
            // { [id della tappa]: quante sue prove superate }. Va portato
            // avanti da ogni scrittura, altrimenti superare una tappa
            // qualunque cancellerebbe i progressi del torneo.
            sotto: Object.assign({}, (salvato && salvato.sotto) || {}),
            // I rami paralleli non fanno avanzare la linea di Yugi. Si
            // salvano per id, separati dai contatori posizionali.
            laterali: Object.assign({}, (salvato && salvato.laterali) || {})
        };
        // Un salvataggio mai scritto non ha niente da spostare: una
        // campagna a zero è a zero in qualunque forma del catalogo.
        if (!salvato) return progress;
        // Un avanzamento scritto prima del timbro `azzeraSeSenzaTimbro` è
        // troppo vecchio per essere riportato in pari in modo affidabile
        // (vedi il commento nel catalogo): riparte da zero. `premiata` si
        // conserva, o il premio finale si pagherebbe una seconda volta. La
        // prossima scrittura timbra, quindi l'azzeramento avviene una volta.
        const campagnaLetta = getCampaign(campaignId);
        const timbroBase = campagnaLetta && campagnaLetta.azzeraSeSenzaTimbro;
        if (timbroBase && (salvato.separazioni || []).indexOf(timbroBase) === -1) {
            return { completate: 0, finita: false, premiata: progress.premiata, sotto: {}, laterali: {} };
        }
        applicaSeparazioni(campaignId, progress, salvato.separazioni || []);
        return riempiAreeSuperate(campaignId, saltaPercorsiGiaFiniti(campaignId, progress));
    }

    /**
     * Un'AREA che la campagna ha già superato è finita per intero: la
     * campagna va oltre un'area solo completandola (avanzaTorneo scrive il
     * tabellone pieno nella stessa scrittura). Se il salvataggio dice
     * altro, è un danno, e lo si ripara leggendo.
     *
     * Il danno vero che ha fatto nascere questa funzione: fino alla beta
     * del 2026-10-09, rigiocare un duello già vinto dentro un'area FINITA
     * azzerava l'avanzamento di quell'area (era trattato come la rivincita
     * di un torneo, vedi consumaEsitoDuello). Chi l'ha fatto si ritrova le
     * tappe dell'area da rifare pur avendola chiusa — segnalato
     * dall'utente. Vale per ogni livello, perché passa da leggiProgresso.
     *
     * Solo le AREE: un TORNEO superato può legittimamente essere a zero
     * (rientrandoci per rifarlo, il tabellone riparte dal primo incontro).
     * Pura come le altre migrazioni di lettura: la forma riparata arriva
     * sul disco alla prossima scrittura.
     */
    function riempiAreeSuperate(campaignId, progress) {
        const tappe = getTappe(campaignId);
        tappe.slice(0, progress.completate).forEach((t) => {
            if (t.kind !== 'area') return;
            const totali = (t.tappe || []).filter((prova) => prova.parallelo !== true).length;
            if ((progress.sotto[t.id] || 0) < totali) progress.sotto[t.id] = totali;
        });
        return progress;
    }

    /**
     * Se la tappa corrente è un'area (o un torneo) con TUTTE le sue prove
     * già fatte, la campagna va oltre. Nel gioco normale non succede mai
     * — l'ultima prova vinta fa avanzare la campagna nello stesso istante
     * — ma può succedere a un salvataggio riportato in pari da più
     * migrazioni una sopra l'altra, se una di esse toglie a un'area le
     * tappe che il giocatore non aveva ancora giocato: arrivandoci
     * troverebbe un'area finita e nessun nodo da cliccare. È successo
     * davvero con una forma intermedia del Castello di Pegasus; oggi
     * nessuna voce del catalogo lo provoca, e questa resta la rete che
     * impedisce al prossimo errore dello stesso tipo di diventare un
     * vicolo cieco. Pura come applicaSeparazioni.
     */
    function saltaPercorsiGiaFiniti(campaignId, progress) {
        const tappe = getTappe(campaignId);
        while (progress.completate < tappe.length) {
            const t = tappe[progress.completate];
            if (SOTTOPERCORSI.indexOf(t.kind) === -1) break;
            const totali = (t.tappe || []).filter((prova) => prova.parallelo !== true).length;
            if (!totali || (progress.sotto[t.id] || 0) < totali) break;
            progress.completate++;
        }
        if (progress.completate >= tappe.length) progress.finita = true;
        return progress;
    }

    function setProgress(campaignId, progress) {
        if (!window.SaveManager) return;
        // Ogni scrittura porta il timbro di TUTTE le separazioni che il
        // catalogo conosce oggi: è ciò che distingue un salvataggio nato
        // con la forma attuale (da non toccare) da uno scritto prima (da
        // riportare in pari). Senza il timbro, il progresso di un giocatore
        // nuovo verrebbe "migrato" come se fosse vecchio.
        const campagna = getCampaign(campaignId);
        const timbro = ((campagna && campagna.separazioni) || []).map((s) => s.id);
        // Sempre nel livello ATTIVO: è lì che si sta giocando.
        SaveManager.setStoryState(chiaveStato(campaignId, getLivelloAttivo(campaignId)),
            Object.assign({}, progress, { separazioni: timbro }));
    }

    /**
     * Riporta in pari un salvataggio scritto PRIMA che un'area venisse
     * staccata da un'altra (vedi `separazioni` nel catalogo). Pura: non
     * scrive niente, la forma nuova arriva sul disco alla prossima
     * scrittura, col timbro — così leggere non ha effetti collaterali, e
     * rileggere lo stesso salvataggio vecchio dà sempre lo stesso esito.
     *
     * Tre forme, secondo `dalla` nella voce del catalogo: 'testa' qui
     * sotto, 'unione' e 'inserite' nelle loro funzioni. Una
     * voce può limitarsi ai salvataggi che portano (`soloSeTimbrato`) o
     * non portano (`saltaSeTimbrato`) un certo timbro: è così che si
     * distingue in quale forma passata del catalogo era stato scritto.
     *
     * `dalla: 'testa'` (il default): dalla TESTA di `da` sono state tolte
     * `quante` tappe per farne l'area `nuova`, messa subito PRIMA di lei.
     * Le tappe nate con la `nuova` stanno DOPO quelle staccate.
     *   - chi non era ancora arrivato a `da` non si accorge di niente;
     *   - chi era DENTRO `da` e non aveva ancora finito le tappe staccate
     *     si ritrova nella `nuova`, allo stesso punto;
     *   - chi le aveva finite ha la `nuova` fatta fino a lì e il resto di
     *     `da` dov'era. Se la `nuova` ha tappe che prima non esistevano,
     *     si comincia da quelle — è contenuto che non ha mai giocato, non
     *     un passo indietro;
     *   - chi aveva già superato `da` ha tutto fatto, compresa la `nuova`
     *     per intero, e la campagna un passo più avanti (una tappa in più
     *     sposta di uno tutte quelle dopo).
     */
    function applicaSeparazioni(campaignId, progress, giaApplicate) {
        const campagna = getCampaign(campaignId);
        const separazioni = (campagna && campagna.separazioni) || [];
        const tappe = getTappe(campaignId);
        separazioni.forEach((sep, j) => {
            if (giaApplicate.indexOf(sep.id) !== -1) return;
            // Una voce può valere solo per i salvataggi scritti in una certa
            // forma del catalogo, riconoscibile dal timbro che portano.
            if (sep.soloSeTimbrato && giaApplicate.indexOf(sep.soloSeTimbrato) === -1) return;
            if (sep.saltaSeTimbrato && giaApplicate.indexOf(sep.saltaSeTimbrato) !== -1) return;
            // La forma del catalogo SUBITO DOPO questa separazione: quella
            // di oggi, meno le aree staccate più tardi. Con una sola
            // separazione le due cose coincidono.
            const successive = separazioni.slice(j + 1).reduce((ids, s) => {
                if (s.nuova) ids.push(s.nuova);
                if (Array.isArray(s.nuove)) ids.push.apply(ids, s.nuove);
                return ids;
            }, []);
            const forma = tappe.filter((t) => successive.indexOf(t.id) === -1);
            if (sep.dalla === 'laterali') {
                (sep.aree || []).forEach((areaId) => {
                    const area = forma.find((t) => t.id === areaId);
                    if (!area) return;
                    const fatteVecchie = progress.sotto[areaId] || 0;
                    const prefisso = (area.tappe || []).slice(0, fatteVecchie);
                    progress.sotto[areaId] = prefisso.filter((t) => t.parallelo !== true).length;
                    progress.laterali = progress.laterali || {};
                    prefisso.filter((t) => t.parallelo === true).forEach((t) => {
                        progress.laterali[areaId + ':' + t.id] = true;
                    });
                });
                return;
            }
            if (sep.dalla === 'principali-inserite' || sep.dalla === 'principali-fine') {
                const area = forma.find((t) => t.id === sep.area);
                if (!area) return;
                // La forma dell'area SUBITO DOPO questa voce: senza le tappe
                // inserite dalle voci successive che le elencano (`ids`).
                // Senza questo filtro, una tappa inserita più tardi PRIMA di
                // questo punto spostava di uno la posizione calcolata qui.
                const insertePiuTardi = separazioni.slice(j + 1)
                    .filter((s) => s.area === sep.area && Array.isArray(s.ids))
                    .reduce((acc, s) => acc.concat(s.ids), []);
                const principali = (area.tappe || [])
                    .filter((t) => t.parallelo !== true && insertePiuTardi.indexOf(t.id) === -1);
                const fatte = progress.sotto[sep.area] || 0;
                const quante = Array.isArray(sep.ids) ? sep.ids.length : sep.quante;
                // Con `ids` la posizione è quella della prima tappa inserita,
                // ovunque sia (anche in fondo); senza, la forma storica.
                const nuovaPosizione = Array.isArray(sep.ids)
                    ? principali.findIndex((t) => t.id === sep.ids[0])
                    : (sep.dalla === 'principali-fine'
                        ? principali.length - quante
                        : principali.findIndex((t) => t.id === sep.prima) - quante);
                if (nuovaPosizione >= 0 && fatte > nuovaPosizione) {
                    // Mai oltre il totale delle principali: chi aveva già
                    // finito l'area (contatore al massimo, vedi 'laterali'
                    // e 'inserite') non deve ritrovarsi con più prove fatte
                    // di quante l'area ne abbia — a ogni tappa inserita il
                    // numero cresceva di uno, fino a 19 su 17.
                    progress.sotto[sep.area] = Math.min(fatte + quante, principali.length);
                }
                return;
            }
            if (sep.dalla === 'tappe') {
                applicaTappeLineariInserite(sep, forma, progress);
                return;
            }
            if (sep.dalla === 'unione') {
                applicaUnione(sep, forma, progress);
                return;
            }
            if (sep.dalla === 'inserite') {
                applicaTappeInserite(sep, forma, progress);
                return;
            }
            const i = forma.findIndex((t) => t.id === sep.nuova);
            if (i === -1) return;
            const totaleNuova = (forma[i].tappe || []).length;
            const fatteInDa = progress.sotto[sep.da] || 0;
            const C = progress.completate;
            if (C < i) return;
            if (C > i) {
                progress.completate = C + 1;
                progress.sotto[sep.nuova] = totaleNuova;
                progress.sotto[sep.da] = Math.max(0, fatteInDa - sep.quante);
                return;
            }
            // Era dentro `da`.
            if (fatteInDa < sep.quante) {
                progress.sotto[sep.nuova] = fatteInDa;
                progress.sotto[sep.da] = 0;
                return;
            }
            progress.sotto[sep.nuova] = sep.quante;
            progress.sotto[sep.da] = fatteInDa - sep.quante;
            // Nessuna tappa nuova da giocare nella `nuova`: è già finita, e
            // lasciarla "corrente" con tutte le prove fatte bloccherebbe la
            // campagna su un nodo senza niente da cliccare.
            if (sep.quante >= totaleNuova) progress.completate = C + 1;
        });
        return progress;
    }

    /**
     * `dalla: 'unione'` — il contrario di una separazione: l'area `vecchia`,
     * che stava subito DOPO `dentro` sulla mappa grande, ora è la coda di
     * `dentro` (le sue `quante` tappe sono le ultime di `dentro`). Chi era
     * dentro la `vecchia` si ritrova allo stesso punto dentro `dentro`, e
     * chi l'aveva superata vede la campagna un passo più indietro nei
     * numeri — ma nello stesso punto del racconto, perché c'è un nodo in
     * meno sulla mappa grande.
     */
    function applicaUnione(sep, forma, progress) {
        const i = forma.findIndex((t) => t.id === sep.dentro);
        if (i === -1) return;
        const totale = (forma[i].tappe || []).length;
        const fatteInVecchia = progress.sotto[sep.vecchia] || 0;
        const C = progress.completate;
        delete progress.sotto[sep.vecchia];
        if (C === i + 1) {
            progress.completate = i;
            progress.sotto[sep.dentro] = (totale - sep.quante) + fatteInVecchia;
        } else if (C > i + 1) {
            progress.completate = C - 1;
            progress.sotto[sep.dentro] = totale;
        }
    }

    /**
     * `dalla: 'inserite'` — dentro l'area `area` sono nate `quante` tappe
     * nuove subito PRIMA della tappa `prima`, che c'era già. Chi non era
     * ancora arrivato a `prima` le troverà sulla sua strada; chi l'aveva
     * già superata non le deve rigiocare; chi aveva già finito l'area la
     * ritrova finita, compresa quella parte nuova.
     */
    function applicaTappeInserite(sep, forma, progress) {
        const i = forma.findIndex((t) => t.id === sep.area);
        if (i === -1) return;
        const lista = forma[i].tappe || [];
        const C = progress.completate;
        if (C > i) { progress.sotto[sep.area] = lista.length; return; }
        if (C < i) return;
        const posizioneVecchia = lista.findIndex((t) => t.id === sep.prima) - sep.quante;
        const fatte = progress.sotto[sep.area] || 0;
        if (posizioneVecchia >= 0 && fatte > posizioneVecchia) progress.sotto[sep.area] = fatte + sep.quante;
    }

    /**
     * `dalla: 'tappe'` — una o più scene sono state inserite nel percorso
     * lineare subito prima di una tappa già esistente. È l'equivalente di
     * `inserite` per campagne senza aree annidate: chi aveva già superato
     * quel punto conserva lo stesso punto narrativo, chi non c'era ancora
     * incontra normalmente i nuovi intermezzi.
     */
    function applicaTappeLineariInserite(sep, forma, progress) {
        const quante = (sep.nuove || []).length || sep.quante || 0;
        const indicePrima = forma.findIndex((t) => t.id === sep.prima);
        if (!quante || indicePrima < quante) return;
        const posizioneVecchia = indicePrima - quante;
        if (progress.completate > posizioneVecchia) progress.completate += quante;
    }

    /**
     * Le tappe con il loro stato, pronte da disegnare:
     *   'fatta'      già superata
     *   'corrente'   la prossima da affrontare — l'unica giocabile
     *   'bloccata'   ancora da sbloccare
     *
     * Una sola tappa è 'corrente', sempre: è ciò che rende una Storia una
     * storia invece di un elenco di duelli a scelta libera.
     */
    function getTappeConStato(campaignId) {
        const progress = getProgress(campaignId);
        return getTappe(campaignId).map((tappa) => Object.assign({}, tappa, {
            stato: tappa.indice < progress.completate ? 'fatta'
                : (tappa.indice === progress.completate ? 'corrente' : 'bloccata')
        }));
    }

    /** La prossima tappa da affrontare, o null se la campagna è finita. */
    function getTappaCorrente(campaignId) {
        const progress = getProgress(campaignId);
        const tappe = getTappe(campaignId);
        return tappe[progress.completate] || null;
    }

    /**
     * Segna come superata la tappa corrente e va avanti. Torna lo stato
     * nuovo, con `appenaFinita` vero se è stata questa a chiudere la
     * campagna — serve alla pagina per mostrare la schermata finale una
     * volta sola.
     *
     * Le scene si superano leggendole; i duelli, vincendoli.
     */
    function avanza(campaignId, opzioni) {
        const tappe = getTappe(campaignId);
        const progress = getProgress(campaignId);
        if (progress.completate >= tappe.length) return { progress: progress, appenaFinita: false };

        const nuovo = {
            completate: progress.completate + 1,
            finita: progress.completate + 1 >= tappe.length,
            premiata: progress.premiata,
            // `opzioni.sotto`: chi chiude un'area o un torneo passa qui il
            // suo tabellone pieno, così area piena e campagna avanzata
            // finiscono nella STESSA scrittura. Scriverli in due tempi
            // lascerebbe in mezzo uno stato "area corrente già piena", che
            // saltaPercorsiGiaFiniti leggerebbe come da saltare: la
            // campagna farebbe due passi invece di uno.
            sotto: Object.assign({}, progress.sotto, (opzioni && opzioni.sotto) || {}),
            laterali: Object.assign({}, progress.laterali || {})
        };
        const appenaFinita = nuovo.finita && !progress.finita;
        setProgress(campaignId, nuovo);
        // La progressione narrativa è anche la fonte delle ricompense
        // uniche di capitolo. Un capitolo è concluso quando tutte le sue
        // tappe esterne sono prima del cursore; le aree interne arrivano
        // qui soltanto dopo essere state completate per intero.
        if (window.CardAcquisition) {
            const capitoli = capitoliCompletati(tappe, nuovo.completate);
            CardAcquisition.onStoryProgress(campaignId, getLivelloAttivo(campaignId), capitoli, nuovo.finita);
        }
        // Illustrazioni alternative a TAPPA FISSA (js/data/artwork-alternativi.js): oggi solo Memorie
        // Proibite a Difficile, un capitolo ciascuna. Una volta sola; va annunciata, altrimenti il
        // giocatore non saprebbe da dove arriva (vedi challenge-banner.js).
        if (window.ArtworkAlternativi) {
            const livelloNome = getLivelloAttivo(campaignId);
            const voci = ArtworkAlternativi.premiaStoria(campaignId, livelloNome, capitoliCompletati(tappe, nuovo.completate));
            if (voci.length && window.ChallengeTracker && typeof ChallengeTracker.announce === 'function') {
                ChallengeTracker.announce({ icon: '🖼️', label: 'Nuova illustrazione!', description: 'Premio della Storia a Difficile' }, voci);
            }
        }
        // Finire la storia a Facile apre gli altri livelli, per sempre.
        if (nuovo.finita && getLivelloAttivo(campaignId) === 'facile') segnaSblocco(campaignId);
        // Le Sfide delle storie (sezione 'storia' in
        // js/data/challenges-db.js) contano le tappe superate, e questo è
        // il punto unico da cui passano tutte — scene e duelli, tappe
        // della campagna e prove di un torneo interno. Agganciarsi qui
        // invece che nei punti che chiamano avanza() è la stessa scelta
        // già fatta per ogni altro tipo di Sfida: un solo posto, e una
        // sfida nuova non richiede una riga di motore.
        //
        // Unica eccezione, `senzaSfida`: chiudere un'AREA. Le sue tappe
        // sono già state contate una per una mentre si giocavano (vedi
        // contaTappaPerLeSfide in avanzaTorneo), e contare anche il nodo
        // che le contiene le conterebbe una volta di troppo.
        if (!(opzioni && opzioni.senzaSfida)) contaTappaPerLeSfide(campaignId);
        if (appenaFinita) segnaStoriaCompletataPerLeSfide(campaignId);
        return { progress: nuovo, appenaFinita: appenaFinita };
    }

    /**
     * Le Sfide "completa questa storia a Normale / a Difficile / a tutti e
     * tre i livelli" (richiesta dell'utente). Il tipo 'storyProgress' non
     * basta: conta le tappe solo a Facile, apposta (vedi qui sotto).
     *   'storyCompleted'  { campaignId, livello } — una per partita finita;
     *   'storyAllLevels'  { campaignId }          — quando, finita questa,
     *                     risultano finiti TUTTI i livelli.
     * Solo le campagne con i livelli: per quelle senza (la Grande Guerra)
     * "completala" lo dice già 'storyProgress'.
     * Rifinire una partita dopo un "Ricomincia" registra di nuovo: la
     * sfida (target 1) è già completata e il premio non si ripaga.
     */
    function segnaStoriaCompletataPerLeSfide(campaignId) {
        const livello = getLivelloAttivo(campaignId);
        if (!livello || !window.ChallengeTracker) return;
        ChallengeTracker.recordProgress('storyCompleted', { campaignId: campaignId, livello: livello });
        if (LIVELLI.every((l) => leggiProgresso(campaignId, l.id).finita)) {
            ChallengeTracker.recordProgress('storyAllLevels', { campaignId: campaignId });
        }
    }

    function contaTappaPerLeSfide(campaignId) {
        // Solo la PRIMA partita, cioè Facile (o la campagna senza livelli).
        // Le Sfide delle storie chiedono "quanto sei andato avanti in
        // questa storia"; rigiocarla a Normale e Difficile ricontando ogni
        // tappa le farebbe completare a metà della seconda partita, con un
        // "Completa il Regno delle Ombre" che non corrisponde a niente.
        const livello = getLivelloAttivo(campaignId);
        if (livello && livello !== 'facile') return;
        if (window.ChallengeTracker) {
            ChallengeTracker.recordProgress('storyProgress', { campaignId: campaignId });
        }
    }

    /**
     * Legge (e CONSUMA) la breadcrolla lasciata dall'ultimo duello, e se
     * era un duello di QUESTA campagna vinto dal giocatore fa avanzare la
     * storia.
     *
     * Consumarla è la parte importante: senza, un semplice ricaricamento
     * della pagina farebbe avanzare di nuovo la campagna con lo stesso
     * duello, e si arriverebbe in fondo senza giocare.
     *
     * Torna { avanzato, appenaFinita, perso } — `perso` distingue "hai
     * perso, riprova" da "non sei appena tornato da un duello", che sono
     * due cose diverse da raccontare.
     */
    function consumaEsitoDuello(campaignId) {
        let esito = null;
        try {
            const raw = sessionStorage.getItem(OUTCOME_KEY);
            if (raw) esito = JSON.parse(raw);
            sessionStorage.removeItem(OUTCOME_KEY);
        } catch (e) { /* noop */ }

        if (!esito || esito.mode !== 'story' || esito.campaignId !== campaignId) {
            return { avanzato: false, appenaFinita: false, perso: false, rigiocata: false, torneoId: null, opponentId: null };
        }

        // Un ramo parallelo registra soltanto il proprio esito. Non sale
        // nel percorso dell'area e non può completare la campagna.
        if (esito.torneoId && esito.lateraleId) {
            if (esito.playerWon === true) completaLaterale(campaignId, esito.torneoId, esito.lateraleId);
            return {
                avanzato: false, appenaFinita: false,
                perso: esito.playerWon !== true,
                rigiocata: esito.rigiocata === true,
                laterale: true, torneoId: esito.torneoId,
                opponentId: esito.opponentId || null
            };
        }

        // --- Duello di un TORNEO -------------------------------------
        // Regole diverse dal resto della campagna, ed è il punto: vincendo
        // si sale di un incontro, perdendo si ricomincia dal primo.
        if (esito.torneoId && getTorneo(campaignId, esito.torneoId)) {
            // Un torneo GIÀ vinto che si sta rifacendo: dentro vale tutto
            // come la prima volta (si sale, perdendo si ricomincia), ma
            // alla fine la campagna non si muove.
            const rigiocato = esito.rigiocata === true;
            const base = {
                avanzato: false, appenaFinita: false, perso: false, rigiocata: rigiocato,
                torneoId: esito.torneoId, opponentId: esito.opponentId || null
            };
            if (esito.playerWon !== true) {
                // In un TORNEO si ricomincia dal primo incontro; in
                // un'AREA si resta dov'eravamo e si riprova quella tappa.
                // Vedi azzeraSePerso: è l'unica differenza fra i due.
                if (!azzeraSePerso(getTorneo(campaignId, esito.torneoId))) {
                    return Object.assign(base, { perso: true, torneoAzzerato: 0 });
                }
                const quante = getProgressoTorneo(campaignId, esito.torneoId);
                azzeraTorneo(campaignId, esito.torneoId);
                // `torneoAzzerato` porta da quanto si è caduti: dirlo è
                // tutta la differenza fra una punizione capita e una
                // mappa che si è misteriosamente svuotata.
                return Object.assign(base, { perso: true, torneoAzzerato: quante });
            }
            // In un'AREA "rigiocata" vuol dire UNA tappa già superata, non
            // l'intero percorso (in un'area le tappe fatte restano
            // cliccabili, in un torneo no). Non deve far salire niente:
            // prima saliva di un passo — saltando la tappa ancora da giocare
            // — e in un'area già finita andava oltre la fine, azzerava l'area
            // e la dichiarava vinta, rimandando alla mappa grande
            // (segnalato dall'utente: "fatto un nodo, mi riporta alla mappa
            // principale"). Stesso difetto già chiuso per le scene rilette,
            // vedi apriProva in storia.html.
            if (rigiocato && getTorneo(campaignId, esito.torneoId).kind === 'area') {
                return Object.assign(base, { vinta: true });
            }
            const salita = avanzaTorneo(campaignId, esito.torneoId, rigiocato);
            return Object.assign(base, {
                avanzato: true,
                torneoVinto: salita.torneoVinto,
                appenaFinita: salita.appenaFinita
            });
        }
        // Una tappa RIGIOCATA non fa avanzare niente: era già superata, e
        // rivincerla salterebbe la tappa successiva senza giocarla. Il
        // duello per il resto è del tutto normale — premi compresi,
        // esattamente come un Duello Libero, che è rigiocabile da sempre.
        if (esito.rigiocata === true) {
            return {
                avanzato: false, appenaFinita: false, perso: false,
                rigiocata: true, vinta: esito.playerWon === true,
                opponentId: esito.opponentId || null
            };
        }
        if (esito.playerWon !== true) {
            return { avanzato: false, appenaFinita: false, perso: true, rigiocata: false, opponentId: esito.opponentId || null };
        }
        const risultato = avanza(campaignId);
        return {
            avanzato: true, appenaFinita: risultato.appenaFinita, perso: false, rigiocata: false,
            // Chi si e' appena battuto: serve alla pagina per dirlo, e
            // arriva dall'esito del duello perche' la tappa a quel punto
            // e' gia' alle spalle.
            opponentId: esito.opponentId || null
        };
    }

    /**
     * Paga il premio finale della campagna, una volta sola. Torna
     * l'elenco delle voci accreditate (vuoto se era già stato pagato o se
     * la campagna non ne ha uno), ognuna con la propria spiegazione —
     * stesso contratto di tutto js/economy/rewards.js, dove sta anche
     * l'unica regola che conta: nessuna pagina accredita valute per conto
     * proprio.
     */
    function riscuotiPremioFinale(campaignId) {
        const campagna = getCampaign(campaignId);
        const progress = getProgress(campaignId);
        if (!campagna || !campagna.premioFinale || !progress.finita || progress.premiata) return [];
        if (!window.Rewards || !window.SaveManager) return [];

        // Ogni livello ha il suo avanzamento, quindi anche il suo `premiata`:
        // finire la storia a Normale e poi a Difficile paga due volte, e più
        // di Facile (vedi `moltiplicatorePremio`), perché sono due imprese
        // diverse — rigiocare lo STESSO livello invece non paga più.
        const voci = Rewards.forStoryCampaign(campagna, datiLivello(campaignId));
        setProgress(campaignId, Object.assign({}, progress, { premiata: true }));
        return voci;
    }

    /** Ricomincia una campagna da capo. Il premio finale, se già preso, resta preso. */
    function ricomincia(campaignId) {
        const progress = getProgress(campaignId);
        // `sotto` non si porta dietro: ricominciando la campagna anche i
        // tornei che contiene tornano al primo incontro.
        setProgress(campaignId, { completate: 0, finita: false, premiata: progress.premiata, sotto: {}, laterali: {} });
    }

    /**
     * Porta la campagna (livello attivo) a `completate` tappe superate,
     * senza giocarle. Solo per gli strumenti di prova (js/dev/). Passa da
     * setProgress apposta: scrivere lo stato a mano con
     * SaveManager.setStoryState, come facevano prima, lo lasciava senza
     * timbro — e le migrazioni lo spostavano come un salvataggio vecchio —
     * e lo scriveva sempre nella partita a Facile, qualunque livello si
     * stesse provando. Le tappe-percorso già superate risultano piene.
     */
    function forzaAvanzamento(campaignId, completate) {
        const tappe = getTappe(campaignId);
        const n = Math.max(0, Math.min(tappe.length, completate));
        const progress = getProgress(campaignId);
        const sotto = {};
        tappe.slice(0, n).forEach((t) => {
            if (SOTTOPERCORSI.indexOf(t.kind) !== -1) sotto[t.id] = (t.tappe || []).filter((prova) => prova.parallelo !== true).length;
        });
        setProgress(campaignId, {
            completate: n, finita: n >= tappe.length, premiata: n >= tappe.length ? progress.premiata : false, sotto: sotto
        });
    }

    // =================================================================
    // TAPPE CHE SONO A LORO VOLTA UN PERCORSO (kind: 'torneo')
    // =================================================================
    // Un torneo è una tappa della campagna che, invece di risolversi in
    // un solo duello, contiene un proprio elenco di prove su una propria
    // mappa. Vale la regola del gioco originale: si sale un incontro
    // alla volta, e chi perde ricomincia dal primo. La campagna intorno
    // non si muove finché il torneo non è vinto per intero.

    /**
     * I due tipi di tappa che sono a loro volta un PERCORSO. Strutturalmente
     * identici — mappa propria, elenco di tappe proprio, avanzamento in
     * `sotto` — e infatti da qui in giù li tratta lo stesso codice. Cambia
     * UNA regola sola, e sta tutta in `azzeraSePerso` qui sotto: in un
     * TORNEO chi perde ricomincia dal primo incontro, in un'AREA no.
     *
     * Perché l'area esiste: una campagna può essere fatta di macro-zone
     * (Il Regno dei Duellanti, Battle City, il Mondo Virtuale...), ognuna
     * con la sua mappa e le sue tappe. È la stessa forma di un torneo, ma
     * non la stessa cosa: un torneo è una prova, e ricominciare da capo ne
     * è il senso; un'area è un pezzo di racconto, e rispedire indietro di
     * otto duelli chi ne perde uno renderebbe la storia una punizione.
     */
    const SOTTOPERCORSI = ['torneo', 'area'];
    function azzeraSePerso(tappa) {
        return !!(tappa && tappa.kind === 'torneo');
    }

    /** La tappa-percorso (torneo o area) con quell'id, o null se non esiste in questa campagna. */
    function getTorneo(campaignId, tappaId) {
        const tappa = getTappe(campaignId).find((t) => t.id === tappaId);
        return (tappa && SOTTOPERCORSI.indexOf(tappa.kind) !== -1) ? tappa : null;
    }

    /** Quante prove del torneo sono già state superate. */
    function getProgressoTorneo(campaignId, tappaId) {
        return getProgress(campaignId).sotto[tappaId] || 0;
    }

    function setProgressoTorneo(campaignId, tappaId, quante) {
        const progress = getProgress(campaignId);
        const sotto = Object.assign({}, progress.sotto);
        sotto[tappaId] = quante;
        setProgress(campaignId, Object.assign({}, progress, { sotto: sotto }));
    }

    /**
     * Le prove di un torneo con il loro stato, nella stessa forma delle
     * tappe della campagna ('fatta' / 'corrente' / 'bloccata'): così la
     * pagina può disegnarle con la stessa mappa a nodi, senza sapere che
     * sta guardando un torneo invece di una campagna.
     */
    function getProveConStato(campaignId, tappaId) {
        const torneo = getTorneo(campaignId, tappaId);
        if (!torneo) return [];
        const fatte = getProgressoTorneo(campaignId, tappaId);
        // Dentro un torneo si è la stessa persona che si era sulla tappa
        // che lo contiene: il protagonista lo si eredita da lì, già
        // risolto (capitolo, poi campagna) da getTappe.
        const tappaContenitore = getTappe(campaignId).find((t) => t.id === tappaId);
        const lista = torneo.tappe || [];
        const principali = lista.filter((prova) => prova.parallelo !== true);
        const laterali = getProgress(campaignId).laterali || {};
        return lista.map((prova, i) => {
            const pg = prova.kind === 'duel' ? getPersonaggio(prova.characterId) : null;
            const indicePrincipale = principali.indexOf(prova);
            let stato;
            if (prova.parallelo === true) {
                const chiave = tappaId + ':' + prova.id;
                const ancora = principali.findIndex((entry) => entry.id === prova.sbloccaDopo);
                const ancoraLaterale = tappaId + ':' + prova.sbloccaDopo;
                const disponibile = (ancora >= 0 && fatte > ancora)
                    || (ancora < 0 && prova.sbloccaDopo && laterali[ancoraLaterale])
                    || !prova.sbloccaDopo;
                stato = laterali[chiave] ? 'fatta' : (disponibile ? 'disponibile' : 'bloccata');
            } else {
                stato = indicePrincipale < fatte ? 'fatta' : (indicePrincipale === fatte ? 'corrente' : 'bloccata');
            }
            return Object.assign({}, prova, {
                indice: i,
                torneoId: tappaId,
                // Una prova può dichiarare il suo (il Duello Cerimoniale: lo
                // gioca Yugi Muto, non il Faraone) — stessa regola di
                // resolvePlayer in js/duel-session.js.
                protagonista: prova.protagonista || (tappaContenitore && tappaContenitore.protagonista) || null,
                // Stessa eredità per arena e musica: la tappa-percorso
                // (l'area/torneo che contiene questa prova) ha già il
                // proprio `field`/`music` risolto da getTappe — il suo, se
                // lo dichiara, altrimenti quello del capitolo. Così basta
                // scrivere la musica UNA volta sul capitolo di un'intera
                // macromappa (es. un'area del Regno delle Ombre) perché
                // ogni duello al suo interno la erediti, senza ripeterla
                // su ciascuno. Il fallback finale alla campagna intera
                // resta in urlDuello, non qui — stesso motivo del commento
                // gemello in getTappe qui sopra.
                field: prova.field || (tappaContenitore && tappaContenitore.field)
                    || campoDellaCampagna(getCampaign(campaignId), prova.id) || null,
                music: prova.music || (tappaContenitore && tappaContenitore.music)
                    || (getCampaign(campaignId) && getCampaign(campaignId).musicaDuello) || null,
                difficulty: difficoltaEsposta(campaignId, prova.difficulty),
                immagine: pg && typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(pg.image) : (pg ? pg.image : null),
                nomeAvversario: pg ? pg.name : null,
                stato: stato
            });
        });
    }

    function completaLaterale(campaignId, tappaId, provaId) {
        const progress = getProgress(campaignId);
        const laterali = Object.assign({}, progress.laterali || {});
        laterali[tappaId + ':' + provaId] = true;
        setProgress(campaignId, Object.assign({}, progress, { laterali: laterali }));
    }

    // =================================================================
    // PIÙ MAPPE DENTRO UN PERCORSO (`mappeSuccessive`)
    // =================================================================
    // Un'area può attraversare più luoghi disegnati: il Regno dei
    // Duellanti è l'isola e poi, battuto Kaiba al cancello, gli interni
    // del castello. Resta UN solo percorso — un solo elenco di tappe, un
    // solo contatore in `sotto`, una sola voce nella striscia dei capitoli
    // — e cambia soltanto su quale disegno stanno le sue tappe. Per questo
    // le mappe in più si dichiarano con la tappa da cui cominciano
    // (`daTappa`) invece di spezzare l'elenco: tutto ciò che conta le
    // tappe (avanzamento, Sfide, migrazioni) non sa nemmeno che esistono.
    //
    //   mappa: { sfondo, larghezza, altezza, nome },     ← la prima
    //   mappeSuccessive: [{
    //       daTappa: '<id della prima tappa su questa mappa>',
    //       nome, testo, sfondo, larghezza, altezza,
    //       uscita:   { x, y, icona, label },  ← il passaggio, sulla mappa PRIMA
    //       ingresso: { x, y, icona, label }   ← il ritorno, su QUESTA mappa
    //   }]
    //
    // Le coordinate delle tappe sono quelle del disegno su cui stanno.

    /**
     * Le mappe ("pagine") di un percorso, in ordine, ognuna con l'intervallo
     * di tappe che porta: [{ indice, nome, testo, mappa, da, a, uscita,
     * ingresso }], `a` escluso. Un percorso senza mappe successive ha una
     * pagina sola che le contiene tutte. Lavora sul dato grezzo del
     * catalogo, così la usa anche l'Editor Mappa.
     *
     * Una mappa successiva con un `daTappa` inesistente, o che non viene
     * DOPO la precedente, si scarta: meglio un'area su una mappa sola che
     * tappe finite su un disegno che non è il loro.
     */
    function pagineDelPercorso(percorso) {
        const tappe = (percorso && percorso.tappe) || [];
        const prima = (percorso && percorso.mappa) || {};
        const pagine = [{
            indice: 0,
            nome: prima.nome || (percorso && (percorso.nome || percorso.label)) || '',
            testo: prima.testo || '',
            mappa: prima, da: 0
        }];
        ((percorso && percorso.mappeSuccessive) || []).forEach((m) => {
            const da = tappe.findIndex((t) => t.id === m.daTappa);
            if (da <= pagine[pagine.length - 1].da) return;
            pagine.push({
                indice: pagine.length, nome: m.nome || '', testo: m.testo || '',
                mappa: m, da: da, uscita: m.uscita || null, ingresso: m.ingresso || null
            });
        });
        pagine.forEach((p, i) => { p.a = i + 1 < pagine.length ? pagine[i + 1].da : tappe.length; });
        return pagine;
    }

    /**
     * Le pagine di un percorso con dentro le loro prove GIÀ con lo stato
     * (vedi getProveConStato), più `corrente`: l'indice della pagina su
     * cui sta la prova da giocare — o l'ultima, se sono fatte tutte.
     */
    function getPagineConStato(campaignId, tappaId) {
        const torneo = getTorneo(campaignId, tappaId);
        if (!torneo) return { pagine: [], corrente: 0 };
        const prove = getProveConStato(campaignId, tappaId);
        const pagine = pagineDelPercorso(torneo).map((p) => Object.assign({}, p, {
            prove: prove.slice(p.da, p.a)
        }));
        // Nessuna prova corrente: o il percorso è finito (si resta
        // sull'ultima mappa, dove è finito) o non è ancora raggiunto (si
        // guarda dalla prima, dove comincerà).
        let corrente = pagine.findIndex((p) => p.prove.some((x) => x.stato === 'corrente'));
        if (corrente === -1) {
            corrente = prove.length && prove.every((x) => x.stato === 'fatta') ? pagine.length - 1 : 0;
        }
        return { pagine: pagine, corrente: corrente };
    }

    /**
     * Supera una prova del torneo. Se era l'ultima, il torneo è vinto e
     * la CAMPAGNA avanza di una tappa (quella del torneo stesso).
     *
     * `rigiocata`: il torneo era GIÀ stato vinto e lo si sta rifacendo.
     * Vale la stessa regola di una tappa qualunque rigiocata — si gioca
     * per davvero, premi compresi, ma la storia non fa un secondo passo
     * (lo farebbe saltando la tappa dopo senza giocarla). In quel caso
     * il tabellone, finito, torna a zero invece di restare pieno: così
     * il nodo si può riaprire ancora, che è tutto il senso di poterlo
     * rigiocare.
     */
    function avanzaTorneo(campaignId, tappaId, rigiocata) {
        const torneo = getTorneo(campaignId, tappaId);
        if (!torneo) return { avanzato: false, torneoVinto: false, appenaFinita: false };
        const quante = getProgressoTorneo(campaignId, tappaId) + 1;
        const totali = (torneo.tappe || []).filter((prova) => prova.parallelo !== true).length;
        // Per le Sfide delle storie, dentro un'AREA ogni tappa è una tappa
        // della storia a pieno titolo (un'area È un pezzo di campagna,
        // solo disegnato su una mappa sua): si conta qui, una per una, e
        // chiudendo l'area la campagna avanza senza contare di nuovo. Un
        // TORNEO resta invece UNA tappa sola, come sempre: le sue prove si
        // rifanno da capo a ogni sconfitta, e contarle gonfierebbe le
        // Sfide a chi perde di più. Rigiocare non conta: la tappa era già
        // stata contata la prima volta.
        const eArea = torneo.kind === 'area';
        if (eArea && rigiocata !== true) contaTappaPerLeSfide(campaignId);
        if (quante < totali) {
            setProgressoTorneo(campaignId, tappaId, quante);
            return { avanzato: true, torneoVinto: false, appenaFinita: false };
        }
        if (rigiocata === true) {
            setProgressoTorneo(campaignId, tappaId, 0);
            return { avanzato: true, torneoVinto: true, appenaFinita: false, rigiocata: true };
        }
        // Vinto la prima volta: il tabellone resta "pieno" e la campagna
        // fa il suo passo.
        const esito = avanza(campaignId, { senzaSfida: eArea, sotto: { [tappaId]: totali } });
        return { avanzato: true, torneoVinto: true, appenaFinita: esito.appenaFinita };
    }

    /**
     * Si riparte dal primo incontro. È la regola che dà peso al torneo:
     * nella campagna perdere non costa niente e si riprova la stessa
     * tappa, qui si perde la scalata.
     */
    function azzeraTorneo(campaignId, tappaId) {
        setProgressoTorneo(campaignId, tappaId, 0);
    }

    /**
     * Le carte di `deck` che questa campagna NON accetta, già raggruppate
     * per nome con il numero di copie: [{ id, nome, copie, motivo }].
     * Elenco vuoto = si può giocare.
     *
     * Serve a non far partire un duello con un mazzo fuori tema — e
     * soprattutto a DIRE QUALI carte sono di troppo. Un "non puoi giocare
     * questa campagna" senza l'elenco lascerebbe il giocatore a
     * indovinare su quaranta carte.
     *
     * Torna un elenco vuoto anche quando la campagna non dichiara nulla
     * (nessuna restrizione) o quando il database delle carte non è
     * caricato: un controllo che non può essere fatto non deve
     * trasformarsi in un divieto.
     */
    function carteNonAmmesse(campaignId, deck) {
        const campagna = getCampaign(campaignId);
        const regole = campagna && campagna.carteAmmesse;
        if (!regole || typeof cardDatabase === 'undefined' || !deck) return [];

        const origini = regole.origini || null;
        const conteggio = new Map();
        const voci = (deck.main || []).concat(deck.extra || []);
        voci.forEach((voce) => {
            const carta = cardDatabase.find((c) => c.id === voce.id);
            if (!carta) return;
            // Una carta senza `origin` è Yu-Gi-Oh: è il caso della quasi
            // totalità del database, dove il campo si scrive solo quando
            // fa eccezione.
            const origine = carta.origin || 'yu-gi-oh';
            let motivo = null;
            if (origini && origini.indexOf(origine) === -1) {
                motivo = `carta ${origine.toUpperCase()}`;
            } else if (regole.fazione && carta.fazione && carta.fazione !== regole.fazione) {
                motivo = `schieramento ${carta.fazione}`;
            }
            if (!motivo) return;
            const gia = conteggio.get(carta.id);
            if (gia) { gia.copie += (voce.qty || 1); return; }
            conteggio.set(carta.id, { id: carta.id, nome: carta.name, copie: voce.qty || 1, motivo: motivo });
        });
        return [...conteggio.values()];
    }

    /** Come si riassume a parole la regola di una campagna, per dirlo al giocatore prima che sbatta contro il divieto. */
    function descriviCarteAmmesse(campaignId) {
        const campagna = getCampaign(campaignId);
        const regole = campagna && campagna.carteAmmesse;
        if (!regole || !regole.origini) return null;
        const etichette = (window.CARD_ORIGIN_LABELS || {});
        const nomi = regole.origini.map((o) => etichette[o] || o).join(' o ');
        return regole.fazione
            ? `Solo carte ${nomi}, schieramento ${regole.fazione}`
            : `Solo carte ${nomi}`;
    }

    /**
     * L'URL del duello per una tappa, con tutto ciò che serve a tornare
     * indietro nel punto giusto.
     *
     * `opzioni.rigiocata`: è una tappa GIÀ superata che si sta rigiocando.
     * Il duello è identico in tutto — stesso avversario, stessa arena,
     * stessi premi di un duello qualunque — ma la storia non deve
     * avanzare una seconda volta. Il segno viaggia nell'URL e da lì nella
     * breadcrolla dell'esito, perché è l'unica cosa che sopravvive al
     * passaggio da questa pagina al duello e ritorno.
     */
    /** Il `campoDuello` di una campagna per una tappa: un percorso, o uno fra più scelto in modo stabile dall'id della tappa. */
    function campoDellaCampagna(campagna, tappaId) {
        const campo = campagna && campagna.campoDuello;
        if (!campo) return null;
        if (!Array.isArray(campo)) return campo;
        let h = 0;
        for (const ch of String(tappaId || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return campo[h % campo.length];
    }

    function urlDuello(campaignId, tappa, opzioni) {
        const params = new URLSearchParams({
            mode: 'story',
            campaign: campaignId,
            character: tappa.characterId,
            // Con i livelli la difficoltà del duello è quella del LIVELLO,
            // uguale per tutta la partita: Facile vuol dire tutti gli
            // avversari col loro mazzo Facile. La difficoltà scritta sulla
            // tappa resta per le campagne senza livelli (la Grande Guerra).
            difficulty: (datiLivello(campaignId) || {}).duello || tappa.difficulty || 'Medio'
        });
        // L'arena: quella della tappa se la dichiara, altrimenti il
        // `campoDuello` della campagna (stesso schema di `musicaDuello` qui
        // sotto). Può essere un ELENCO: si sceglie per id della tappa, mai
        // a caso, così una stessa tappa si gioca sempre nella stessa arena
        // — anche quando la si rigioca.
        const campoTappa = tappa.field || campoDellaCampagna(getCampaign(campaignId), tappa.id);
        if (campoTappa) params.set('field', campoTappa);
        // QUALE tappa: serve al duello per sapere chi sei, perché il
        // protagonista può cambiare da un capitolo all'altro della stessa
        // campagna (in Memorie Proibite sei Atem, ma nel presente sei Yugi
        // Muto). Viaggia l'id e non nome+ritratto: quelli restano scritti
        // in un posto solo, il catalogo.
        if (tappa.id) params.set('tappa', tappa.id);
        // La colonna sonora del duello: quella della singola tappa se c'è
        // (il duello che merita un tema suo), altrimenti quella della
        // campagna. Una campagna che non ne dichiara nessuna non passa il
        // parametro affatto, e il duello suona come ha sempre suonato.
        const campagna = getCampaign(campaignId);
        const musica = tappa.music || (campagna && campagna.musicaDuello);
        if (musica) params.set('music', musica);
        if (opzioni && opzioni.rigiocata) params.set('replay', '1');
        // Duello che fa parte di un TORNEO dentro la campagna: al ritorno
        // l'esito va applicato alla scalata del torneo, non alla tappa
        // corrente della campagna. Viaggia nell'URL come tutto il resto.
        if (opzioni && opzioni.torneoId) params.set('torneo', opzioni.torneoId);
        if (opzioni && opzioni.laterale) params.set('laterale', opzioni.laterale);
        return 'duelMonstersCore.html?' + params.toString();
    }

    /**
     * I capitoli con quante tappe ne hai superate: serve alla pagina per
     * dire "sei nel capitolo 2 di 5" invece di lasciarti contare i
     * pallini su una mappa lunga duemila pixel.
     */
    function getCapitoliConStato(campaignId) {
        const campagna = getCampaign(campaignId);
        if (!campagna) return [];
        const tappe = getTappeConStato(campaignId);
        return (campagna.capitoli || []).map((cap, i) => {
            const sue = tappe.filter((t) => t.capitoloIndice === i);
            const fatte = sue.filter((t) => t.stato === 'fatta').length;
            return {
                id: cap.id, nome: cap.nome, testo: cap.testo || '', indice: i,
                totali: sue.length, fatte: fatte,
                corrente: sue.some((t) => t.stato === 'corrente'),
                completo: sue.length > 0 && fatte === sue.length
            };
        });
    }

    window.StoryProgress = {
        getCampaigns: getCampaigns,
        getCampaign: getCampaign,
        getPersonaggio: getPersonaggio,
        getCapitoliConStato: getCapitoliConStato,
        carteNonAmmesse: carteNonAmmesse,
        descriviCarteAmmesse: descriviCarteAmmesse,
        getTappe: getTappe,
        getTappeConStato: getTappeConStato,
        getTappaCorrente: getTappaCorrente,
        getProgress: getProgress,
        avanza: avanza,
        consumaEsitoDuello: consumaEsitoDuello,
        riscuotiPremioFinale: riscuotiPremioFinale,
        ricomincia: ricomincia,
        urlDuello: urlDuello,
        // Tappe che sono a loro volta un percorso (kind: 'torneo').
        getTorneo: getTorneo,
        getProveConStato: getProveConStato,
        LIVELLI: LIVELLI,
        haLivelli: haLivelli,
        getLivelloAttivo: getLivelloAttivo,
        setLivelloAttivo: setLivelloAttivo,
        getLivelliConStato: getLivelliConStato,
        livelloSbloccato: livelloSbloccato,
        forzaAvanzamento: forzaAvanzamento,
        pagineDelPercorso: pagineDelPercorso,
        getPagineConStato: getPagineConStato,
        getProgressoTorneo: getProgressoTorneo,
        avanzaTorneo: avanzaTorneo,
        azzeraTorneo: azzeraTorneo
    };

    // Migrazione non distruttiva dei salvataggi precedenti al sistema di
    // acquisizione: entrando nella Storia ricostruiamo i capitoli già
    // conclusi a ogni difficoltà. Non avanza nulla e i premi hanno chiavi
    // una-tantum, quindi ricaricare la pagina è sicuro.
    if (window.CardAcquisition) {
        ['facile', 'normale', 'difficile'].forEach((livello) => {
            const p = leggiProgresso('anime', livello);
            if (!p.completate && !p.finita) return;
            const tappeAnime = getTappe('anime');
            const completati = capitoliCompletati(tappeAnime, p.completate);
            CardAcquisition.onStoryProgress('anime', livello, completati, p.finita);
        });
    }
})();
