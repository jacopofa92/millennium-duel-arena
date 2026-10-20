/**
 * cards-db.js — Funzioni di supporto sul database carte.
 *
 * L'ANAGRAFICA VERA E PROPRIA (le 508 carte) NON è più qui: vive in
 * data/cards.json (fonte di verità editabile a mano) e viene caricata
 * tramite js/data/cards-data.generated.js — un file generato automaticamente
 * da data/cards.json con `node scripts/build-cards-data.js`, caricato
 * PRIMA di questo file (vedi l'ordine degli <script> in duelMonstersCore.html/
 * cartoteca.html/creazione-deck.html). Questo file resta un normale
 * <script> sincrono (niente fetch()): il Duello Demo e la Cartoteca sono
 * pensati per funzionare aprendo i file .html direttamente, e un fetch()
 * di un file locale viene bloccato dal browser sotto il protocollo
 * file:// — vedi il commento in cima a scripts/build-cards-data.js.
 *
 * PER AGGIUNGERE O MODIFICARE UNA CARTA: modifica data/cards.json (un
 * array di oggetti con gli stessi campi descritti sotto), poi esegui
 * `node scripts/build-cards-data.js` e ricarica la pagina — non serve
 * toccare questo file né il motore.
 *
 * Guida ai campi di ogni carta in data/cards.json:
 *
 * Ogni mostro ha un campo "level" (stelle) che determina se serve un
 * Tributo per essere Evocato Normalmente:
 *   - Level 7+   -> richiede 2 Tributi (sacrifica 2 mostri sul Terreno)
 *   - Level 5-6  -> richiede 1 Tributo (sacrifica 1 mostro sul Terreno)
 *   - Level 1-4  -> nessun Tributo, evocazione libera
 *
 * "origin" (provenienza): a cosa appartiene la carta, usato dal filtro
 * Provenienza in cartoteca.html e mostrato nel riepilogo di un deck in
 * creazione-deck.html — pensato per futuri duelli con restrizioni (es.
 * "solo carte Yu-Gi-Oh"). Valori usati finora: 'yu-gi-oh' (tutte le
 * carte qui sotto, il gioco base), 'ww1' (set "Regio Esercito", id
 * 1200-1224, le cui illustrazioni stanno in una cartella a parte: vedi
 * getCardImagePath in js/ui/card-renderer.js), 'fanmade' (carte originali di questo
 * progetto, non ancora presenti), 'ww2' (set a tema storico,
 * anch'essi non ancora presenti) — la tassonomia è già pronta per quando
 * arriveranno.
 *
 * "subtype" (solo Magie/Trappole): il vero sottotipo ufficiale della
 * carta — 'normal'/'continuous'/'quick-play'/'ritual'/'field'/'equip' per
 * le Magie, 'normal'/'continuous'/'counter' per le Trappole. Usato dal
 * filtro Sottotipo in cartoteca.html/creazione-deck.html. È un dato di
 * IDENTITÀ della carta (cosa è davvero nel gioco vero), indipendente da
 * come questo motore la implementa internamente — es. Spada Rivelatrice
 * è una Magia Normale ufficiale anche se qui resta scoperta sul Terreno
 * con `continuous: true` in js/engine/card-effects.js per comodità di
 * implementazione (vedi il commento lì).
 *
 * "artOnly" (opzionale, solo se true): l'immagine in images/cards/<id>.jpg
 * è SOLO l'illustrazione ritagliata (niente scan completo della carta —
 * nessun nome/stelle/ATK-DEF disegnati dentro il file), a differenza delle
 * altre immagini di questo set che sono scan completi pronti da mostrare
 * così come sono. js/ui/card-renderer.js usa questo flag per decidere DOVE
 * mettere l'immagine: uno scan completo copre l'intera carta (nasconde la
 * cornice CSS, che sarebbe ridondante); un'illustrazione va invece DENTRO
 * la finestra-immagine della cornice CSS (.card-frame-art), che resta
 * visibile intorno a lei con nome/stelle/ATK-DEF disegnati a CSS.
 *
 * "vanilla" (solo mostri Normali/Rituali/Fusione non-Rituale/non-Fusione,
 * opzionale, solo se true): vero se questa carta è un vero Normal Monster
 * nel gioco reale (nessun effetto di carta, solo testo descrittivo), per
 * distinguerla da un vero Effect Monster — è un dato di IDENTITÀ della
 * carta, indipendente dal fatto che il suo effetto sia già stato
 * programmato in questo motore o resti data-only (stesso spirito del
 * campo "subtype" sopra). js/ui/card-renderer.js lo usa per la tinta
 * arancione (Effect Monster) contro gialla (Normal Monster) dello sfondo
 * carta — vedi js/ui/card.css — assente su Rituali/Fusioni, che hanno già il
 * proprio colore strutturale (blu/viola) indipendente da questa
 * distinzione. Le 5 carte di Exodia (id 11, 41-44) sono vanilla: true
 * anche se il loro testo descrive la vittoria automatica, perché sulla
 * carta reale quella non è un "effetto" ma una regola speciale legata al
 * possedere tutti e 5 i pezzi in mano.
 *
 * Campi predisposti per usi futuri (facoltativi, non ancora popolati da
 * nessuna carta — vedi roadmap "evocazioni con filmati"/"audio dedicato"):
 * "summonVideo"/"spellEffectFile"/"trapEffectFile"/"audioOverride".
 *
 * "missingEffectNote" (facoltativo, testo libero): spiega PERCHÉ questa
 * carta ha un "effect" descrittivo ma NESSUNA registrazione in
 * js/engine/card-effects.js — di solito perché richiederebbe una capacità del
 * motore non ancora presente (es. "prendi il controllo di un mostro
 * avversario", buff ATK/DEF continuo su più carte Equip, danno
 * perforante generico) o dipende da un'altra carta non presente in
 * questo database. Recuperato da un'estrazione di data/cards.json fatta
 * senza commenti — questo campo esiste apposta per non perdere di nuovo
 * quella documentazione. Rimuovi il campo quando l'effetto viene infine
 * implementato.
 */

