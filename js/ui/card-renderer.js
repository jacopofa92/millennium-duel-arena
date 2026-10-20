/**
 * card-renderer.js — Costruisce il DOM di una carta, uguale ovunque.
 * =====================================================================
 * File "gemello" di js/ui/card.css (che la veste). Prima di questo file
 * esistevano 5-6 punti diversi nel progetto che ricostruivano a mano il
 * markup di una carta (mano/campo in duelMonstersCore.html, la Cartoteca, il
 * cercatore carte di creazione-deck.html, l'anteprima di trascinamento,
 * l'animazione di pesca...), leggermente diversi tra loro e via via
 * disallineati. Ora c'è una funzione sola, `createCardElement(...)`, e
 * tutte le pagine la richiamano.
 *
 * Include anche questo file (e js/ui/card.css) PRIMA di qualunque script
 * di pagina che mostri carte.
 */
(function () {
    'use strict';

    // Icona-segnaposto per tipo di carta: usata sia come "arte" nel
    // fallback CSS sia (per Magia/Trappola) nel badge in alto a destra.
    const TYPE_ICON = { monster: '👑', spell: '✨', trap: '🌀' };

    // Kanji dell'Attributo come sulle vere carte Yu-Gi-Oh (光/闇/地/風/水/炎/神).
    const ATTRIBUTE_ICON = {
        'LUCE': '光',
        'OSCURITÀ': '闇',
        'TERRA': '地',
        'VENTO': '風',
        'ACQUA': '水',
        'FUOCO': '炎',
        'DIVINO': '神'
    };

    // Retro Duel Monsters in stile anime di Gaia206. La copia locale evita
    // dipendenze da DeviantArt e conserva il gioco utilizzabile offline.
    // Fonte: https://www.deviantart.com/gaia206/art/Yu-Gi-Oh-Duel-Monsters-Back-Card-335785397
    let caricamentoImmaginiDifferito = 0;

    /**
     * Durante la riconciliazione del duello costruiamo anche nodi provvisori
     * che, nella grande maggioranza dei casi, vengono subito scartati perché
     * la carta a schermo non è cambiata. Assegnare comunque `src` a quelle
     * immagini costringeva Chromium a programmarne decodifica e compositing:
     * dopo molti updateUI il lavoro si accodava e produceva il lampo sporadico
     * segnalato dall'utente. Il nodo riceve quindi soltanto il percorso come
     * dato; il `src` viene assegnato DOPO la riconciliazione, solo ai nodi
     * realmente entrati nel documento.
     */
    function assegnaSorgenteImmagine(img, percorso) {
        if (caricamentoImmaginiDifferito > 0) img.dataset.cardDeferredSrc = percorso;
        else img.src = percorso;
    }

    function iniziaImmaginiDifferite() {
        caricamentoImmaginiDifferito++;
    }

    function terminaImmaginiDifferite() {
        caricamentoImmaginiDifferito = Math.max(0, caricamentoImmaginiDifferito - 1);
    }

    function caricaImmaginiDifferite(radice) {
        if (!radice) return;
        radice.querySelectorAll('img[data-card-deferred-src]').forEach((img) => {
            const percorso = img.dataset.cardDeferredSrc;
            delete img.dataset.cardDeferredSrc;
            img.src = percorso;
            // Con una risorsa già decodificata Chromium può avere complete=true
            // nello stesso turno e non ridipingere il fallback: rendiamola
            // visibile subito, come fanno già i tre renderer qui sotto.
            if (img.complete && img.naturalWidth > 0 && typeof img.onload === 'function') img.onload();
        });
    }

    // Le carte che Yu-Gi-Oh NON sono (set storici 'ww1'/'ww2', carte
    // 'fanmade': vedi il campo "origin" in js/data/cards-db.js) tengono le
    // proprie illustrazioni in una cartella a parte. È UNA cartella sola per
    // tutte le provenienze non-Yu-Gi-Oh, non una per set: quel materiale ha
    // un'origine e una licenza completamente diverse dal gioco ufficiale e
    // va tenuto distinguibile a colpo d'occhio, ma una cartella per ogni
    // nuovo set le moltiplicherebbe senza aggiungere nulla — l'id della
    // carta è già univoco su TUTTO il dataset, quindi non ci sono collisioni
    // possibili tra un set e l'altro.
    const NON_YGO_ART_DIR = 'images/cards/non-ygo';

    /**
     * Percorso (o data URI) dell'immagine reale della carta. Convenzione:
     * images/cards/<id>.jpg — basta aggiungere il file corrispondente
     * (es. images/cards/1.jpg per la carta con id 1 in cards-db.js)
     * perché venga usato automaticamente al posto del fallback CSS.
     * Per una carta non-Yu-Gi-Oh vale la stessa identica convenzione, ma
     * dentro NON_YGO_ART_DIR (vedi il commento qui sopra).
     *
     * Una carta CUSTOM (creata in crea-carta.html, vedi js/data/custom-cards.js)
     * non ha un vero file su disco — l'immagine caricata dall'utente è
     * incorporata direttamente nel suo record come data URI JPEG
     * (card.customImage), unico modo di "caricare un'immagine" possibile
     * in un progetto senza backend/server: se presente, ha SEMPRE priorità
     * sul percorso a file.
     */
    function getCardImagePath(card) {
        if (card.customImage) return card.customImage;
        if (card.origin && card.origin !== 'yu-gi-oh') return `${NON_YGO_ART_DIR}/${card.id}.jpg`;
        return `images/cards/${card.id}.jpg`;
    }

    // Sottotipi di Magia/Trappola che vale la pena segnalare a colpo
    // d'occhio sulla carta (Continua/Terreno/Veloce/Equipaggiamento): gli
    // altri sottotipi (Normale, Rituale, Contatore) restano con la sola
    // etichetta generica "[Magia]"/"[Trappola]" come sempre.
    // Qui c'è solo l'AGGETTIVO, non "Magia Continua" già scritto per
    // esteso: il nome che gli sta davanti dipende dalla provenienza della
    // carta (una carta 'ww1' dice "Manovra Continua", non "Magia
    // Continua") — vedi CARD_ORIGIN_TERMS in js/data/cards-db.js, e lì
    // anche il motivo per cui un termine nuovo va scelto femminile.
    const NOTABLE_SUBTYPE_SUFFIX = {
        spell: { continuous: 'Continua', field: 'Terreno', 'quick-play': 'Veloce', equip: 'Equipaggiamento' },
        trap: { continuous: 'Continua' }
    };

    /** I termini della provenienza della carta, con un fallback ai termini standard per le pagine che non caricano cards-db.js. */
    function termsOf(card) {
        if (typeof getCardTerms === 'function') return getCardTerms(card);
        return { monsterSingular: 'Mostro', spellSingular: 'Magia', trapSingular: 'Trappola' };
    }

    /**
     * Lo SCHIERAMENTO della carta, quando ne ha uno (campo `fazione`:
     * oggi solo il set WW1, 25 carte italiane e 25 austriache). È
     * un'informazione che cambia se una carta si può giocare o no — la
     * campagna della Grande Guerra accetta solo lo schieramento italiano,
     * vedi `carteAmmesse` in js/data/story-campaigns.js — quindi va letta
     * SULLA CARTA, non solo nel filtro della Cartoteca.
     *
     * Scritto qui in modo generico e non per il set WW1: una provenienza
     * futura che dichiari `fazione` la mostra senza toccare nulla. Nel
     * dato la fazione è minuscola ('italiana'), perché lì è una chiave;
     * qui diventa un'etichetta, e le etichette cominciano maiuscole.
     */
    function fazioneEtichetta(card) {
        const f = card && card.fazione;
        if (!f) return '';
        return String(f).charAt(0).toUpperCase() + String(f).slice(1);
    }

    function typeLineText(card) {
        const terms = termsOf(card);
        // Il separatore è un punto mediano e non una barra: la riga è già
        // dentro parentesi quadre, e una barra ci si legge come due campi
        // distinti invece che come due qualità della stessa carta.
        const fazione = fazioneEtichetta(card);
        const coda = fazione ? ` · ${fazione}` : '';
        if (card.type === 'monster') return `[${card.race || terms.monsterSingular}${coda}]`;
        if (card.type === 'spell' || card.type === 'trap') {
            const base = card.type === 'spell' ? terms.spellSingular : terms.trapSingular;
            const suffix = NOTABLE_SUBTYPE_SUFFIX[card.type][card.subtype];
            return suffix ? `[${base} ${suffix}${coda}]` : `[${base}${coda}]`;
        }
        return '';
    }

    /**
     * Il fallback CSS vero e proprio: replica il layout di una carta
     * Yu-Gi-Oh reale (barra nome+attributo, stelle Livello, finestra
     * immagine con placeholder, riga razza/tipo, riga ATK/DEF). Non
     * include la descrizione/effetto testuale della carta — a queste
     * dimensioni non ci sarebbe spazio per renderla leggibile, e quel
     * testo è comunque già visibile nel pannello info carta a schermo.
     */
    function buildFallbackFrameHTML(card) {
        const isMonster = card.type === 'monster';
        const topBadge = isMonster
            ? `<div class="card-frame-attr" data-attr="${card.attribute || ''}">${ATTRIBUTE_ICON[card.attribute] || '?'}</div>`
            : `<div class="card-frame-typebadge" data-ctype="${card.type}">${TYPE_ICON[card.type] || ''}</div>`;
        const stars = isMonster && card.level
            ? `<div class="card-frame-stars">${'⭐'.repeat(card.level)}</div>`
            : '';
        // ATK/DEF "effettivo": in duello, un bonus continuo (es. "+300 ATK
        // per ogni X sul Terreno") si riflette qui esattamente come nel
        // calcolo battaglia — vedi DuelEngine.getEffectiveAtk/getEffectiveDef
        // in js/engine/duel-engine.js. Fuori da un duello (Cartoteca/Creazione
        // Deck), o se il motore non è caricato, resta il valore base.
        const hasEffectiveStats = isMonster && window.DuelEngine && typeof DuelEngine.getEffectiveAtk === 'function';
        const effAtk = hasEffectiveStats ? DuelEngine.getEffectiveAtk(card) : card.attack;
        const effDef = hasEffectiveStats ? DuelEngine.getEffectiveDef(card) : card.defense;
        // Alcuni mostri hanno ATK/DEF variabili e nel database usano -1
        // come sentinella (es. Drago Megaroccia e Gradius' Option). Quel
        // valore non e' una statistica reale e non deve mai comparire sulla
        // carta: finche' l'effetto non determina il valore, Yu-Gi-Oh! lo
        // rappresenta come "?". Dopo la determinazione effAtk/effDef sono
        // numeri non negativi e vengono mostrati normalmente.
        const atkLabel = typeof effAtk === 'number' && effAtk < 0 ? '?' : effAtk;
        const defLabel = typeof effDef === 'number' && effDef < 0 ? '?' : effDef;
        const stats = isMonster
            ? `<div class="card-stats"><span>⚔️${atkLabel}</span><span>🛡️${defLabel}</span></div>`
            : '';
        return `
            <div class="card-frame">
                <div class="card-frame-top">
                    <div class="card-name"><span class="card-name-text">${card.name}</span></div>
                    ${topBadge}
                </div>
                ${stars}
                <div class="card-frame-art"><div class="card-frame-art-icon">${TYPE_ICON[card.type] || ''}</div></div>
                <div class="card-frame-typeline">${typeLineText(card)}</div>
                ${stats}
            </div>
        `;
    }

    /**
     * Comprime orizzontalmente (mai anche in altezza — romperebbe
     * l'allineamento con badge/stelle accanto) il nome della carta SOLO se
     * non ci sta su una riga sola alla larghezza disponibile — richiesta
     * esplicita dell'utente: "evitare di andare a capo con il titolo delle
     * carte... comprimere il font in larghezza se puoi". .card-name è
     * ormai `white-space: nowrap` (vedi js/ui/card.css): senza questa
     * funzione un nome lungo sforerebbe silenziosamente fuori dalla barra.
     *
     * Richiamata via requestAnimationFrame (mai in modo sincrono subito
     * dopo aver costruito l'HTML): l'elemento non è ancora stato inserito
     * nel documento dal chiamante a quel punto (createCardElement si limita
     * a COSTRUIRE il DOM, l'inserimento nel Terreno/mano/ovunque è sempre
     * un passo successivo del chiamante), quindi clientWidth/scrollWidth
     * sarebbero entrambi 0 se letti subito — un rAF successivo al giro di
     * script corrente è quasi sempre sufficiente perché il chiamante
     * inserisce l'elemento in modo sincrono, nello stesso tick.
     *
     * Uno scaleX (non un font-size più piccolo) resta valido anche se la
     * carta viene poi ingrandita altrove (es. carta cliccata a schermo
     * intero): il font usa già unità cqw legate al contenitore, quindi il
     * RAPPORTO tra larghezza del testo e larghezza disponibile resta
     * costante al variare della dimensione — nessun ricalcolo al resize
     * necessario.
     *
     * La transform va applicata a uno SPAN INTERNO (.card-name-text), mai
     * al contenitore (.card-name, che resta quello con `overflow: hidden`
     * per l'eventuale tetto di sicurezza) — bug reale trovato scrivendo
     * questa funzione: `transform` non cambia la larghezza di LAYOUT di un
     * elemento, solo il suo aspetto RESO in pittura, mentre il clipping di
     * `overflow: hidden` si basa sulla larghezza di layout (quella PRIMA
     * della transform) — scalando direttamente l'elemento con
     * `overflow: hidden` il testo restava tagliato esattamente come prima
     * (alla larghezza originale, MAI più larga), e la transform si
     * limitava a rimpicciolire quel risultato già tagliato. Lo span
     * interno non ha invece alcun `overflow`/larghezza propria (è
     * `display: inline-block`, si dimensiona sul proprio contenuto):
     * l'intero testo ci sta per intero, viene scalato COME UN BLOCCO, e
     * SOLO il contenitore esterno lo ritaglia se anche a scala minima
     * (0.55) non bastasse.
     */
    function compressCardNameIfNeeded(el) {
        const wrap = el.querySelector('.card-name');
        const textEl = el.querySelector('.card-name-text');
        if (!wrap || !textEl) return;
        textEl.style.transform = '';
        const available = wrap.clientWidth;
        const needed = textEl.scrollWidth;
        if (available > 0 && needed > available) {
            // Non sotto 0.55: oltre quella soglia il testo diventerebbe
            // illeggibile invece che solo "più stretto" — meglio un nome
            // compresso ma leggibile che uno del tutto illeggibile.
            const scale = Math.max(0.55, available / needed);
            textEl.style.transform = `scaleX(${scale})`;
        }
    }

    /**
     * Applica al div `el` il retro costruito interamente in CSS. Lo stesso
     * markup vale in mano, sul campo, nelle pile e nelle facce del flip 3D.
     */
    function applyCardBackVisual(el) {
        el.classList.add('face-down');
        el.innerHTML = '<div class="card-back-frame"><div class="card-back-emblem"></div></div>';
    }

    /**
     * Crea l'elemento DOM di una carta.
     * @param {object} card - la carta (da cards-db.js), o null per un retro "anonimo".
     * @param {boolean} isFaceDown - true per un mostro/carta coperta.
     * @param {'attack'|'defense'} position - orientamento (solo mostri).
     */
    function createCardElement(card, isFaceDown = false, position = 'attack') {
        const el = document.createElement('div');
        el.className = 'card';
        if (card) {
            el.dataset.uid = card.uid;
            el.dataset.type = card.type;
            // Rituale (blu) / Fusione (viola): categoria strutturale della
            // carta stessa (card.category, da js/data/cards-db.js), quindi
            // vale ovunque — Cartoteca, Creazione Deck, duello — non solo
            // dove è caricato il motore effetti. Vedi js/ui/card.css.
            if (card.type === 'monster' && card.category) {
                el.dataset.category = card.category;
            }
            // Un mostro NORMALE (Effect Monster nel vero gioco, cioè NON
            // "vanilla" — vedi il campo card.vanilla in js/data/cards-db.js)
            // prende una tinta leggermente più arancione, un vero Normal
            // Monster leggermente più gialla — vedi js/ui/card.css. Si basa
            // sull'identità REALE della carta (card.vanilla), non su se il
            // suo effetto è già stato programmato in questo motore, quindi
            // vale ovunque — Cartoteca, Creazione Deck, duello — non solo
            // dove è caricato il motore effetti. Rituale/Fusione hanno già
            // il proprio colore sopra e non partecipano a questa
            // distinzione.
            if (card.type === 'monster' && !card.category) {
                el.dataset.hasEffect = card.vanilla ? 'false' : 'true';
            }
        }
        if (position === 'defense') el.classList.add('defense-pos');

        if (isFaceDown || !card) {
            applyCardBackVisual(el);
            return el;
        }

        el.innerHTML = buildFallbackFrameHTML(card);
        requestAnimationFrame(() => compressCardNameIfNeeded(el));
        appendCopyLimitBadge(el, card);
        appendOwnedCountBadge(el, card);

        if (card.artOnly) {
            // Solo l'illustrazione (card.artOnly, vedi js/data/cards-db.js): va
            // DENTRO la finestra-immagine della cornice CSS, che resta
            // visibile intorno a lei — non sostituisce l'intera carta come
            // fa invece uno scan completo qui sotto.
            const artWindow = el.querySelector('.card-frame-art');
            const artIcon = el.querySelector('.card-frame-art-icon');
            const artImg = document.createElement('img');
            artImg.className = 'card-art-image';
            // alt="" (decorativa) — stesso motivo di applyCardBackVisual()
            // qui sopra: il nome è già leggibile in .card-name nella
            // cornice, l'alt non vuoto qui rischiava lo stesso flash di
            // testo durante il ri-render frequente del Terreno.
            artImg.alt = '';
            artImg.draggable = false;
            artImg.loading = 'lazy';
            // Dissolvenza (art-loaded aggiunge opacity:1 via CSS, vedi
            // js/ui/card.css) invece di far comparire/rimuovere l'icona
            // di riserva di scatto — stesso motivo del fade su .card-image
            // qui sotto: un pop istantaneo si nota molto di più quando le
            // immagini arrivano da un server in rete (es. l'app Android,
            // che punta a un server di sviluppo) invece che da file
            // locali. L'icona resta nel DOM finché la dissolvenza non è
            // finita (250ms) invece di sparire nello stesso istante in cui
            // l'immagine appare, altrimenti si vedrebbe comunque un buco.
            artImg.onload = () => {
                el.classList.add('art-loaded');
                if (artIcon) setTimeout(() => artIcon.remove(), 260);
            };
            artImg.onerror = () => artImg.remove();
            assegnaSorgenteImmagine(artImg, getCardImagePath(card));
            // Vedi il commento gemello in applyCardBackVisual() più sopra:
            // stesso sfarfallio, stessa causa (ricreazione totale ad ogni
            // renderFields()), stesso rimedio — se il browser ha già
            // l'illustrazione decodificata in cache, salta la dissolvenza
            // e rimuovi subito l'icona di riserva invece di farla
            // ricomparire per 260ms ad ogni cambio fase.
            if (artImg.complete && artImg.naturalWidth > 0) {
                el.classList.add('art-loaded');
                if (artIcon) artIcon.remove();
            }
            if (artWindow) artWindow.appendChild(artImg);
            return el;
        }

        // Prova a caricare l'immagine reale della carta (scan completo). Se
        // manca/non carica, l'<img> viene semplicemente rimossa e resta
        // visibile il fallback CSS costruito sopra.
        const img = document.createElement('img');
        img.className = 'card-image';
        img.alt = ''; // decorativa — stesso motivo di applyCardBackVisual() più sopra
        img.draggable = false;
        img.loading = 'lazy';
        img.onload = () => el.classList.add('has-image');
        img.onerror = () => img.remove();
        assegnaSorgenteImmagine(img, getCardImagePath(card));
        // Vedi il commento gemello in applyCardBackVisual() più sopra.
        if (img.complete && img.naturalWidth > 0) el.classList.add('has-image');
        el.insertBefore(img, el.firstChild);

        return el;
    }

    /**
     * Bollino "copie massime" in basso a sinistra, solo per le carte che
     * NON si possono mettere in 3 copie (Limitate/Bandite della lista
     * ufficiale, vedi getCardCopyLimit in js/data/cards-db.js).
     *
     * Viene aggiunto SEMPRE al markup ma è nascosto di default da
     * js/ui/card.css: lo mostrano solo le pagine dove serve davvero
     * (Cartoteca e Creazione Deck, che ne riattivano la visibilità nel
     * proprio <style>). Durante un duello sarebbe solo rumore — lì le
     * copie sono già state decise quando il mazzo è stato costruito.
     */
    function appendCopyLimitBadge(el, card) {
        if (!card || typeof getCardCopyLimit !== 'function') return;
        const limit = getCardCopyLimit(card);
        if (limit >= 3) return;
        const badge = document.createElement('div');
        badge.className = 'card-limit-badge';
        badge.dataset.limit = String(limit);
        badge.textContent = limit + '×';
        badge.title = limit === 1
            ? 'Limitata: massimo 1 copia per mazzo'
            : 'Semi-limitata: massimo 2 copie per mazzo';
        el.appendChild(badge);
    }

    /**
     * Bollino "copie possedute" in basso a DESTRA (gemello del limite a
     * sinistra) più, a 0 copie, la carta in bianco e nero: si vede a
     * colpo d'occhio cosa si può davvero mettere in un mazzo.
     *
     * Come il bollino del limite, è nascosto di default da js/ui/card.css
     * e lo mostrano solo Cartoteca e Creazione Deck. Durante un duello
     * non ha senso: le carte in campo sono già le tue.
     */
    function appendOwnedCountBadge(el, card) {
        if (!card || !window.SaveManager || typeof SaveManager.getOwnedCount !== 'function') return;
        // Un id negativo è un segnaposto, non una carta vera: lo usano
        // l'anteprima di crea-carta.html (id -1) e i Token generati in
        // duello. Dirne le "copie possedute" non avrebbe senso, e
        // sull'anteprima significherebbe mostrarla in bianco e nero
        // mentre la si sta disegnando.
        if (typeof card.id !== 'number' || card.id < 0) return;
        const owned = SaveManager.getOwnedCount(card.id);
        const badge = document.createElement('div');
        badge.className = 'card-owned-badge';
        badge.dataset.owned = owned > 0 ? 'yes' : 'no';
        badge.textContent = 'x' + owned;
        badge.title = owned > 0
            ? `Ne possiedi ${owned} ${owned === 1 ? 'copia' : 'copie'}`
            : 'Non possiedi questa carta: non puoi usarla nei mazzi';
        if (owned === 0) el.classList.add('card--not-owned');
        el.appendChild(badge);
    }

    /** Un retro-carta "anonimo" (nessuna carta reale dietro) — es. per una pila decorativa. */
    function renderCardBack() {
        const el = document.createElement('div');
        el.className = 'card';
        applyCardBackVisual(el);
        return el;
    }

    /** Aggiunge alla zona Deck tre dorsi CSS sovrapposti. */
    function appendDeckPile(slotEl, layers = 3) {
        for (let i = 0; i < layers; i++) {
            const back = renderCardBack();
            back.classList.add('deck-preview');
            slotEl.appendChild(back);
        }
    }

    /**
     * Anima la rivelazione di una carta coperta con un flip 3D (ruota
     * fisicamente da dorso a fronte, stile Master Duel) invece di farla
     * sparire e ricomparire scoperta al prossimo render. Costruisce due
     * facce complete (dorso + fronte, vedi createCardElement) dentro un
     * contenitore con prospettiva e sostituisce la .card coperta dentro
     * slotEl con questa struttura per la durata dell'animazione (~650ms,
     * vedi @keyframes cardFlipReveal in js/ui/card.css) — il prossimo
     * updateUI()/renderFields() la rimpiazzerà con la normale carta
     * scoperta a riposo.
     *
     * IMPORTANTE: va chiamata PRIMA di un eventuale updateUI()/renderFields()
     * successivo alla rivelazione, quando lo slot mostra ancora la carta
     * coperta — dopo quel ricalcolo lo slot conterrebbe già la carta
     * scoperta "a riposo" e non ci sarebbe più nulla da animare (stesso
     * principio del timing dell'esplosione di distruzione in
     * resolveBattleDamage/actions.js).
     *
     * @param {HTMLElement} slotEl - il .field-slot che contiene la carta coperta.
     * @param {object} card - la carta reale che si sta rivelando.
     * @param {'attack'|'defense'} position - la sua posizione sul Terreno.
     */
    function playFlipReveal(slotEl, card, position) {
        if (!slotEl || !card) return;
        const oldEl = slotEl.querySelector('.card');
        if (!oldEl) return;

        const outer = document.createElement('div');
        outer.className = 'card card-flip-outer';

        const inner = document.createElement('div');
        inner.className = 'card-flip-inner';

        const backFace = createCardElement(card, true, position);
        backFace.classList.add('card-flip-face', 'card-flip-face-back');

        const frontFace = createCardElement(card, false, position);
        frontFace.classList.add('card-flip-face', 'card-flip-face-front');

        inner.appendChild(backFace);
        inner.appendChild(frontFace);
        outer.appendChild(inner);

        oldEl.replaceWith(outer);
        // Finito il giro, la casella deve tornare una carta NORMALE. Il Flip
        // Summon (changeMonsterPosition, evocazioni.js) chiama questa
        // funzione DOPO l'ultimo ridisegno del Terreno, quindi nessuno
        // sostituiva più la struttura del giro: restava lì fino al ridisegno
        // successivo, e il passaggio del mouse (che solleva la carta con
        // un'ombra-filtro, e un filtro appiattisce il 3D) faceva sparire
        // entrambe le facce. Ridisegnando il Terreno la casella torna quella
        // di sempre: riconciliaBoard (game-flow.js) vede che il suo HTML è
        // cambiato e la sostituisce.
        let concluso = false;
        const concludeFlip = () => {
            if (concluso) return;
            concluso = true;
            if (!outer.isConnected) return;
            // La firma appartiene alla casella, non al suo contenuto. Dopo
            // replaceWith() sarebbe ancora uguale a quella del nuovo render
            // e riconciliaBoard conserverebbe per errore il markup del giro.
            delete slotEl.__renderSignature;
            if (typeof renderFields === 'function') renderFields();
        };
        inner.addEventListener('animationend', (event) => {
            if (event.target === inner && event.animationName === 'cardFlipReveal') concludeFlip();
        });
        // animationend non è garantito (scheda sospesa, animazioni disattivate
        // o nodo momentaneamente non renderizzato): il fallback impedisce che
        // la carta resti per sempre nella struttura 3D intermedia.
        setTimeout(concludeFlip, 850);
        // L'ologramma del mostro (js/ui/monster-hologram.js) era già nato col
        // ridisegno appena prima del giro, sopra una carta ancora di dorso:
        // riallinearlo adesso gli fa vedere il giro in corso, lo toglie e lo
        // rimette quando la carta ha finito di scoprirsi.
        if (window.MonsterHolograms && typeof MonsterHolograms.sync === 'function') MonsterHolograms.sync();
    }

    // ------------------------------------------------------------------
    // CARTA VIVA: si inclina seguendo il mouse o il telefono, e la luce ci
    // scorre sopra con un riflesso che dice la RARITÀ a colpo d'occhio.
    // ------------------------------------------------------------------
    // Fuori dal duello, e solo dove una pagina lo chiede (CartaViva.rendi):
    // la scheda di una carta, la Cartoteca, il Negozio, le buste, la carta
    // in premio. Nel duello no: il Terreno si ridisegna di continuo e le
    // carte lì devono restare leggibili, non brillare.
    //
    // Tre modi, perché "inclinarsi" vuol dire cose diverse a seconda di
    // quanto è grande la carta e di cosa le sta attorno:
    //   'griglia'  una carta fra tante (Cartoteca): si inclina e si solleva
    //              sotto il mouse, ferma al tocco (il dito lì scorre);
    //   'fila'     come sopra ma senza sollevarsi (Negozio, buste: hanno
    //              già un loro modo di presentare la carta);
    //   'grande'   la carta protagonista (scheda, premio): segue il mouse
    //              su tutta la sua area e, sul telefono, il GIROSCOPIO
    //              (js/ui/inclinazione.js); se nessuno dei due arriva,
    //              ondeggia piano da sola.
    //
    // I riflessi per rarità (js/ui/card.css, "Carta viva"):
    //   comune          solo la luce che passa, nessun lucido;
    //   rara            un filo lucido sul bordo;
    //   super / ultra   più un arcobaleno sull'illustrazione (ultra più
    //                   acceso); leggendaria lo fa dorato;
    //   segreta         più una grana scintillante attorno alla luce;
    //   mitica          (le Divinità) tutto quanto, sull'intera carta.
    const RARITA_ARCOBALENO = new Set(['super', 'ultra', 'legendary', 'secret', 'mythic']);
    const RARITA_GRANA = new Set(['secret', 'mythic']);
    /** Inclinazione massima per modo: più grande la carta, più si può osare. */
    const GRADI_MASSIMI = { griglia: 10, fila: 9, grande: 14 };

    function strato(classe) {
        const s = document.createElement('span');
        s.className = classe;
        s.setAttribute('aria-hidden', 'true');
        return s;
    }

    /**
     * Rende "viva" una carta già costruita da createCardElement.
     * opzioni: { modo, bersaglio, area }
     *   bersaglio: l'elemento che si inclina (default la carta stessa). La
     *              carta in premio inclina il suo palco, perché la carta lì
     *              sta dentro una faccia che si gira e ritaglia i bordi;
     *   area:      dove il mouse viene ascoltato (default il bersaglio): la
     *              scheda ascolta tutta l'anteprima, non solo la carta.
     * Una carta coperta resta com'è: il dorso non ha rarità da mostrare.
     */
    function rendiCartaViva(el, card, opzioni) {
        if (!el || !card || el.classList.contains('face-down') || el.classList.contains('carta-viva')) return el;
        const o = opzioni || {};
        const modo = GRADI_MASSIMI[o.modo] ? o.modo : 'griglia';
        const bersaglio = o.bersaglio || el;
        const area = o.area || bersaglio;
        const rarita = (window.CardRarity && typeof CardRarity.of === 'function' && card.id != null)
            ? (CardRarity.of(card.id) || 'common') : 'common';

        el.classList.add('carta-viva');
        el.dataset.rarita = rarita;
        bersaglio.classList.add('cv-inclina');
        bersaglio.dataset.viva = modo;
        // Lucido, laminato e grana vanno SOPRA L'ILLUSTRAZIONE (la finestra .card-frame-art), non su tutta la
        // carta: nome, stelle e ATK/DEF restano nitidi. Solo uno scan a carta intera, che non ha la finestra,
        // li porta sull'intera carta.
        const finestra = !el.querySelector('.card-image') && el.querySelector('.card-frame-art');
        const dove = finestra || el;
        dove.appendChild(strato('cv-riflesso'));
        if (RARITA_ARCOBALENO.has(rarita)) dove.appendChild(strato(finestra ? 'cv-olo' : 'cv-olo cv-olo--intera'));
        if (RARITA_GRANA.has(rarita)) dove.appendChild(strato('cv-grana'));
        const ridotto = window.Inclinazione
            ? Inclinazione.movimentoRidotto()
            : (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (ridotto) {
            // Niente movimento, ma il lucido resta visibile: è un'informazione
            // (la rarità), non solo una decorazione.
            bersaglio.classList.add('cv-ferma');
            return el;
        }

        const gradi = GRADI_MASSIMI[modo];
        const stile = bersaglio.style;
        let fotogrammaPuntatore = null;
        let ultimaInclinazione = null;
        function imposta(x, y) {
            stile.setProperty('--inc-x', (-y * gradi).toFixed(2) + 'deg');
            stile.setProperty('--inc-y', (x * gradi).toFixed(2) + 'deg');
            if (modo === 'grande') {
                // Sulla singola carta protagonista la luce segue davvero il
                // puntatore. Nelle griglie da centinaia di carte, invece,
                // cambiare posizione a gradienti, maschere e blend mode a
                // ogni frame obbligava il browser a ridipingere la texture
                // laminata mentre la carta si muoveva. Lì teniamo il foil
                // pienamente visibile ma stabile: il finto 3D continua a
                // seguire il mouse tramite il solo transform, compositabile
                // dalla GPU senza perdere frame.
                stile.setProperty('--luce-x', (50 + x * 50).toFixed(1) + '%');
                stile.setProperty('--luce-y', (50 + y * 50).toFixed(1) + '%');
                stile.setProperty('--forza', Math.min(1, Math.hypot(x, y)).toFixed(3));
            }
        }
        function riposa() {
            bersaglio.classList.remove('cv-attiva');
            ['--inc-x', '--inc-y', '--luce-x', '--luce-y', '--forza'].forEach((v) => stile.removeProperty(v));
            if (modo === 'grande') bersaglio.classList.add('cv-ozio');
        }

        // Il riquadro si misura all'ingresso e non a ogni movimento: la
        // carta inclinata cambia il proprio riquadro, e rimisurarlo mentre
        // si inclina la farebbe tremare.
        let riquadro = null;
        let puntatoreDentro = false;
        area.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch') return;
            riquadro = area.getBoundingClientRect();
            puntatoreDentro = true;
            if (modo !== 'grande') {
                stile.setProperty('--luce-x', '38%');
                stile.setProperty('--luce-y', '30%');
                stile.setProperty('--forza', '0.72');
            }
        });
        area.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            if (!riquadro) riquadro = area.getBoundingClientRect();
            puntatoreDentro = true;
            const x = ((e.clientX - riquadro.left) / (riquadro.width || 1)) * 2 - 1;
            const y = ((e.clientY - riquadro.top) / (riquadro.height || 1)) * 2 - 1;
            bersaglio.classList.remove('cv-ozio');
            bersaglio.classList.add('cv-attiva');
            ultimaInclinazione = {
                x: Math.max(-1, Math.min(1, x)),
                y: Math.max(-1, Math.min(1, y))
            };
            // Alcuni mouse e touchpad inviano molti più eventi dei frame
            // che lo schermo può mostrare. Scrivere cinque proprietà CSS a
            // ogni evento costringeva glitter e laminatura a ridisegnarsi
            // inutilmente più volte nello stesso frame.
            if (fotogrammaPuntatore === null) {
                fotogrammaPuntatore = requestAnimationFrame(() => {
                    fotogrammaPuntatore = null;
                    if (ultimaInclinazione && puntatoreDentro) {
                        imposta(ultimaInclinazione.x, ultimaInclinazione.y);
                    }
                });
            }
        });
        area.addEventListener('pointerleave', () => {
            riquadro = null;
            puntatoreDentro = false;
            ultimaInclinazione = null;
            riposa();
        });

        if (modo === 'grande') {
            bersaglio.classList.add('cv-ozio');
            let visibile = true;
            let osservatore = null;
            // La scheda carta resta nel DOM quando viene chiusa. Senza
            // questo osservatore continuava ad animare gradienti dietro a
            // `display:none`, consumando frame pur senza mostrare nulla.
            if (typeof IntersectionObserver === 'function') {
                osservatore = new IntersectionObserver((voci) => {
                    if (!el.isConnected) { osservatore.disconnect(); return; }
                    visibile = !!(voci[0] && voci[0].isIntersecting);
                    bersaglio.classList.toggle('cv-sospesa', !visibile);
                });
                osservatore.observe(el);
            }
            // "Giroscopio sulle carte" SPENTO nelle Impostazioni: il telefono
            // non guida più la luce, che invece si muove piano da sola (solo
            // la luce, mai la carta: vedi `.cv-luce-viva` in card.css, attivo
            // solo con puntatore a tocco). Acceso (default) vale il sensore.
            const giroscopioSpento = !!(window.Inclinazione && Inclinazione.giroscopioCarteAttivo
                && !Inclinazione.giroscopioCarteAttivo());
            if (giroscopioSpento) bersaglio.classList.add('cv-luce-viva');
            if (window.Inclinazione && !giroscopioSpento) {
                // Si smette di ascoltare da soli quando la carta non è più
                // nella pagina (scheda chiusa, premio passato): nessuno deve
                // ricordarsi di farlo.
                const smetti = Inclinazione.ascolta((l) => {
                    if (!el.isConnected) {
                        smetti();
                        if (osservatore) osservatore.disconnect();
                        return;
                    }
                    if (!visibile || l.fonte !== 'sensore' || puntatoreDentro) return;
                    bersaglio.classList.remove('cv-ozio');
                    bersaglio.classList.add('cv-attiva');
                    imposta(l.x, l.y);
                });
            }
        }
        return el;
    }

    window.CartaViva = { rendi: rendiCartaViva };

    window.CardRenderer = {
        TYPE_ICON,
        ATTRIBUTE_ICON,
        getCardImagePath,
        createCardElement,
        renderCardBack,
        appendDeckPile,
        playFlipReveal,
        rendiCartaViva,
        iniziaImmaginiDifferite,
        terminaImmaginiDifferite,
        caricaImmaginiDifferite
    };
    // Alias globali: così le pagine/i file esistenti che già chiamano
    // createCardElement(...)/getCardImagePath(...) senza prefisso
    // continuano a funzionare senza modifiche.
    window.createCardElement = createCardElement;
    window.getCardImagePath = getCardImagePath;
})();
