// @ts-check
/**
 * cartoteca-view.js — LA Cartoteca (filtri, ordinamento, griglia a blocchi, paginazione, scheda carta).
 * ----------------------------------------------------------------------------------------------
 * Prima esisteva in DUE copie quasi identiche (l'85% delle righe): la pagina autonoma cartoteca.html e la vista dentro
 * il menu (index.html), che e' quella che si usa davvero. Ogni miglioria andava fatta due volte e si dimenticava: le
 * miniature, lo skeleton e la costruzione a blocchi erano arrivati prima in una sola. Ora c'e' UN solo modulo, usato da
 * entrambe, con lo stesso schema di SfideView / ShopUI (mount nel contenitore dell'host).
 *
 *   CartotecaView.mount(contenitore, { onConteggio: (testo) => ... })   ->  { refresh() }
 *
 * - `contenitore`: un elemento vuoto; il modulo ci costruisce dentro filtri e griglia e gli mette la classe
 *   `cartoteca-view` (lo stile sta in js/ui/cartoteca-view.css, tutto dentro @scope).
 * - `onConteggio`: l'host mostra il badge "N carte" nella propria topbar; il modulo gli passa il testo ad ogni render.
 * - Gli elementi interni si trovano con `data-ct`, MAI con gli id: in una pagina con piu' viste gli id si scontrano
 *   (era il motivo dei prefissi "cartoteca-" nella vista del menu).
 * Serve: cards-db.js (cardDatabase e le etichette dei filtri), card-renderer.js (createCardElement), card-detail.js,
 * e l'elenco generato js/data/card-effect-ids.generated.js per il filtro "Categoria Mostro" (niente motore del duello).
 */