/**
 * Copie massime di una carta ammesse in un mazzo.
 *
 * Il campo `limit` in data/cards.json viene dalla Lista Limitazioni TCG
 * ufficiale (vedi lo script di cernita in cronologia: le carte Bandite e
 * quelle Limitate valgono 1, le Semi-Limitate 2). Il campo è ASSENTE per
 * la stragrande maggioranza delle carte, e assente significa 3 — il
 * massimo normale — così solo le eccezioni vere occupano spazio nei dati.
 *
 * Unico punto che traduce "campo dati" in "quante copie posso metterne":
 * l'editor mazzi, il bollino sulla carta e qualunque futuro controllo di
 * legalità devono passare da qui invece di leggere `card.limit` a mano e
 * doversi ricordare del default.
 */
const MAX_COPIES_PER_DECK = 3;
function getCardCopyLimit(card) {
    if (!card) return MAX_COPIES_PER_DECK;
    const limit = Number(card.limit);
    return (limit === 1 || limit === 2) ? limit : MAX_COPIES_PER_DECK;
}

/** Etichette leggibili per il filtro Provenienza di cartoteca.html e il riepilogo deck di creazione-deck.html. */
const CARD_ORIGIN_LABELS = {
    'yu-gi-oh': 'Yu-Gi-Oh!',
    'fanmade': 'Fanmade',
    'ww1': 'WW1',
    'ww2': 'WW2'
};

/**
 * I 6 termini standard del gioco vero, quelli che una provenienza diversa
 * da Yu-Gi-Oh può rimpiazzare (vedi CARD_ORIGIN_TERMS/getOriginTerms qui
 * sotto). js/data/custom-taxonomy.js li rilegge da qui invece di tenerne
 * una propria copia: due elenchi paralleli finirebbero prima o poi per
 * divergere.
 */
const DEFAULT_CARD_TERMS = {
    monsterSingular: 'Mostro', monsterPlural: 'Mostri',
    spellSingular: 'Magia', spellPlural: 'Magie',
    trapSingular: 'Trappola', trapPlural: 'Trappole'
};

