/**
 * js/economy/shop-catalog.js — IL CATALOGO DEL NEGOZIO
 * =====================================================================
 * Decide COSA è in vendita oggi e questa settimana, e a che prezzo.
 * Separato da negozio.html apposta: la pagina disegna, questo file
 * decide. Così l'offerta si può verificare (e prevedere) senza aprire
 * nessuna interfaccia.
 *
 * LA ROTAZIONE È DETERMINISTICA, NON CASUALE
 * L'offerta non viene sorteggiata alla visita — sarebbe un invito a
 * ricaricare la pagina finché non esce la carta giusta. È invece
 * calcolata da un SEME derivato dalla data del SERVER
 * (js/cloud/server-date.js): stesso giorno = stessa offerta, per
 * chiunque, da qualunque dispositivo, per quante volte si riapra la
 * pagina. Cambia da sola a mezzanotte UTC.
 *
 * PERCHÉ LA ROTAZIONE È IL FRENO PRINCIPALE DELL'ECONOMIA
 * Quattro carte al giorno e tre buste a settimana mettono un tetto a
 * quanto si può comprare, per quanti crediti si abbiano: senza, un
 * giocatore con molti crediti svuoterebbe il catalogo in un pomeriggio e
 * la collezione perderebbe senso. I mazzi sono l'eccezione — si comprano
 * una volta sola, quindi non hanno bisogno di essere razionati.
 */