(function () {
    'use strict';

    // Le carte "vuote" mostrate subito, mentre il database si legge e la griglia si costruisce.
    const SCHELETRO = '<div class="card card-skeleton" aria-hidden="true"></div>'.repeat(24);

    const MARKUP = `
    <div class="cartoteca-filters">
        <div class="filter-bar-top">
            <div class="filter-search">
                <span class="filter-search-icon">🔍</span>
                <input type="text" data-ct="searchInput" placeholder="Cerca una carta per nome..." autocomplete="off">
            </div>
            <select class="filter-sort" data-ct="sortSelect">
                <option value="default">Catalogo originale</option>
                <option value="name-asc">Nome (A→Z)</option>
                <option value="name-desc">Nome (Z→A)</option>
                <option value="atk-desc">ATK (alto→basso)</option>
                <option value="atk-asc">ATK (basso→alto)</option>
                <option value="def-desc">DEF (alto→basso)</option>
                <option value="def-asc">DEF (basso→alto)</option>
                <option value="level-desc">Livello (alto→basso)</option>
                <option value="level-asc">Livello (basso→alto)</option>
            </select>
            <button type="button" class="filter-toggle-btn" data-ct="filterToggleBtn">
                <span>🔧 Filtri</span>
                <span class="filter-toggle-badge" data-ct="filterToggleBadge"></span>
                <span class="filter-toggle-arrow">▾</span>
            </button>
        </div>
    
        <div class="filter-panel" data-ct="filterPanel">
            <div class="filter-row">
                <div class="filter-group">
                    <span class="filter-group-label">Tipo Carta</span>
                    <div class="filter-chips" data-ct="typeChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Livello</span>
                    <div class="filter-chips" data-ct="levelChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Categoria Mostro</span>
                    <div class="filter-chips" data-ct="categoryChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Tipo Mostro</span>
                    <div class="filter-chips" data-ct="raceChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Attributo</span>
                    <div class="filter-chips" data-ct="attributeChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Sottotipo Magia</span>
                    <div class="filter-chips" data-ct="spellSubtypeChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Sottotipo Trappola</span>
                    <div class="filter-chips" data-ct="trapSubtypeChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">Provenienza</span>
                    <div class="filter-chips" data-ct="originChips"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">ATK</span>
                    <div class="filter-range">
                        <input type="number" data-ct="atkMin" placeholder="Min" min="0">
                        <span>—</span>
                        <input type="number" data-ct="atkMax" placeholder="Max" min="0">
                    </div>
                </div>
                <div class="filter-group">
                    <span class="filter-group-label">DEF</span>
                    <div class="filter-range">
                        <input type="number" data-ct="defMin" placeholder="Min" min="0">
                        <span>—</span>
                        <input type="number" data-ct="defMax" placeholder="Max" min="0">
                    </div>
                </div>
                <button class="filter-reset" data-ct="resetBtn">✖ Azzera filtri</button>
            </div>
        </div>
    </div>
    
    <main class="cartoteca-main">
        <div class="cartoteca-pager top" data-ct="pagerTop" hidden></div>
        <div class="cartoteca-grid" data-ct="cartotecaGrid">${SCHELETRO}</div>
        <div class="cartoteca-pager bottom" data-ct="pagerBottom" hidden></div>
    </main>
    `;

    const nameCollator = new Intl.Collator('it');
    /** Ordina una lista di carte già filtrata secondo state.sort, senza toccare l'originale. */
    function sortCards(cards, sortKey) {
        const sorted = [...cards];
        const byName = (a, b) => nameCollator.compare(a.name, b.name);
        const numKey = (card, field) => (typeof card[field] === 'number' ? card[field] : -1);
        const byCatalog = (a, b) => {
            const gruppoA = a.origin === 'ww1' ? 1 : 0;
            const gruppoB = b.origin === 'ww1' ? 1 : 0;
            return gruppoA - gruppoB || numKey(a, 'id') - numKey(b, 'id') || byName(a, b);
        };
        if (!sortKey || sortKey === 'default') return sorted.sort(byCatalog);
        const cmp = {
            'name-asc': byName,
            'name-desc': (a, b) => byName(b, a),
            'atk-desc': (a, b) => numKey(b, 'attack') - numKey(a, 'attack') || byName(a, b),
            'atk-asc': (a, b) => numKey(a, 'attack') - numKey(b, 'attack') || byName(a, b),
            'def-desc': (a, b) => numKey(b, 'defense') - numKey(a, 'defense') || byName(a, b),
            'def-asc': (a, b) => numKey(a, 'defense') - numKey(b, 'defense') || byName(a, b),
            'level-desc': (a, b) => numKey(b, 'level') - numKey(a, 'level') || byName(a, b),
            'level-asc': (a, b) => numKey(a, 'level') - numKey(b, 'level') || byName(a, b)
        }[sortKey];
        if (cmp) sorted.sort(cmp);
        return sorted;
    }

    function mount(contenitore, opzioni) {
        opzioni = opzioni || {};
        contenitore.classList.add('cartoteca-view');
        contenitore.innerHTML = MARKUP;
        const root = contenitore;
        /** Un elemento interno, per nome (attributo data-ct). */
        const q = (nome) => /** @type {any} */ (root.querySelector('[data-ct="' + nome + '"]'));

        const state = {
            text: '',
            types: new Set(),
            levels: new Set(),
            categories: new Set(),
            races: new Set(),
            attributes: new Set(),
            spellSubtypes: new Set(),
            trapSubtypes: new Set(),
            origins: new Set(),
            atkMin: null,
            atkMax: null,
            defMin: null,
            defMax: null,
            sort: 'default',
            page: 1
        };

        // Paginazione lato client (richiesta esplicita dell'utente): con oltre
        // 1000 carte nel database, creare TUTTE le tile in un colpo solo rende
        // pesante ogni singolo cambio di filtro, perché renderGrid() ricostruisce
        // la griglia da zero ogni volta.
        const CARDS_PER_PAGE = 300;   // richiesta esplicita dell'utente: resta 300 anche su telefono (si costruiscono a blocchi, vedi renderGrid)

        const TYPE_LABELS = { monster: 'Mostro', spell: 'Magia', trap: 'Trappola' };
        const TYPE_ICON = { monster: '👑', spell: '✨', trap: '🌀' };

        function normalize(str) {
            return (str || '').toString().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        function uniqueSorted(arr) {
            return [...new Set(arr)].sort((a, b) => a - b);
        }

        function buildChipGroup(container, values, formatLabel, stateSet, extraClassFn) {
            container.innerHTML = '';
            values.forEach((val) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chip' + (extraClassFn ? ' ' + extraClassFn(val) : '');
                chip.textContent = formatLabel(val);
                chip.dataset.value = val;
                chip.onclick = () => {
                    if (stateSet.has(val)) {
                        stateSet.delete(val);
                        chip.classList.remove('active');
                    } else {
                        stateSet.add(val);
                        chip.classList.add('active');
                    }
                    renderGrid();
                };
                container.appendChild(chip);
            });
        }

        function initFilters() {
            // Tipo carta
            buildChipGroup(
                q('typeChips'),
                ['monster', 'spell', 'trap'],
                (v) => TYPE_ICON[v] + ' ' + TYPE_LABELS[v],
                state.types
            );

            // Livello (solo mostri)
            const levels = uniqueSorted(cardDatabase.filter(c => c.type === 'monster').map(c => c.level));
            buildChipGroup(
                q('levelChips'),
                levels,
                (v) => `⭐ ${v}`,
                state.levels
            );

            // Categoria mostro (normale / con effetto / fusione / rituale)
            buildChipGroup(
                q('categoryChips'),
                ['normal', 'effect', 'fusion', 'ritual'],
                (v) => MONSTER_CATEGORY_LABELS[v],
                state.categories
            );

            // Tipo mostro (razza) — base FISSA (getAllKnownRaces, in
            // cards-db.js: i Tipi ufficiali del gioco PIÙ quelli di serie
            // delle provenienze distribuite col gioco, es. Fanteria/Alpini/
            // Aviazione del set WW1, mostrati anche se ancora senza carte)
            // UNITA a qualunque Tipo Mostro CUSTOM realmente usato da una
            // carta caricata (crea-carta.html permette di crearne di nuovi
            // per provenienze diverse da Yu-Gi-Oh!) — stesso spirito del
            // filtro Attributo qui sotto, che deriva le proprie opzioni da
            // cardDatabase.
            const knownRaces = (typeof getAllKnownRaces === 'function') ? getAllKnownRaces() : MONSTER_RACES;
            const customRaces = [...new Set(cardDatabase.map((c) => c.race).filter((r) => r && !knownRaces.includes(r)))];
            buildChipGroup(
                q('raceChips'),
                knownRaces.concat(customRaces),
                (v) => v,
                state.races
            );

            // Attributo
            const attributes = [...new Set(cardDatabase.filter(c => c.attribute).map(c => c.attribute))];
            const attrOrder = ['LUCE', 'OSCURITÀ', 'TERRA', 'ACQUA', 'FUOCO', 'VENTO', 'DIVINO'];
            attributes.sort((a, b) => attrOrder.indexOf(a) - attrOrder.indexOf(b));
            buildChipGroup(
                q('attributeChips'),
                attributes,
                (v) => v,
                state.attributes,
                (v) => 'attr-' + normalize(v)
            );

            // Sottotipo Magia (Normale/Continua/Veloce/Rituale/Campo/Equip) — elenco
            // fisso da SPELL_SUBTYPE_LABELS, stesso spirito di MONSTER_RACES sopra.
            buildChipGroup(
                q('spellSubtypeChips'),
                Object.keys(SPELL_SUBTYPE_LABELS),
                (v) => SPELL_SUBTYPE_LABELS[v],
                state.spellSubtypes
            );

            // Sottotipo Trappola (Normale/Continua/Contatore)
            buildChipGroup(
                q('trapSubtypeChips'),
                Object.keys(TRAP_SUBTYPE_LABELS),
                (v) => TRAP_SUBTYPE_LABELS[v],
                state.trapSubtypes
            );

            // Provenienza — base FISSA da CARD_ORIGIN_LABELS (in cards-db.js,
            // mostra sempre Yu-Gi-Oh!/Fanmade/WW1/WW2 anche senza ancora
            // nessuna carta) UNITA a qualunque provenienza CUSTOM realmente
            // usata da una carta caricata — stesso spirito del Tipo Mostro
            // qui sopra.
            const customOrigins = [...new Set(cardDatabase.map((c) => c.origin).filter((o) => o && !CARD_ORIGIN_LABELS[o]))];
            // Un'origine custom mostra la propria etichetta leggibile (quella
            // scelta in crea-carta.html, es. "Prima Guerra Mondiale") invece
            // della sola key interna (es. "prima-guerra-mondiale") — recuperata
            // da CustomTaxonomy, che la ricorda per intero, non solo la key.
            const customOriginLabels = {};
            CustomTaxonomy.listOrigins().forEach((o) => { customOriginLabels[o.key] = o.label; });
            buildChipGroup(
                q('originChips'),
                Object.keys(CARD_ORIGIN_LABELS).concat(customOrigins),
                (v) => CARD_ORIGIN_LABELS[v] || customOriginLabels[v] || v,
                state.origins
            );

            // Debounce (250ms): con oltre 900 carte nel database, renderGrid()
            // ricostruisce l'intera griglia da zero ad ogni chiamata (innerHTML
            // svuotato + una createCardElement per ogni carta ancora
            // corrispondente ai filtri) — senza debounce, digitare una parola
            // di 6 lettere significava 6 ricostruzioni complete della griglia,
            // una per tasto premuto, invece di una sola a digitazione ferma.
            let searchDebounceTimer = null;
            q('searchInput').addEventListener('input', (e) => {
                const value = e.target.value;
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    state.text = normalize(value);
                    renderGrid();
                }, 250);
            });
            ['atkMin', 'atkMax', 'defMin', 'defMax'].forEach((id) => {
                q(id).addEventListener('input', (e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    state[id] = val;
                    renderGrid();
                });
            });

            q('sortSelect').addEventListener('change', (e) => {
                state.sort = e.target.value;
                renderGrid();
            });

            // Pannello filtri: chiuso di default ("meno invasivo" di prima, quando
            // erano sempre tutti aperti) — un tocco/click sul pulsante lo apre o
            // chiude, con un badge che segna quanti filtri sono già attivi anche
            // a pannello chiuso.
            const filterToggleBtn = q('filterToggleBtn');
            const filterPanel = q('filterPanel');
            filterToggleBtn.onclick = () => {
                const isOpen = filterPanel.classList.toggle('open');
                filterToggleBtn.classList.toggle('open', isOpen);
            };

            q('resetBtn').onclick = () => {
                state.text = '';
                state.types.clear();
                state.levels.clear();
                state.categories.clear();
                state.races.clear();
                state.attributes.clear();
                state.spellSubtypes.clear();
                state.trapSubtypes.clear();
                state.origins.clear();
                state.atkMin = null;
                state.atkMax = null;
                state.defMin = null;
                state.defMax = null;
                q('searchInput').value = '';
                ['atkMin', 'atkMax', 'defMin', 'defMax'].forEach(id => q(id).value = '');
                root.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
                renderGrid();
            };
        }

        function cardMatchesFilters(card) {
            if (state.text) {
                const haystack = normalize(card.name) + ' ' + normalize(card.effect || '');
                if (!haystack.includes(state.text)) return false;
            }
            if (state.types.size > 0 && !state.types.has(card.type)) return false;
            if (state.levels.size > 0 && !(card.type === 'monster' && state.levels.has(card.level))) return false;
            if (state.categories.size > 0 && !(card.type === 'monster' && state.categories.has(getMonsterFilterCategory(card)))) return false;
            if (state.races.size > 0 && !(card.race && state.races.has(card.race))) return false;
            if (state.attributes.size > 0 && !(card.attribute && state.attributes.has(card.attribute))) return false;
            if (state.spellSubtypes.size > 0 && !(card.type === 'spell' && state.spellSubtypes.has(card.subtype))) return false;
            if (state.trapSubtypes.size > 0 && !(card.type === 'trap' && state.trapSubtypes.has(card.subtype))) return false;
            if (state.origins.size > 0 && !(card.origin && state.origins.has(card.origin))) return false;
            if (state.atkMin !== null && !(card.type === 'monster' && card.attack >= state.atkMin)) return false;
            if (state.atkMax !== null && !(card.type === 'monster' && card.attack <= state.atkMax)) return false;
            if (state.defMin !== null && !(card.type === 'monster' && card.defense >= state.defMin)) return false;
            if (state.defMax !== null && !(card.type === 'monster' && card.defense <= state.defMax)) return false;
            return true;
        }


        /** Numero di filtri attivi in questo momento, per il badge sul pulsante "Filtri". */
        function countActiveFilters() {
            return state.types.size + state.levels.size + state.categories.size + state.races.size +
                state.attributes.size + state.spellSubtypes.size + state.trapSubtypes.size + state.origins.size +
                (state.atkMin !== null ? 1 : 0) + (state.atkMax !== null ? 1 : 0) +
                (state.defMin !== null ? 1 : 0) + (state.defMax !== null ? 1 : 0);
        }

        function updateFilterToggleBadge() {
            const count = countActiveFilters();
            const badge = q('filterToggleBadge');
            const btn = q('filterToggleBtn');
            badge.textContent = count;
            badge.classList.toggle('show', count > 0);
            btn.classList.toggle('has-active', count > 0);
        }

        function createCardTile(card) {
            const el = createCardElement(card, false, 'attack', { miniatura: true });
            el.onclick = () => openCardModal(card);
            // Riflesso per rarità e inclinazione sotto il mouse (js/ui/card-renderer.js).
            if (window.CartaViva) CartaViva.rendi(el, card, { modo: 'griglia' });
            if (card.missingEffectNote) {
                const badge = document.createElement('div');
                badge.className = 'partial-badge';
                badge.textContent = '🟡';
                badge.title = 'Effetto implementato parzialmente: ' + card.missingEffectNote;
                el.appendChild(badge);
            }
            return el;
        }

        /**
         * Disegna una delle due barre di paginazione. `totalPages` a 1 (o 0
         * risultati) la nasconde del tutto: senza abbastanza carte da
         * impaginare, una barra con tutti i pulsanti spenti sarebbe solo
         * rumore.
         */
        function renderPager(el, totalPages, total, firstIndex, shown) {
            if (totalPages <= 1) { el.hidden = true; el.innerHTML = ''; return; }
            el.hidden = false;
            // Etichette in uno <span> separato dalla freccia: su mobile viene
            // nascosto solo il testo (vedi il @media più sotto), lasciando
            // pulsanti quadrati grandi abbastanza per il dito invece di
            // quattro pillole lunghe che andrebbero a capo.
            el.innerHTML = `
                <button type="button" class="pager-btn" data-page="first" ${state.page === 1 ? 'disabled' : ''}><span class="pager-ico">«</span><span class="pager-lbl">Prima</span></button>
                <button type="button" class="pager-btn" data-page="prev" ${state.page === 1 ? 'disabled' : ''}><span class="pager-ico">‹</span><span class="pager-lbl">Precedente</span></button>
                <div class="pager-status">
                    Pagina ${state.page} di ${totalPages}
                    <span class="range">carte ${firstIndex + 1}-${firstIndex + shown} di ${total}</span>
                </div>
                <button type="button" class="pager-btn" data-page="next" ${state.page === totalPages ? 'disabled' : ''}><span class="pager-lbl">Successiva</span><span class="pager-ico">›</span></button>
                <button type="button" class="pager-btn" data-page="last" ${state.page === totalPages ? 'disabled' : ''}><span class="pager-lbl">Ultima</span><span class="pager-ico">»</span></button>
            `;
            el.querySelectorAll('.pager-btn').forEach((btn) => {
                btn.onclick = () => {
                    const to = btn.dataset.page;
                    if (to === 'first') state.page = 1;
                    else if (to === 'prev') state.page = Math.max(1, state.page - 1);
                    else if (to === 'next') state.page = Math.min(totalPages, state.page + 1);
                    else if (to === 'last') state.page = totalPages;
                    // true = NON tornare a pagina 1: è proprio un cambio pagina
                    // voluto, a differenza di ogni altro chiamante (i filtri).
                    renderGrid(true);
                    root.querySelector('.cartoteca-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
            });
        }

        /**
         * `keepPage` true SOLO dai pulsanti di paginazione: ogni altra
         * chiamata (filtri, ricerca, ordinamento, azzera) riporta a pagina 1,
         * che è il comportamento giusto — restare a "pagina 7" dopo aver
         * ristretto i risultati a 30 carte mostrerebbe una griglia vuota.
         */
        let renderGettone = 0;
        function renderGrid(keepPage) {
            const grid = q('cartotecaGrid');
            const results = sortCards(cardDatabase.filter(cardMatchesFilters), state.sort);
            updateFilterToggleBadge();
            if (!keepPage) state.page = 1;
            const totalPages = Math.max(1, Math.ceil(results.length / CARDS_PER_PAGE));
            if (state.page > totalPages) state.page = totalPages;
            const firstIndex = (state.page - 1) * CARDS_PER_PAGE;
            const pageCards = results.slice(firstIndex, firstIndex + CARDS_PER_PAGE);

            renderGettone++;   // interrompe una costruzione a blocchi ancora in corso
            grid.innerHTML = '';
            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'cartoteca-empty';
                empty.textContent = '🔍 Nessuna carta corrisponde ai filtri selezionati.';
                grid.appendChild(empty);
            } else {
                // A blocchi, un fotogramma l'uno dall'altro: le prime carte compaiono subito e il resto si costruisce
                // senza bloccare il telefono (un cambio filtro/pagina interrompe la costruzione precedente).
                const gettone = ++renderGettone;
                const PRIMO = 18; const BLOCCO = 24; let i = 0;
                const blocco = () => {
                    if (gettone !== renderGettone) return;
                    const fine = Math.min(i + (i === 0 ? PRIMO : BLOCCO), pageCards.length);
                    const frag = document.createDocumentFragment();
                    const da = i;
                    for (; i < fine; i++) { const tile = createCardTile(pageCards[i]); if (window.Fluido) Fluido.rivela(tile, i - da); frag.appendChild(tile); }
                    grid.appendChild(frag);
                    if (i < pageCards.length) requestAnimationFrame(blocco);
                };
                blocco();
            }
            renderPager(q('pagerTop'), totalPages, results.length, firstIndex, pageCards.length);
            renderPager(q('pagerBottom'), totalPages, results.length, firstIndex, pageCards.length);
            if (opzioni.onConteggio) opzioni.onConteggio(`${results.length} cart${results.length === 1 ? 'a' : 'e'}`);
        }

        // La scheda della carta è quella condivisa da tutto il gioco
        // (js/ui/card-detail.js): tag, ATK/DEF, effetto, "Come si ottiene",
        // avviso di effetto parziale, Esc e click fuori per chiudere.
        function openCardModal(card) {
            CardDetail.open(card);
        }


        initFilters();
        renderGrid();

        return { refresh() { renderGrid(true); } };
    }

    window.CartotecaView = { mount: mount, ordina: sortCards };
})();