/**
 * Terminologia DI SERIE delle provenienze distribuite col gioco: un set
 * storico non parla di "Mostri" e "Magie", e quei termini devono arrivare
 * insieme alle carte su QUALUNQUE dispositivo. La terminologia
 * personalizzabile dall'utente (CustomTaxonomy, scheda "🏷️ Categorie" di
 * crea-carta.html) vive invece nel localStorage del singolo giocatore,
 * quindi non poteva coprire un set distribuito: resta uno strato di
 * override SOPRA questa tabella, non un sostituto.
 *
 * ATTENZIONE al GENERE GRAMMATICALE scegliendo un termine nuovo: i
 * sottotipi vengono composti aggiungendo un aggettivo GIÀ declinato al
 * femminile ("Continua", "Veloce") al termine base, perché i termini
 * standard che rimpiazza sono tutti femminili (Magia/Trappola). "Manovra
 * Continua" funziona, "Ordine Continua" no. Scegliere quindi nomi
 * femminili, oppure estendere prima la composizione in
 * js/ui/card-renderer.js#typeLineText.
 *
 * 'yu-gi-oh' non compare apposta: usa sempre e solo i termini standard,
 * non personalizzabili (stessa regola già applicata da crea-carta.html).
 */
const CARD_ORIGIN_TERMS = {
    ww1: {
        monsterSingular: 'Truppa', monsterPlural: 'Truppe',
        spellSingular: 'Manovra', spellPlural: 'Manovre',
        trapSingular: 'Insidia', trapPlural: 'Insidie'
    }
};

/**
 * I 6 termini da usare per una provenienza, risolti in un punto solo e
 * sempre tutti valorizzati (mai `undefined`: si possono usare direttamente
 * per etichettare la UI senza un fallback ad ogni chiamata). Tre strati,
 * dal più debole al più forte: i termini standard del gioco, la
 * terminologia di serie della provenienza (CARD_ORIGIN_TERMS), infine
 * l'override scritto dall'utente in crea-carta.html — così un giocatore
 * che preferisce "Reparto" a "Truppa" vince comunque sul valore di serie,
 * senza che questo debba saperne nulla.
 */
function getOriginTerms(originKey) {
    const terms = Object.assign({}, DEFAULT_CARD_TERMS, CARD_ORIGIN_TERMS[originKey] || {});
    // CustomTaxonomy può non essere caricata (non tutte le pagine la
    // includono) — in quel caso restano i due strati di serie.
    if (originKey && window.CustomTaxonomy && typeof CustomTaxonomy.getRawTerminologyOverride === 'function') {
        const override = CustomTaxonomy.getRawTerminologyOverride(originKey) || {};
        Object.keys(override).forEach((k) => { if (override[k]) terms[k] = override[k]; });
    }
    return terms;
}

/** Scorciatoia di getOriginTerms per quando si ha in mano la carta invece della sola provenienza. */
function getCardTerms(card) {
    return getOriginTerms(card && card.origin);
}

/**
 * Segnaposto utilizzabili DENTRO il testo effetto di una carta, risolti
 * con la terminologia della sua provenienza. Scrivere "Truppa" a mano nel
 * testo non andrebbe bene: il giocatore può riscrivere i termini di una
 * provenienza dal Card Maker, e una descrizione con il termine cucito
 * dentro resterebbe indietro rispetto al resto della UI.
 * L'iniziale del segnaposto decide quella del risultato — `{mostro}` dà
 * "truppa" (a metà frase), `{Mostro}` dà "Truppa" (a inizio frase o come
 * nome proprio del tipo di carta).
 */
const CARD_TERM_PLACEHOLDERS = {
    mostro: 'monsterSingular', mostri: 'monsterPlural',
    magia: 'spellSingular', magie: 'spellPlural',
    trappola: 'trapSingular', trappole: 'trapPlural'
};

/**
 * Testo di una carta pronto da mostrare: i segnaposto sostituiti con i
 * termini della provenienza (vedi CARD_TERM_PLACEHOLDERS). Da usare in
 * OGNI punto che mostra card.effect a schermo — mai sul valore che finisce
 * in un campo modificabile del Card Maker, dove deve restare il testo
 * sorgente coi segnaposto, altrimenti salvando si perderebbero.
 * Un testo senza segnaposto (la stragrande maggioranza delle carte, tutte
 * quelle Yu-Gi-Oh) torna identico e senza alcun lavoro.
 */