(function () {
    'use strict';

    // ================================================================
    // Prezzi. Tutti qui, in un colpo d'occhio.
    // ================================================================
    const PREZZI = {
        cartaComune: 150, cartaRara: 450, cartaSuper: 900,
        cartaUltra: 1800, cartaLeggendaria: 3500,
        bustaBase: 500,   // solo Crediti (niente Stella): richiesta dell'utente, il prezzo sale per compensare
        bustaAvanzata: 450,
        bustaLeggendaria: 900,
        /** La Leggendaria si può pagare anche con la valuta di Battle City. */
        bustaLeggendariaInLocazione: 2
    };

    /**
     * PREZZO DEI MAZZI — composto e CRESCENTE.
     *
     * Un mazzo non costa più solo Stelle: costa Stelle *e* Crediti
     * insieme, e (dal secondo Starter, già dal primo Structure) anche carte fra
     * Carta Locazione e Carta del Millennio. Così tutte e quattro le
     * valute finiscono per servire, e nessun torneo diventa saltabile.
     *
     * E soprattutto: ogni mazzo comprato fa salire il prezzo del
     * SUCCESSIVO dello stesso tipo. Il primo Starter è un traguardo
     * raggiungibile presto; il settimo è un impegno serio. Senza questo,
     * superata una certa soglia di Stelle si svuoterebbe lo scaffale in
     * un colpo solo e i mazzi smetterebbero di essere un obiettivo.
     * I due contatori sono SEPARATI: comprare Structure non rende più
     * cari gli Starter, e viceversa — sono due collezioni distinte.
     */
    //
    // Secondo rincaro (richiesta dell'utente: "aumenta di più la richiesta
    // di Carte Locazione, Carte Millennio e Stelle"). Cosa si è mosso e
    // cosa NO, apposta:
    //  - `starter.stelleBase` resta 18 perché è legato al premio del Regno
    //    dei Duellanti (TOURNAMENT_COMPLETION in js/economy/rewards.js): una
    //    vittoria deve bastare al PRIMO Starter. Rincara invece, e molto,
    //    ogni Starter successivo. La crescita ora ha un tetto: senza, il
    //    totale dello scaffale superava 1.600 Stelle e richiedeva anni.
    //  - gli Structure partono più in alto, e
    //    chiedono le carte speciali GIÀ DAL PRIMO (extraDalNumero 0): sono
    //    i mazzi più utili, devono richiedere i tornei impegnativi.
    //  - i Crediti non sono stati toccati: la richiesta riguardava le tre
    //    valute dei tornei, non quella che si guadagna a ogni duello.
    const PREZZI_MAZZI = {
        starter: {
            stelleBase: 18, stellePerAcquisto: 6, stelleMassime: 54,
            creditiBase: 1400, creditiPerAcquisto: 550,
            /** Dal N-esimo acquisto in poi serve anche una carta speciale (0 = il primo, 1 = dal secondo). */
            extraDalNumero: 1
        },
        structure: {
            stelleBase: 35, stellePerAcquisto: 8, stelleMassime: 75,
            creditiBase: 2200, creditiPerAcquisto: 800,
            extraDalNumero: 0
        }
    };
    /**
     * Quante carte speciali servono, e quali sono accettate (una qualunque
     * delle due, a scelta di chi compra).
     *
     * La quantità CRESCE, come il prezzo: 3 al primo mazzo che le chiede,
     * poi una in più ogni due acquisti (3, 3, 4, 4, 5...). Era partita da
     * 1, poi 2; alzata a 3 insieme al rincaro delle Stelle. Prima restava fissa a uno per
     * sempre, e quella era la falla del bilancio — Stelle e Crediti
     * salivano, ma i "materiali" no, e dopo qualche torneo se ne avevano
     * abbastanza da svuotare lo scaffale senza più pensarci.
     *
     * È la barriera giusta da far salire perché Carte Locazione e Carte
     * del Millennio arrivano quasi solo dai tornei e dalle Sfide lunghe:
     * legare a loro i mazzi avanzati vuol dire che quei mazzi si guadagnano
     * giocando le cose impegnative, non accumulando crediti.
     */
    const EXTRA_MAZZO = { valuteAccettate: ['locatorCards', 'millenniumCards'] };
    /** Ogni quanti acquisti serve una carta speciale in più. */
    const EXTRA_OGNI = 2;
    /** Quante carte speciali chiede il primo mazzo per cui servono. */
    const EXTRA_INIZIALI = 3;

    function extraRichieste(gia, dalNumero) {
        if (gia < dalNumero) return 0;
        return EXTRA_INIZIALI + Math.floor((gia - dalNumero) / EXTRA_OGNI);
    }

    // ================================================================
    // REQUISITI DI SBLOCCO — "questo si compra solo dopo aver fatto X"
    // ================================================================
    // Il prezzo dice QUANTO costa; questo dice SE è in vendita. Sono due
    // cose diverse, e tenerle separate serve: un mazzo può essere
    // economico e comunque arrivare tardi, o caro e disponibile subito.
    //
    // Oggi nessun mazzo ne dichiara uno, quindi tutto si comporta come
    // prima. È in piedi perché la richiesta è già stata fatta: sbloccare
    // certe carte o certi mazzi al raggiungimento di un punto delle
    // Storie. Quando servirà, basterà aggiungere al pacchetto in
    // js/data/starter-structure-decks.js una riga come:
    //
    //     richiede: { storia: 'forbiddenMemories', tappe: 12 }
    //     richiede: { storia: 'ww1', finita: true }
    //     richiede: { storie: [{ id: 'anime', finita: true },
    //                          { id: 'freedom', tappe: 8 }] }
    //
    // ...e nient'altro: il Negozio legge già da qui. La stessa forma vale
    // per una CARTA singola (le voci di carteDelGiorno accettano lo stesso
    // campo), perché la domanda è la stessa e due grammatiche diverse per
    // la stessa domanda divergono al primo ripensamento.
    //
    // Il progresso si legge da SaveManager.getStoryState, la stessa fonte
    // di js/story/story-progress.js — non se ne inventa una seconda.

    /** Quante tappe di quella campagna sono state superate, e se è finita. */
    function progressoStoria(campaignId) {
        const s = (window.SaveManager && SaveManager.getStoryState)
            ? SaveManager.getStoryState(campaignId) : null;
        return { completate: (s && s.completate) || 0, finita: !!(s && s.finita) };
    }

    /** Un singolo requisito è soddisfatto? `{ id, tappe?, finita? }` */
    function requisitoStoriaOk(req) {
        if (!req || !req.id) return true;
        const p = progressoStoria(req.id);
        if (req.finita && !p.finita) return false;
        if (typeof req.tappe === 'number' && p.completate < req.tappe) return false;
        return true;
    }

    /**
     * L'oggetto è sbloccato? Torna { sbloccato, motivo } — il MOTIVO
     * serve quanto la risposta: un pezzo di vetrina disattivato senza
     * spiegazione è la cosa che fa chiudere il Negozio, e in questo
     * progetto vale la regola che ogni premio e ogni blocco dicano la
     * regola che li ha prodotti.
     */
    function statoSblocco(voce) {
        const packId = voce && voce.packId;
        if (packId && window.CardAcquisition) {
            const evolution = packId === 'starter_sye_yugi_evolution' || packId === 'starter_ske_kaiba_evolution';
            const structureYgo = /^structure_/.test(packId);
            if (evolution && !CardAcquisition.isChapterComplete('regno')) {
                return { sbloccato: false, motivo: 'Si sblocca completando il Regno dei Duellanti a qualsiasi difficoltà.' };
            }
            if (structureYgo && !CardAcquisition.isChapterComplete('battlecity1')) {
                return { sbloccato: false, motivo: 'Si sblocca completando Battle City - Parte I a qualsiasi difficoltà.' };
            }
        }
        const r = voce && voce.richiede;
        if (!r) return { sbloccato: true, motivo: '' };

        const elenco = r.storie
            ? r.storie.slice()
            : (r.storia ? [{ id: r.storia, tappe: r.tappe, finita: r.finita }] : []);
        const mancanti = elenco.filter((req) => !requisitoStoriaOk(req));
        if (mancanti.length === 0) return { sbloccato: true, motivo: '' };

        // Il nome leggibile della campagna arriva dal catalogo delle
        // Storie, se la pagina lo ha caricato; altrimenti si ripiega
        // sull'id, che è brutto ma vero.
        // NOTA PER QUANDO ARRIVERÀ IL PRIMO REQUISITO VERO: oggi le due
        // pagine del Negozio (negozio.html e la vista in index.html) non
        // caricano js/data/story-campaigns.js, perché finora non serviva a
        // nulla lì. Il giorno in cui un mazzo dichiarerà un `richiede`, va
        // aggiunto quel file a entrambe — altrimenti al giocatore
        // comparirà "arriva alla tappa 12 di forbiddenMemories" invece di
        // "di Memorie Proibite". Una riga per pagina, niente di più.
        const nomeStoria = (id) => {
            const campagne = (typeof storyCampaignsDatabase !== 'undefined') ? storyCampaignsDatabase : [];
            const c = campagne.find((x) => x.id === id);
            return c ? c.nome : id;
        };
        const parti = mancanti.map((req) => (req.finita
            ? `finisci ${nomeStoria(req.id)}`
            : `arriva alla tappa ${req.tappe} di ${nomeStoria(req.id)}`));
        return { sbloccato: false, motivo: 'Si sblocca quando: ' + parti.join(', ') + '.' };
    }

    /** Quanti pacchetti di un certo tipo il giocatore possiede già. */
    function possedutiDelTipo(kind) {
        let elenco = [];
        if (typeof starterStructureDeckDatabase !== 'undefined') elenco = starterStructureDeckDatabase;
        else if (Array.isArray(window.starterStructureDeckDatabase)) elenco = window.starterStructureDeckDatabase;
        const posseduti = window.SaveManager ? SaveManager.getOwnedPacks() : [];
        return elenco.filter((d) => d.kind === kind
            && posseduti.indexOf(d.packId) !== -1
            // I mazzi GRATUITI (Grande Guerra) non sono acquisti: non devono rincarare lo scaffale.
            && !d.gratis
            // Lo Starter Yugi viene assegnato alla creazione del profilo:
            // non e' un acquisto e non deve rincarare il primo prodotto
            // scelto davvero dal giocatore. Contarlo faceva partire lo
            // scaffale Starter da 30 Stelle invece delle 18 dichiarate.
            && d.packId !== 'starter_sdy_yugi').length;
    }

    /**
     * Il costo del PROSSIMO mazzo di quel tipo. Uguale per tutti i mazzi
     * dello stesso tipo ancora da comprare: non è il singolo mazzo a
     * rincarare, è lo scaffale che si fa più caro man mano che lo si
     * svuota — così resta libera la scelta di QUALE prendere.
     */
    function costoMazzo(kind) {
        const t = PREZZI_MAZZI[kind === 'structure' ? 'structure' : 'starter'];
        const gia = possedutiDelTipo(kind === 'structure' ? 'structure' : 'starter');
        return {
            starChips: Math.min(t.stelleMassime, t.stelleBase + t.stellePerAcquisto * gia),
            credits: t.creditiBase + t.creditiPerAcquisto * gia,
            /** Vero da quando il tipo chiede carte speciali (extraDalNumero). */
            richiedeExtra: gia >= t.extraDalNumero,
            extraQuantita: extraRichieste(gia, t.extraDalNumero),
            extraValute: EXTRA_MAZZO.valuteAccettate.slice(),
            giaPosseduti: gia
        };
    }

    /**
     * Le tre buste della settimana. `composizione` è quante carte di
     * ciascuna rarità escono, `ultraChance` la probabilità che UNA delle
     * carte rare venga promossa a ultra rara.
     * Ogni busta contiene sempre 10 carte: cambia la qualità, mai la
     * quantità, così il confronto fra le tre è immediato.
     */
    const BUSTE = [
        {
            id: 'base',
            nome: 'Busta Base',
            // `nomeBreve` è quello stampato sulla fascia dorata della
            // bustina disegnata in shop.css: "Busta Base" per intero non
            // ci starebbe leggibile, e su una bustina vera c'è comunque
            // solo il nome dell'espansione.
            nomeBreve: 'BASE',
            emblema: [3, 0],
            // `colore` è l'unico valore da dare alla bustina: tutte le sue
            // sfumature sono derivate da lì con color-mix (--pack-base).
            colore: '#1d4f9e',
            costo: { credits: PREZZI.bustaBase },
            carte: 10,
            composizione: { common: 9, rare: 1 },
            descrizione: '9 carte comuni e 1 rara garantita. I mostri hanno massimo 1200 ATK.'
        },
        {
            id: 'avanzata',
            nome: 'Busta Avanzata',
            nomeBreve: 'AVANZATA',
            emblema: [1, 0],
            colore: '#6a2da8',
            costo: { credits: PREZZI.bustaAvanzata, starChips: 2 },
            carte: 10,
            composizione: { common: 7, rare: 2, super: 1 },
            descrizione: '7 comuni, 2 rare e 1 super rara garantita.'
        },
        {
            id: 'leggendaria',
            nome: 'Busta Leggendaria',
            nomeBreve: 'LEGGENDARIA',
            emblema: [0, 0],
            colore: '#b8860b',
            costo: { credits: PREZZI.bustaLeggendaria, starChips: 5, locatorCards: PREZZI.bustaLeggendariaInLocazione },
            carte: 10,
            composizione: { common: 5, rare: 2, super: 2, ultra: 1 }, legendaryChance: 0.05,
            descrizione: '5 comuni, 2 rare, 2 super rare e 1 ultra rara garantita.'
        }
    ];

    // Allineando i nomi a quelli ufficiali Konami alcune carte avrebbero cambiato pacchetto ("Cattura-Draghi" non contiene piu' "drago",
    // "Magia Ombra" contiene "magia"...). Il Negozio sorteggia da questi pacchetti: la loro composizione non deve cambiare, quindi le
    // differenze sono elencate qui per id. `dentro`: c'erano prima e restano; `fuori`: ora le troverebbe la regola, prima no.
    // Sorvegliato da tests/specs/guardrail-nomi-carte.spec.js.
    const ECCEZIONI_NOME = {
        draghi: { dentro: [206], fuori: [491] },
        maghi: { dentro: [150], fuori: [352, 370, 439, 455, 748] },
        nonmorti: { dentro: [367], fuori: [] },
        mare: { dentro: [], fuori: [871] },
        arpie: { dentro: [], fuori: [88] }
    };
    const conEccezioni = (tema, test) => (c) => (ECCEZIONI_NOME[tema].dentro.includes(c.id) || (test(c) && !ECCEZIONI_NOME[tema].fuori.includes(c.id)));

    const TEMI = [
        // Le tematiche mostrano il mostro che le rappresenta davvero; gli
        // emblemi originali restano invece una peculiarità delle generiche.
        { id: 'draghi', nome: 'Dominio dei Draghi', colore: '#3467a8', mostroSimboloId: 1, test: conEccezioni('draghi', (c) => c.race === 'Drago' || /drago/i.test(c.name)) },
        { id: 'maghi', nome: 'Segreti degli Incantatori', colore: '#7046a8', mostroSimboloId: 2, test: conEccezioni('maghi', (c) => c.race === 'Incantatore' || /mago|magia/i.test(c.name)) },
        { id: 'macchine', nome: 'KaibaCorp: Acciaio', colore: '#607782', mostroSimboloId: 512, test: (c) => c.race === 'Macchina' },
        { id: 'nonmorti', nome: 'Ombre dal Cimitero', colore: '#57406f', mostroSimboloId: 656, test: conEccezioni('nonmorti', (c) => c.race === 'Zombie' || /vampir|cimitero/i.test((c.name || '') + ' ' + (c.effect || ''))) },
        { id: 'guerrieri', nome: 'Leggende dei Guerrieri', colore: '#9a542d', mostroSimboloId: 14, test: (c) => c.race === 'Guerriero' },
        { id: 'mare', nome: 'Furia dagli Abissi', colore: '#176d88', mostroSimboloId: 879, test: conEccezioni('mare', (c) => c.attribute === 'ACQUA' || /mare|oceano|acqua/i.test(c.name)) },
        { id: 'arpie', nome: 'Vento delle Arpie', colore: '#9b477b', mostroSimboloId: 288, test: conEccezioni('arpie', (c) => /(?<!dell')arpia|amazzone|amazoness|sorelle arpie|cucciolo di drago delle arpie/i.test(c.name)) },
        { id: 'toon', nome: 'Mondo Toon', colore: '#b24b80', mostroSimboloId: 123, test: (c) => /toon/i.test((c.name || '') + ' ' + (c.effect || '')) },
        // Le Fusioni storiche appena completate non devono perdersi in un
        // pool generico di oltre mille carte. Il range 1141-1160 include
        // anche i quattro Materiali Normali aggiunti apposta per esse;
        // extraDeck/testo estendono il tema alle Fusioni già esistenti.
        { id: 'fusioni', nome: 'Forgia delle Fusioni', colore: '#8050a8', mostroSimboloId: 1155,
            test: (c) => (c.id >= 1141 && c.id <= 1160) || !!c.extraDeck || /fusione|polimerizzazione|materiale da fusione/i.test((c.name || '') + ' ' + (c.effect || '')) }
    ];

    // ================================================================
    // Sorteggio deterministico
    // ================================================================

    /** Hash stabile di una stringa: stesso testo, stesso numero, sempre e ovunque. */
    function hash(testo) {
        let h = 2166136261;
        for (let i = 0; i < testo.length; i++) {
            h ^= testo.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    /** Generatore pseudo-casuale seminato (mulberry32): stesso seme, stessa sequenza. */
    function rng(seme) {
        let a = seme >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Estrae `quanti` elementi distinti da `pool` usando il generatore dato. */
    function pesca(pool, quanti, random) {
        const copia = pool.slice();
        const out = [];
        for (let i = 0; i < quanti && copia.length > 0; i++) {
            const idx = Math.floor(random() * copia.length);
            out.push(copia.splice(idx, 1)[0]);
        }
        return out;
    }

    /** Estrae anche con ripetizione: serve ai temi molto stretti (es. Toon). */
    function pescaConRipetizione(pool, quanti, random) {
        if (!pool.length) return [];
        const out = pesca(pool, quanti, random);
        while (out.length < quanti) {
            const disponibili = pool.filter((id) => {
                if (!window.CardAcquisition || !CardAcquisition.isModernSupport(id)) return true;
                const cap = window.CardAcquisition && CardAcquisition.copyCapFor
                    ? CardAcquisition.copyCapFor(id) : 3;
                const owned = window.SaveManager ? SaveManager.getOwnedCount(id) : 0;
                return owned + out.filter((drawn) => drawn === id).length < cap;
            });
            if (!disponibili.length) break;
            out.push(disponibili[Math.floor(random() * disponibili.length)]);
        }
        return out;
    }

    /** Pesca senza doppioni e dà ai mostri vanilla quattro volte il peso. */
    function pescaPrivilegiandoVanilla(pool, quanti, random, db) {
        if (!pool.length) return [];
        const originali = pool.slice();
        const rimanenti = pool.slice();
        const uscita = [];
        // Il flag `vanilla` è esplicito: alcuni mostri normali hanno una
        // descrizione informativa nel campo effect, che non è un effetto.
        const vanillaIds = new Set(db.filter((c) => c.type === 'monster' && c.vanilla === true)
            .map((c) => c.id));
        const peso = (id) => vanillaIds.has(id) ? 4 : 1;
        while (uscita.length < quanti) {
            if (!rimanenti.length) rimanenti.push(...originali);
            const pesoTotale = rimanenti.reduce((totale, id) => totale + peso(id), 0);
            let estrazione = random() * pesoTotale;
            let indice = rimanenti.findIndex((id) => (estrazione -= peso(id)) < 0);
            if (indice < 0) indice = rimanenti.length - 1;
            uscita.push(rimanenti.splice(indice, 1)[0]);
        }
        return uscita;
    }

    /**
     * Un'unica porta d'ingresso per i pool ordinari delle buste.
     *
     * Non basta affidarsi a `idsByRarity`: quando una rarità non ha carte
     * coerenti col tema, `apriBusta` ripiega intenzionalmente sull'intero
     * tema. Quel percorso in passato saltava la classificazione e poteva
     * quindi includere Testa Proibita nella busta degli Incantatori. Lo
     * stesso rischio esisteva nella scelta delle creature base.
     *
     * Le eccezioni narrative (oggi soltanto Elefante Volante nelle Premium,
     * dopo averne meritato la prima copia) restano esplicite più sotto: non
     * devono mai entrare accidentalmente in un pool generico o tematico.
     */
    function acquistabileInBusta(cardId, busta) {
        if (window.Contenuti && !Contenuti.carta(cardId)) return false;
        // I mostri copertina degli Structure Deck sono ricompense esclusive
        // del relativo deck: non devono rientrare da buste generiche o a tema.
        // Questo controllo unico copre anche i fallback e le carte base garantite.
        if (typeof starterStructureDeckDatabase !== 'undefined'
            && starterStructureDeckDatabase.some((deck) => deck.kind === 'structure'
                && deck.bossCardId === cardId)) return false;
        // La Busta Base è la porta d'ingresso all'economia: può contenere
        // Magie e Trappole comuni/rare, ma i suoi mostri restano tutti entro
        // 1200 ATK. La regola vale anche per lo slot raro garantito.
        if (busta && busta.id === 'base') {
            const db = typeof cardDatabase !== 'undefined' ? cardDatabase : (window.cardDatabase || []);
            const carta = db.find((c) => c.id === cardId);
            if (carta && carta.type === 'monster'
                && (!Number.isFinite(Number(carta.attack)) || Number(carta.attack) > 1200)) return false;
        }
        return !!window.CardRarity && CardRarity.isPurchasable(cardId)
            && (!window.CardAcquisition || CardAcquisition.isSignatureUnlocked(cardId))
            && (!window.SaveManager || !window.CardAcquisition || !CardAcquisition.isModernSupport(cardId)
                || SaveManager.getOwnedCount(cardId) < CardAcquisition.copyCapFor(cardId));
    }

    function dayKey() {
        return (window.ServerDate && ServerDate.dayKey()) || new Date().toISOString().slice(0, 10);
    }
    function weekKey() {
        return (window.ServerDate && ServerDate.weekKey()) || 'W';
    }

    /**
     * Le 4 carte singole in vendita OGGI: 3 comuni e 1 rara.
     * La rara è volutamente presa dal gruppo 'rare' e non dalle ultra: le
     * ultra restano un colpo di fortuna delle buste o un acquisto mirato
     * con le Carte del Millennio, non merce da banco quotidiana.
     *
     * Ogni voce porta anche `acquistataOggi`: UNA sola copia al giorno
     * per carta, richiesto esplicitamente dall'utente ("ne posso
     * comprare solo 1 in quella rotazione giornaliera") — senza questo
     * flag nulla impediva di ricomprare la stessa carta più volte finché
     * bastavano i crediti. Chi disegna la vetrina (js/economy/shop-ui.js)
     * decide cosa farne (qui: la toglie dalla griglia); il catalogo si
     * limita a dire il fatto, stesso principio già in uso per `posseduto`
     * su mazziInVendita qui sotto.
     */
    function carteDelGiorno() {
        const giorno = dayKey();
        const pool = (rarity) => window.CardRarity ? CardRarity.idsByRarity(rarity)
            .filter((id) => !window.Contenuti || Contenuti.carta(id))
            .filter((id) => !window.CardAcquisition || CardAcquisition.isSignatureUnlocked(id)) : [];
        const giaComprata = (id) => !!(window.SaveManager && SaveManager.hasBoughtDailyShopCard(giorno, id));
        const giorni = Math.floor(Date.parse(giorno + 'T00:00:00Z') / 86400000);
        const specs = [
            // Le comuni costano SOLO Crediti (richiesta dell'utente): le Stelle arrivano quasi solo dai tornei e
            // sono per le carte di fascia alta, mazzi e buste. Una carta da 150 Crediti non deve dipendere da loro.
            ['common', 3, giorno, { credits: PREZZI.cartaComune }],
            // Anche le rare solo Crediti (richiesta dell'utente): le Stelle restano per Super e oltre, buste e mazzi.
            ['rare', 2, giorno, { credits: PREZZI.cartaRara }],
            // Super 1 Stella, Ultra 3 (richiesta dell'utente; prima 4 e 8): la Leggendaria resta a 15 + 2 Carte del Millennio.
            ['super', 1, String(Math.floor(giorni / 2)), { credits: PREZZI.cartaSuper, starChips: 1 }],
            ['ultra', 1, String(Math.floor(giorni / 7)), { credits: PREZZI.cartaUltra, starChips: 3 }],
            ['legendary', 1, String(Math.floor(giorni / 14)), { credits: PREZZI.cartaLeggendaria, starChips: 15, millenniumCards: 2 }]
        ];
        return specs.flatMap(([rarity, count, periodo, costo]) =>
            pesca(pool(rarity), count, rng(hash(`rotazione-${rarity}-${periodo}`))).map((id) => ({
                cardId: id, rarity: rarity, costo: costo, acquistataOggi: giaComprata(id)
            })));
    }

    /** Registra che la carta della rotazione giornaliera è stata comprata OGGI — vedi il commento su carteDelGiorno. */
    function segnaCartaDelGiornoComprata(cardId) {
        if (window.SaveManager) SaveManager.recordDailyShopCardPurchase(dayKey(), cardId);
    }

    /**
     * Le 3 buste di QUESTA settimana. La composizione è fissa (vedi
     * BUSTE), ma il CONTENUTO estratto all'apertura no: quello è
     * genuinamente casuale, altrimenti due giocatori che aprono la stessa
     * busta troverebbero le stesse carte e non ci sarebbe alcuna emozione
     * nell'aprirla. A ruotare ogni settimana è il "tema" della busta,
     * cioè il sottoinsieme di carte da cui pesca.
     */
    function busteDellaSettimana() {
        const settimana = weekKey();
        const scelte = pesca(TEMI, 3, rng(hash('temi-' + settimana)));
        const tematizzate = scelte.slice(0, 2).map((tema) => ({
            id: 'tema-' + tema.id, nome: tema.nome, nomeBreve: tema.id.toUpperCase(), mostroSimboloId: tema.mostroSimboloId, colore: tema.colore,
            costo: { credits: 1050, starChips: 4 }, carte: 10,
            composizione: { common: 5, rare: 3, super: 1, ultra: 1 }, temaId: tema.id, deboliGarantiti: 4,
            descrizione: 'Busta tematica: tutte carte coerenti col tema, incluse 4 creature base volutamente meno forti.'
        }));
        const premium = scelte[2] ? [{
            id: 'premium-' + scelte[2].id, nome: scelte[2].nome + ' Premium', nomeBreve: 'PREMIUM', mostroSimboloId: scelte[2].mostroSimboloId, colore: scelte[2].colore,
            costo: { credits: 1800, starChips: 8, locatorCards: 1 }, carte: 10,
            composizione: { common: 3, rare: 3, super: 2, ultra: 1, legendary: 1 }, temaId: scelte[2].id, deboliGarantiti: 2,
            descrizione: 'Busta tematica premium: punta alla fascia più alta disponibile nel tema e include 2 creature base.'
        }] : [];
        return BUSTE.concat(tematizzate, premium).map((b) => Object.assign({}, b, { temaSeed: hash(b.id + '-' + settimana) }));
    }

    /**
     * Apre una busta: torna l'elenco degli id estratti. Il caso QUI è
     * vero (Math.random), non seminato — vedi il commento su
     * busteDellaSettimana.
     */
    function apriBusta(busta) {
        if (!window.CardRarity) return [];
        const db = typeof cardDatabase !== 'undefined' ? cardDatabase : (window.cardDatabase || []);
        const tema = TEMI.find((t) => t.id === busta.temaId);
        const casuale = () => Math.random();
        const estratte = [];
        // Dopo aver meritato la prima copia, i supporti moderni entrano nel
        // tema ma non con lo stesso peso delle carte ordinarie: il pool
        // stretto di una busta Toon/Drago/Mago li renderebbe altrimenti
        // comuni. Ogni supporto ha una piccola probabilità di essere ammesso
        // al singolo gruppo di rarità (più alta soltanto nelle Premium).
        const filtraSupportiRarissimi = (pool) => pool.filter((id) => {
            if (!window.CardAcquisition || !CardAcquisition.isModernSupport(id)) return true;
            return casuale() < (/^premium-/.test(busta.id) ? 0.08 : 0.035);
        });
        Object.keys(busta.composizione || {}).forEach((rarity) => {
            let pool = filtraSupportiRarissimi(CardRarity.idsByRarity(rarity)
                .filter((id) => acquistabileInBusta(id, busta)));
            if (tema) {
                const themed = pool.filter((id) => { const c = db.find((x) => x.id === id); return c && tema.test(c); });
                // Mai carte fuori tema. Se una fascia è troppo stretta si
                // pesca dal tema intero: la rarità promessa resta garantita
                // dagli altri slot e la bustina non tradisce il soggetto.
                const tuttoIlTema = filtraSupportiRarissimi(db.filter((c) => (c.origin || 'yu-gi-oh') === 'yu-gi-oh'
                    && tema.test(c)
                    && acquistabileInBusta(c.id, busta))
                    .map((c) => c.id));
                pool = themed.length ? themed : tuttoIlTema;
            }
            const slot = busta.composizione[rarity];
            const carteEstratte = busta.id === 'base' && rarity === 'common'
                ? pescaPrivilegiandoVanilla(pool, slot, casuale, db)
                : pescaConRipetizione(pool, slot, casuale);
            estratte.push(...carteEstratte);
        });
        if (tema && busta.deboliGarantiti) {
            const mostriTema = db.filter((c) => c.type === 'monster'
                && (c.origin || 'yu-gi-oh') === 'yu-gi-oh' && tema.test(c)
                && acquistabileInBusta(c.id, busta))
                .sort((a, b) => ((a.attack || 0) + (a.defense || 0)) - ((b.attack || 0) + (b.defense || 0)));
            const davveroDeboli = mostriTema.filter((c) => (c.level || 0) <= 4
                && (c.attack || 0) <= 1400 && (c.defense || 0) <= 1600);
            const deboli = davveroDeboli.length ? davveroDeboli : mostriTema.slice(0, Math.max(1, busta.deboliGarantiti));
            const scelteDeboli = pescaConRipetizione(deboli.map((c) => c.id), busta.deboliGarantiti, casuale);
            // Sostituiamo gli slot comuni iniziali: il numero di carte e
            // le garanzie alte restano invariati, ma l'apertura non parte
            // subito con dieci carte tutte da deck competitivo.
            scelteDeboli.forEach((id, i) => { if (i < estratte.length) estratte[i] = id; });
        }
        if (busta.legendaryChance && Math.random() < busta.legendaryChance) {
            const leggendarie = filtraSupportiRarissimi(CardRarity.idsByRarity('legendary')
                .filter((id) => acquistabileInBusta(id, busta)));
            if (leggendarie.length && estratte.length) estratte[estratte.length - 1] = pesca(leggendarie, 1, casuale)[0];
        }
        // L'Elefante Volante entra nelle sole buste Premium soltanto dopo
        // che la prima copia è stata meritata contro Pegasus. La chance è
        // volutamente minuscola: resta una carta da impresa, non da spesa.
        if (/^premium-/.test(busta.id) && window.SaveManager
            && SaveManager.getOwnedCount(246) > 0 && SaveManager.getOwnedCount(246) < 3
            && Math.random() < ((CardAcquisition.RULES && CardAcquisition.RULES.elephantPremiumChance) || 0.002)
            && estratte.length) {
            estratte[estratte.length - 1] = 246;
        }
        return estratte;
    }

    /**
     * I mazzi in vendita: TUTTI gli Starter e Structure Deck, sempre
     * disponibili (non ruotano) ma acquistabili UNA VOLTA SOLA — chi lo
     * possiede già lo vede come tale. Si pagano solo in Stelle
     * dell'Esagono, che arrivano quasi esclusivamente dai tornei: è
     * questo a impedire di comprare tutti i mazzi grindando duelli
     * liberi.
     */
    /**
     * Il mostro con l'attacco più alto del mazzo: la sua "carta simbolo"
     * quando il pacchetto non ne dichiara una a mano (coverCardId).
     * Stessa regola di resolveCoverCard in creazione-deck.html — senza,
     * quattro scatole su diciannove restavano senza illustrazione.
     */
    function cartaSimbolo(deck) {
        const db = (typeof cardDatabase !== 'undefined' && Array.isArray(cardDatabase))
            ? cardDatabase : (window.cardDatabase || []);
        let migliore = null;
        (deck.main || []).forEach((entry) => {
            const carta = db.find((c) => c.id === entry.id);
            if (!carta || carta.type !== 'monster') return;
            if (!migliore || (carta.attack || 0) > (migliore.attack || 0)) migliore = carta;
        });
        return migliore ? migliore.id : null;
    }

    function mazziInVendita() {
        // `starterStructureDeckDatabase` è un const al primo livello di
        // uno script classico: NON è una proprietà di window (stessa
        // insidia di cardDatabase, vedi il commento in card-rarity.js), va
        // letto per identificatore.
        let elenco = [];
        if (typeof starterStructureDeckDatabase !== 'undefined') elenco = starterStructureDeckDatabase;
        else if (Array.isArray(window.starterStructureDeckDatabase)) elenco = window.starterStructureDeckDatabase;
        const posseduti = window.SaveManager ? SaveManager.getOwnedPacks() : [];
        return elenco
            // Un mazzo SENZA carte non si vende: "Starter Deck 2006" ha
            // `main: []` (è nel dataset ma non è mai stato riempito), e
            // comprarlo per 8 Stelle avrebbe dato al giocatore
            // esattamente nulla in cambio. Quando verrà riempito tornerà
            // in vetrina da solo, senza toccare niente qui.
            .filter((deck) => (deck.main || []).length > 0)
            .filter((deck) => !window.Contenuti || Contenuti.carteVietate(deck).length === 0)
            .map((deck) => ({
            packId: deck.packId,
            nome: deck.name,
            kind: deck.kind,
            // La carta stampata sulla scatola: quella scelta a mano se
            // c'è, altrimenti il mostro con l'attacco più alto — stessa
            // regola di resolveCoverCard in creazione-deck.html, così lo
            // stesso mazzo mostra la stessa carta in entrambi i posti.
            coverCardId: deck.coverCardId || cartaSimbolo(deck),
            carte: (deck.main || []).reduce((somma, v) => somma + (v.qty || 0), 0),
            // Costo composto e crescente — vedi costoMazzo qui sopra.
            // Uno Structure parte più caro di uno Starter: è più
            // specializzato e più utile a costruire un mazzo vero.
            // Un mazzo `gratis` (Grande Guerra) non costa niente e non chiede carte speciali; si prende UNA volta sola
            // (posseduto) e non fa salire il prezzo degli altri (vedi possedutiDelTipo).
            gratis: !!deck.gratis,
            costo: deck.gratis
                ? { starChips: 0, credits: 0, richiedeExtra: false, extraQuantita: 0, extraValute: [], giaPosseduti: 0 }
                : costoMazzo(deck.kind),
            // SaveManager.ownsPack, non l'elenco grezzo: è l'unica
            // risposta a "il giocatore ce l'ha già?", la stessa che usa
            // Creazione Deck per decidere se un mazzo si può clonare. Le
            // due schermate devono per forza essere d'accordo, altrimenti
            // si finisce col vendere qualcosa che il giocatore ha già.
            posseduto: window.SaveManager ? SaveManager.ownsPack(deck.packId) : posseduti.indexOf(deck.packId) !== -1,
            // Sbloccato dal progresso delle Storie (vedi statoSblocco):
            // oggi nessun mazzo dichiara un requisito, quindi qui è sempre
            // vero e il Negozio si comporta come prima. Il campo c'è lo
            // stesso, così il giorno in cui un mazzo lo dichiarerà non
            // servirà toccare né questa funzione né chi la legge.
            sblocco: statoSblocco(deck)
        }));
    }

    /** Il pacchetto COMPLETO (con main/extra) per id — serve al Negozio per mostrare cosa contiene prima di comprarlo. */
    function mazzoCompleto(packId) {
        let elenco = [];
        if (typeof starterStructureDeckDatabase !== 'undefined') elenco = starterStructureDeckDatabase;
        else if (Array.isArray(window.starterStructureDeckDatabase)) elenco = window.starterStructureDeckDatabase;
        return elenco.find((d) => d.packId === packId) || null;
    }

    // ================================================================
    // CAMBIO VALUTE — entro un tetto settimanale
    // ================================================================
    // Scelte dell'utente: 500 crediti = 1 Stella; 20 Stelle = 1 Carta Locazione; 20 Stelle = 1 Carta del Millennio;
    // NESSUN cambio fra Carte Locazione e Carte del Millennio, e niente che trasformi Stelle in crediti. Un solo verso
    // per coppia di proposito: e' l'unico modo di non avere cicli di andata e ritorno. Il TETTO (per settimana, riparte
    // il lunedi' con la chiave settimana del server) e' la parte regolabile: le Carte Locazione e del Millennio aprono i
    // mazzi avanzati, quindi senza un tetto i tornei diventerebbero saltabili spendendo Stelle. Numeri di partenza: con
    // ~72 Stelle, ~5 Locazioni e ~2,6 Millennio a settimana (tools/simula-economia.js, Difficile) i tetti aggiungono al piu'
    // il 14% di Stelle, il 40% di Locazioni e il 38% di Millennio.
    const CONVERSIONI = [
        { id: 'crediti-stelle', da: 'credits', a: 'starChips', costo: 500, ottieni: 1, tettoSettimana: 10 },
        { id: 'stelle-locazione', da: 'starChips', a: 'locatorCards', costo: 20, ottieni: 1, tettoSettimana: 2 },
        { id: 'stelle-millennio', da: 'starChips', a: 'millenniumCards', costo: 20, ottieni: 1, tettoSettimana: 1 }
    ];
    const CHIAVE_CONVERSIONI = 'negozioConversioni';

    function chiaveSettimana() {
        if (window.ServerDate && typeof ServerDate.weekKey === 'function') return ServerDate.weekKey();
        return new Date().toISOString().slice(0, 10);
    }

    /** Quante unita' di ogni cambio sono state fatte QUESTA settimana: { 'crediti-stelle': 3, ... }. */
    function conversioniFatte() {
        const s = window.SaveManager && SaveManager.getModeState ? SaveManager.getModeState(CHIAVE_CONVERSIONI) : null;
        return s && s.settimana === chiaveSettimana() && s.fatte ? s.fatte : {};
    }

    /**
     * Lo stato di un cambio per l'interfaccia: { conv, fatte, restanti, massimo } dove `massimo` e' quante volte si puo'
     * farlo ADESSO (tetto rimasto e saldo disponibile).
     */
    function statoConversione(id) {
        const conv = CONVERSIONI.find((c) => c.id === id);
        if (!conv) return null;
        const fatte = Number(conversioniFatte()[id]) || 0;
        const restanti = Math.max(0, conv.tettoSettimana - fatte);
        const saldo = window.SaveManager ? (SaveManager.getCurrency()[conv.da] || 0) : 0;
        return { conv: conv, fatte: fatte, restanti: restanti, massimo: Math.min(restanti, Math.floor(saldo / conv.costo)) };
    }

    /**
     * Fa il cambio `quante` volte (tutto o niente). Torna { ok, motivo?, pagato, ottenuto }. Il saldo e il tetto si
     * ricontrollano QUI: il pulsante e' gia' spento quando non si puo', ma un doppio click non deve poter passare.
     */
    function converti(id, quante) {
        const n = Math.floor(Number(quante) || 0);
        const st = statoConversione(id);
        if (!st || n < 1) return { ok: false, motivo: 'Quantita\' non valida.' };
        if (n > st.restanti) return { ok: false, motivo: st.restanti === 0 ? 'Tetto della settimana raggiunto.' : 'Oltre il tetto della settimana.' };
        const pagato = st.conv.costo * n;
        if ((SaveManager.getCurrency()[st.conv.da] || 0) < pagato) return { ok: false, motivo: 'Saldo insufficiente.' };
        SaveManager.addCurrency(st.conv.da, -pagato);
        SaveManager.addCurrency(st.conv.a, st.conv.ottieni * n);
        const fatte = Object.assign({}, conversioniFatte());
        fatte[id] = (Number(fatte[id]) || 0) + n;
        SaveManager.setModeState(CHIAVE_CONVERSIONI, { settimana: chiaveSettimana(), fatte: fatte });
        return { ok: true, pagato: pagato, ottenuto: st.conv.ottieni * n };
    }

    // ================================================================
    // LIMITE GIORNALIERO DELLE BUSTE
    // ================================================================
    // Busta Base, Avanzata e Leggendaria: al massimo 5 al giorno CIASCUNA (scelta dell'utente; prima solo la Base, 10). Le buste tematiche e premium
    // non hanno limite. Il giorno e' quello del SERVER (ServerDate.dayKey, UTC), come la rotazione delle carte: cambiare l'ora
    // del telefono non azzera il conto. Il conteggio vive in un contenitore a parte, con la chiave del giorno dentro: cambiata la
    // chiave si butta, e il salvataggio non cresce di un blocco per ogni giorno passato.
    const LIMITE_BUSTE_GIORNO = { base: 5, avanzata: 5, leggendaria: 5 };
    const CHIAVE_BUSTE_GIORNO = 'negozioBusteGiorno';

    function chiaveGiorno() {
        if (window.ServerDate && typeof ServerDate.dayKey === 'function') return ServerDate.dayKey();
        return new Date().toISOString().slice(0, 10);
    }

    function busteFatteOggi() {
        const s = window.SaveManager && SaveManager.getModeState ? SaveManager.getModeState(CHIAVE_BUSTE_GIORNO) : null;
        return s && s.giorno === chiaveGiorno() && s.fatte ? s.fatte : {};
    }

    /** Lo stato del limite di una busta oggi: { limite, fatte, restanti }, o null se quella busta non ha limite. */
    function limiteBustaOggi(id) {
        const limite = LIMITE_BUSTE_GIORNO[id];
        if (!limite) return null;
        const fatte = Number(busteFatteOggi()[id]) || 0;
        return { limite: limite, fatte: fatte, restanti: Math.max(0, limite - fatte) };
    }

    /** Segna un acquisto di oggi (da chiamare quando la busta e' davvero stata comprata). */
    function registraAcquistoBusta(id) {
        if (!LIMITE_BUSTE_GIORNO[id]) return;
        const fatte = Object.assign({}, busteFatteOggi());
        fatte[id] = (Number(fatte[id]) || 0) + 1;
        SaveManager.setModeState(CHIAVE_BUSTE_GIORNO, { giorno: chiaveGiorno(), fatte: fatte });
    }

    window.ShopCatalog = {
        LIMITE_BUSTE_GIORNO: LIMITE_BUSTE_GIORNO,
        limiteBustaOggi: limiteBustaOggi,
        registraAcquistoBusta: registraAcquistoBusta,
        CONVERSIONI: CONVERSIONI,
        statoConversione: statoConversione,
        converti: converti,
        PREZZI: PREZZI,
        PREZZI_MAZZI: PREZZI_MAZZI,
        BUSTE: BUSTE,
        TEMI: TEMI,
        costoMazzo: costoMazzo,
        /** Quante carte speciali servono al dato numero di acquisti già fatti — vedi il commento sopra EXTRA_MAZZO. Esposta perché la UI possa scrivere il numero VERO nella regola invece di uno fisso destinato a invecchiare male. */
        extraRichieste: extraRichieste,
        /** "Questo si compra già?" — vedi statoSblocco: { sbloccato, motivo }. Vale per un mazzo come per una carta. */
        statoSblocco: statoSblocco,
        mazzoCompleto: mazzoCompleto,
        carteDelGiorno: carteDelGiorno,
        segnaCartaDelGiornoComprata: segnaCartaDelGiornoComprata,
        busteDellaSettimana: busteDellaSettimana,
        apriBusta: apriBusta,
        /** Verifica la regola di ottenibilità condivisa da tutti i pool delle buste. */
        isCartaAmmessaInBusta: acquistabileInBusta,
        mazziInVendita: mazziInVendita
    };
})();