function formatCardText(text, card) {
    if (!text || String(text).indexOf('{') === -1) return text;
    const terms = getCardTerms(card);
    return String(text).replace(/\{([A-Za-z]+)\}/g, (whole, key) => {
        const termKey = CARD_TERM_PLACEHOLDERS[key.toLowerCase()];
        if (!termKey) return whole; // segnaposto sconosciuto: meglio lasciarlo visibile che farlo sparire
        const term = terms[termKey];
        const wantsCapital = key.charAt(0) === key.charAt(0).toUpperCase();
        return wantsCapital ? term : term.charAt(0).toLowerCase() + term.slice(1);
    });
}

/** Etichette leggibili per il filtro Categoria Mostro di cartoteca.html/creazione-deck.html. */
const MONSTER_CATEGORY_LABELS = {
    normal: '⚪ Normale',
    effect: '🟠 Con Effetto',
    fusion: '🟣 Fusione',
    ritual: '🔵 Rituale'
};

/**
 * Elenco completo dei Tipi Mostro (razze) ufficiali di Yu-Gi-Oh, per il
 * filtro "Tipo Mostro" di cartoteca.html/creazione-deck.html — un elenco
 * FISSO, non derivato dalle sole carte già presenti nel database, così il
 * filtro mostra sempre tutte le opzioni previste dal gioco vero anche per
 * i tipi non ancora rappresentati da nessuna carta qui dentro. Limitato ai
 * tipi già esistenti nell'era della prima serie (niente Psichico/Cyberse/
 * Wyrm/Dio Creatore, introdotti da espansioni molto più recenti).
 */
const MONSTER_RACES = [
    'Guerriero', 'Incantatore', 'Fata', 'Demone', 'Zombie', 'Macchina',
    'Acquatico', 'Piroico', 'Roccia', 'Bestia Alata', 'Pianta', 'Insetto',
    'Tuono', 'Drago', 'Bestia', 'Bestia-Guerriero', 'Dinosauro', 'Pesce',
    'Serpente di Mare', 'Rettile', 'Essere Divino', 'Illusione'
];

/**
 * Tipi Mostro DI SERIE delle provenienze distribuite col gioco — gemello
 * di CARD_ORIGIN_TERMS qui sopra, e per lo stesso identico motivo: i Tipi
 * personalizzabili dall'utente (CustomTaxonomy) vivono nel localStorage
 * del singolo giocatore, quindi un set che viene distribuito insieme al
 * gioco non poteva appoggiarsi a loro. Il set 'ww1' non parla di
 * Guerrieri e Macchine ma dei corpi reali del Regio Esercito.
 *
 * Un Tipo elencato qui può non avere ancora nessuna carta che lo usa
 * (oggi è il caso di 'Cavalleria'): stessa scelta già fatta per
 * MONSTER_RACES, che elenca tutti i Tipi ufficiali del gioco vero anche
 * quelli non ancora rappresentati nel dataset — il filtro deve mostrare
 * l'intera tassonomia, non solo la parte già riempita.
 */
const CARD_ORIGIN_RACES = {
    // Il set 'ww1' copre ENTRAMBI i fronti, quindi la sua tassonomia
    // mette insieme i corpi dei due eserciti che si affrontarono: prima
    // quelli del Regio Esercito, poi quelli imperiali austro-ungarici.
    // Artiglieria, Cavalleria e Aviazione restano invece condivise — sono
    // parole generiche, ed entrambi gli eserciti le avevano: sdoppiarle
    // avrebbe raddoppiato l'elenco senza aggiungere nulla, dato che ogni
    // carta che potenzia un Tipo agisce comunque solo sulle carte che il
    // giocatore CONTROLLA.
    ww1: [
        'Fanteria', 'Bersaglieri', 'Alpini', 'Arditi',
        'Landwehr', 'Kaiserjäger', 'Sturmtruppen',
        'Artiglieria', 'Cavalleria', 'Aviazione'
    ]
};

/**
 * Tipi Mostro disponibili per una provenienza: quelli di serie più quelli
 * che l'utente ha associato a quella provenienza nel Card Maker. Stessa
 * struttura a strati di getOriginTerms, e stesso motivo per cui esiste:
 * un punto solo da chiamare invece di ricomporre l'unione ad ogni uso.
 */
function getOriginRaces(originKey) {
    const builtIn = CARD_ORIGIN_RACES[originKey] || [];
    const custom = (originKey && window.CustomTaxonomy && typeof CustomTaxonomy.listRacesFor === 'function')
        ? CustomTaxonomy.listRacesFor(originKey)
        : [];
    return [...new Set(builtIn.concat(custom))];
}

/**
 * Tutti i Tipi Mostro che il gioco conosce A PRESCINDERE dalle carte
 * presenti: gli ufficiali di Yu-Gi-Oh più quelli di serie di ogni
 * provenienza distribuita col gioco. È quello che serve ai filtri
 * "Tipo Mostro" di cartoteca.html/creazione-deck.html, che per scelta
 * mostrano l'intera tassonomia e non solo la parte già rappresentata da
 * una carta — altrimenti un Tipo previsto ma ancora senza carte (es.
 * 'Cavalleria') sparirebbe dall'elenco invece di apparire semplicemente
 * senza risultati.
 */
function getAllKnownRaces() {
    const fromOrigins = Object.keys(CARD_ORIGIN_RACES)
        .reduce((acc, key) => acc.concat(CARD_ORIGIN_RACES[key]), []);
    return [...new Set(MONSTER_RACES.concat(fromOrigins))];
}

/** Etichette leggibili per il filtro Sottotipo Magia (card.subtype quando type === 'spell'). */
const SPELL_SUBTYPE_LABELS = {
    normal: 'Normale',
    continuous: 'Continua',
    'quick-play': 'Veloce',
    ritual: 'Rituale',
    field: 'Campo',
    equip: 'Equipaggiamento'
};

/** Etichette leggibili per il filtro Sottotipo Trappola (card.subtype quando type === 'trap'). */
const TRAP_SUBTYPE_LABELS = {
    normal: 'Normale',
    continuous: 'Continua',
    counter: 'Contatore'
};

/**
 * Categoria filtro di un mostro: 'fusion'/'ritual' vengono da card.category
 * (js/data/cards-db.js), 'effect' richiede che js/engine/duel-engine.js + js/engine/card-effects.js
 * siano caricati (solo nel duello vero — su Cartoteca/Creazione Deck vengono
 * caricati apposta SOLO per questo, vedi i rispettivi <script>). Se il motore
 * effetti non è disponibile, ogni mostro senza categoria strutturale ricade
 * su 'normal' anziché rompere il filtro.
 */
function getMonsterFilterCategory(card) {
    if (!card || card.type !== 'monster') return null;
    if (card.category === 'fusion') return 'fusion';
    if (card.category === 'ritual') return 'ritual';
    if (window.DuelEngine && typeof DuelEngine.getDefinition === 'function') {
        return DuelEngine.getDefinition(card.id) ? 'effect' : 'normal';
    }
    // Senza motore (Cartoteca, Creazione Deck: non lo caricano piu', vedi scripts/build-card-effect-ids.js) si usa
    // l'elenco generato; una carta custom con un effetto composto/clonato conta come 'effect' anche se non e' nell'elenco.
    if ((window.CARD_EFFECT_IDS && window.CARD_EFFECT_IDS.has(card.id)) || card.effectTemplate || card.cloneEffectOf) return 'effect';
    return 'normal';
}

// Pool per il pescaggio casuale del Duello Demo (nessun vero mazzo salvato,
// vedi createRandomCard sotto): esclude le carte extraDeck:true (Fusione/
// Rituale), che non si pescano mai normalmente — calcolato una sola volta,
// non ad ogni pescata.
let _randomDrawPool = null;
function getRandomDrawPool() {
    if (!_randomDrawPool) {
        _randomDrawPool = cardDatabase.filter((c) => !c.extraDeck);
    }
    return _randomDrawPool;
}

/**
 * La casualità di GIOCO (mescolare un mazzo, pescare a caso): Casuale
 * (js/engine/casuale.js) se c'è — in Multiplayer esce da un seme condiviso
 * coi due client — altrimenti Math.random. Questo file si carica anche in
 * pagine senza il motore (Cartoteca, Creazione Deck), dove Casuale non c'è.
 */
function casualeDiGioco() {
    return typeof Casuale !== 'undefined' ? Casuale.random() : Math.random();
}

function createRandomCard() {
    const pool = getRandomDrawPool();
    const template = pool[Math.floor(casualeDiGioco() * pool.length)];
    return { ...template, uid: Date.now() + Math.random() };
}

/**
 * Espande un deck salvato/a tema — { main: [{id, qty}, ...] } (vedi
 * js/save-manager.js e js/data/character-decks.js) — in un mazzo REALE
 * mescolato: un array di carte pronte da pescare una alla volta con
 * .pop(), ognuna con il proprio uid. Solo il Main Deck: l'Extra Deck
 * (Fusione) non si pesca mai normalmente, quindi resta ignorato qui —
 * usato da resetGameState() in js/engine/game-flow.js per le partite offline.
 * Ritorna null se lo spec non è valido, così chi chiama può ricadere sul
 * vecchio pool casuale invece di un mazzo vuoto.
 *
 * `opzioni.prefissoUid`: uid deterministici (`<prefisso>_<n>`) invece che
 * fatti di ora e caso. Serve al Multiplayer a passo comune, dove i due
 * client costruiscono lo stesso mazzo e devono dare alla stessa carta lo
 * stesso uid (le scelte viaggiano per uid). Senza, nulla cambia.
 */
function buildDeckFromSpec(deckSpec, opzioni) {
    if (!deckSpec || !Array.isArray(deckSpec.main) || deckSpec.main.length === 0) return null;
    const prefisso = opzioni && opzioni.prefissoUid;
    const cards = [];
    deckSpec.main.forEach((entry) => {
        const template = cardDatabase.find((c) => c.id === entry.id);
        if (!template) return;
        for (let i = 0; i < entry.qty; i++) {
            const uid = prefisso ? `${prefisso}_${cards.length}` : `${Date.now()}_${Math.random().toString(36).slice(2)}_${cards.length}`;
            cards.push({ ...template, uid });
        }
    });
    if (cards.length === 0) return null;
    // Fisher-Yates
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(casualeDiGioco() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}

/**
 * Costruisce uno deckSpec { main: [{id, qty}] } di 40 carte "equilibrato"
 * come i veri Structure Deck (vedi js/data/starter-structure-decks.js):
 * usato come mazzo di ripiego quando il giocatore non ne ha uno vero
 * (Duello Demo, o Duello Libero senza un deck attivo salvato — vedi
 * resetGameState() in js/engine/game-flow.js), al posto del vecchio
 * pescaggio a singola carta casuale dall'intero database (createRandomCard
 * sopra), che non aveva alcuna coerenza di rapporto mostri/magie/trappole
 * né una curva di Livello sensata.
 *
 * Composizione (su 40 carte, ricalcata sulla proporzione tipica di uno
 * Structure Deck): 20 mostri con una curva di Livello pensata per essere
 * giocabile fin da subito (pochi mostri da Tributo, il grosso a basso/
 * medio Livello), 11 Magie, 9 Trappole. Al massimo 2 copie della stessa
 * carta, per un minimo di varietà senza scadere nel mazzo mono-carta.
 */
function buildBalancedDemoDeckSpec() {
    const pool = getRandomDrawPool();
    const monsterPool = pool.filter((c) => c.type === 'monster');
    const spellPool = pool.filter((c) => c.type === 'spell');
    const trapPool = pool.filter((c) => c.type === 'trap');

    function shuffledCopy(arr) {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(casualeDiGioco() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
    function byLevel(min, max) {
        return monsterPool.filter((c) => (c.level || 0) >= min && (c.level || 0) <= max);
    }

    const MAX_COPIES = 2;
    const counts = new Map(); // id -> qty già scelta
    function take(sourceArr, n) {
        let taken = 0;
        for (const card of shuffledCopy(sourceArr)) {
            if (taken >= n) break;
            const current = counts.get(card.id) || 0;
            if (current >= MAX_COPIES) continue;
            counts.set(card.id, current + 1);
            taken++;
        }
        return taken;
    }

    // Curva di Livello ispirata agli Structure Deck classici: qualche
    // utility di Livello 1-2, il grosso a Livello 3-4 (evocabile subito,
    // senza Tributo), una manciata di Livello 5-6 (1 Tributo) e un paio di
    // "finisher" di Livello 7+ (2 Tributi) per chiudere il duello.
    take(byLevel(1, 2), 3);
    take(byLevel(3, 4), 10);
    take(byLevel(5, 6), 5);
    take(byLevel(7, 12), 2);
    take(spellPool, 11);
    take(trapPool, 9);

    // Rete di sicurezza: se una fascia era troppo piccola nel database per
    // arrivare a 40 carte, completa pescando altri mostri/carte qualunque
    // (capped comunque a MAX_COPIES per id) invece di consegnare un mazzo
    // più corto del previsto.
    let total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    if (total < 40) total += take(monsterPool, 40 - total);
    if (total < 40) total += take(pool, 40 - total);

    const main = Array.from(counts.entries()).map(([id, qty]) => ({ id, qty }));
    return { main, extra: [] };
}

/**
 * Espande la parte Extra Deck di un deck salvato/a tema — { extra: [{id,
 * qty}, ...] }, stesso formato di deckSpec.main qui sopra. A differenza
 * del Main Deck NON viene mescolato (non si pesca mai a caso dall'Extra
 * Deck, ci si guarda dentro e si sceglie) — usato da resetGameState() in
 * js/engine/game-flow.js per popolare gameState.playerExtraDeck/botExtraDeck,
 * la riserva da cui pesca l'Evocazione Fusione (vedi ACTIONS.fusionSummon
 * in js/engine/duel-engine.js). Ritorna sempre un array (mai null): un deck
 * senza Extra Deck è normalissimo, non un errore.
 */
function buildExtraDeckFromSpec(deckSpec, opzioni) {
    if (!deckSpec || !Array.isArray(deckSpec.extra) || deckSpec.extra.length === 0) return [];
    // `opzioni.prefissoUid`: uid deterministici, vedi buildDeckFromSpec.
    const prefisso = opzioni && opzioni.prefissoUid;
    const cards = [];
    deckSpec.extra.forEach((entry) => {
        const template = cardDatabase.find((c) => c.id === entry.id);
        if (!template) return;
        for (let i = 0; i < entry.qty; i++) {
            const uid = prefisso ? `${prefisso}_ed${cards.length}` : `${Date.now()}_${Math.random().toString(36).slice(2)}_ed${cards.length}`;
            cards.push({ ...template, uid });
        }
    });
    return cards;
}

/**
 * Livello EFFETTIVO di un mostro, tenendo conto di Un Oceano Leggendario
 * (id 79: "ogni mostro ACQUA sul campo E nelle mani di entrambi i
 * giocatori è considerato di Livello inferiore di 1"). Parallelo
 * "leggero" di getEffectiveAtk/Def (duel-engine.js): NON vive lì per non
 * legare questo file (cards-db.js — usato anche da pagine come
 * cartoteca.html/crea-carta.html, che caricano duel-engine.js ma non
 * sempre game-flow.js/gameState) al motore, e resta comunque sicuro
 * fuori da un vero duello grazie al controllo `typeof gameState` — stesso
 * pattern difensivo già usato in duel-engine.js. A differenza del bonus
 * ATK/DEF di id 79 (solo mostri SCOPERTI sul Terreno, calcolato per uid
 * in gameState.atkDefBonus), la riduzione di Livello si applica a
 * QUALUNQUE mostro ACQUA ovunque si trovi (anche coperto, anche in
 * mano) — un semplice flag globale (gameState.legendaryOceanActive,
 * impostato/azzerato da recomputeStaticEffects come ogni altro floodgate
 * "per entrambi i giocatori") basta, senza bisogno di scandire mano/Terreno.
 */
function getEffectiveLevel(card) {
    if (!card || !card.level) return card ? card.level : 0;
    // Guardiano Kay'est (id 285): "non è influenzata dagli effetti delle
    // Magie" — id hardcoded qui (non un lookup su DuelEngine.getDefinition,
    // proprio per non introdurre la dipendenza da duel-engine.js che
    // questa funzione evita deliberatamente, vedi sopra) esattamente come
    // i 3 Dei Egizi qui sotto in getTributesRequired.
    if (card.id === 285) return card.level;
    if (typeof gameState !== 'undefined' && gameState.legendaryOceanActive && card.attribute === 'ACQUA') {
        return Math.max(0, card.level - 1);
    }
    return card.level;
}

/**
 * Calcola quanti Tributi servono per Evocare Normalmente un dato mostro,
 * in base al suo Livello EFFETTIVO (stelle, ridotto da eventuali effetti
 * come Un Oceano Leggendario).
 */
function getTributesRequired(card) {
    if (!card || card.type !== 'monster' || !card.level) return 0;
    // I 3 Dei Egizi (Obelisk id 30, Slifer id 31, Ra id 472): testo
    // ufficiale verificato su db.yugioh-card.com — "Richiede 3 Tributi
    // per essere Evocato Normalmente", unica eccezione ai soliti 2 di un
    // mostro di Livello 7+ in questo dataset. Nessuno dei tre è ACQUA,
    // quindi getEffectiveLevel non li tocca comunque.
    // Gilford il Fulmine (id 267): stessa eccezione "3 Tributi invece di
    // 2" ma per un motivo diverso dagli Dei Egizi — non è un floodgate di
    // potenza, è testo letterale della carta ("Puoi Sacrificare 3 mostri
    // per Evocare Tributo... questa carta"), verificato su YGOPRODeck.
    if (card.id === 30 || card.id === 31 || card.id === 472 || card.id === 1275 || card.id === 267) return 3;
    const level = getEffectiveLevel(card);
    if (level >= 7) return 2;
    if (level >= 5) return 1;
    return 0;
}

/**
 * Alcuni mostri "possono essere considerati come 2 Tributi" per l'Evocazione
 * Tributo, ma SOLO quando il mostro evocato ha un Attributo specifico —
 * Cavaliere Marino Kaiser (id 321, solo per LUCE), Doppio Coston (id 666,
 * solo per OSCURITÀ), Pescatore Ispido (id 703, solo per ACQUA). Consultata
 * da handleTributeSelectClick (js/engine/actions.js) per pesare ogni
 * mostro sacrificato invece di contarlo sempre come 1 — vedi lì per come
 * si somma il conteggio durante la selezione.
 */
const DOUBLE_TRIBUTE_CARDS = { 321: 'LUCE', 666: 'OSCURITÀ', 703: 'ACQUA' };
function getTributeValue(sacrificeCard, summonedCard) {
    if (!sacrificeCard) return 1;
    const requiredAttr = DOUBLE_TRIBUTE_CARDS[sacrificeCard.id];
    if (requiredAttr && summonedCard && summonedCard.attribute === requiredAttr) return 2;
    return 1;
}

// ---------------------------------------------------------------------
// Esposizione esplicita su `window` delle tabelle che ALTRI moduli
// leggono in quella forma. Non è una ridondanza: un `const` in cima a uno
// script classico finisce nello scope globale dichiarativo, NON come
// proprietà di `window` — quindi `window.MONSTER_RACES` era semplicemente
// `undefined`, e js/data/custom-taxonomy.js (che le legge così, per
// funzionare anche nelle pagine dove questo file non è caricato affatto)
// si ritrovava sempre un elenco vuoto: il controllo "non ricreare un Tipo
// Mostro che esiste già fra quelli standard" non poteva scattare mai.
// Bug preesistente, chiuso qui insieme alla terminologia.
// ---------------------------------------------------------------------
window.CARD_ORIGIN_LABELS = CARD_ORIGIN_LABELS;
window.MONSTER_RACES = MONSTER_RACES;
window.DEFAULT_CARD_TERMS = DEFAULT_CARD_TERMS;
window.CARD_ORIGIN_TERMS = CARD_ORIGIN_TERMS;
window.CARD_ORIGIN_RACES = CARD_ORIGIN_RACES;
window.getOriginTerms = getOriginTerms;
window.getCardTerms = getCardTerms;
window.formatCardText = formatCardText;
window.getOriginRaces = getOriginRaces;
window.getAllKnownRaces = getAllKnownRaces;
