/**
 * js/economy/shop-ui.js — IL NEGOZIO, COSTRUITO UNA VOLTA SOLA
 * =====================================================================
 * Il Negozio è raggiungibile da due punti: la pagina autonoma
 * negozio.html e la vista fusa dentro index.html. Invece di copiarlo in
 * entrambi — copie a mano della stessa schermata sono già andate alla
 * deriva più volte in questo progetto, vedi CLAUDE.md — vive qui e si
 * innesta dove serve con `ShopUI.mount(contenitore)`.
 *
 * DIVISIONE DEI COMPITI
 *   js/economy/shop-catalog.js  decide COSA è in vendita e a che prezzo
 *   js/data/card-rarity.js      decide quali carte sono rare
 *   js/economy/rewards.js       sa come si guadagna (e lo spiega)
 *   questo file                 disegna, e gestisce gli acquisti
 *
 * FILO CONDUTTORE, richiesta esplicita dell'utente: ogni scaffale
 * DICHIARA la propria regola di rifornimento, ogni prezzo dice in quale
 * valuta è e da dove quella valuta arriva, e in fondo c'è l'elenco
 * completo di come si guadagna. Niente deve sembrare arrivare "a caso".
 *
 * Il markup è costruito qui in JS e non c'è nessun id: tutto si trova per
 * riferimento diretto agli elementi creati. È deliberato — dentro
 * index.html convivono più viste e gli id andrebbero prefissati a mano,
 * che è esattamente il punto in cui quel file ha già raccolto tre bug.
 */
(function () {
    'use strict';

    const CARD_W = 'var(--carta-miniatura)';

    // `nome` è il plurale, `singolare` la forma da usare quando manca UNA
    // sola unità: "ti manca 1 Carte Locazione" si legge male, e queste
    // frasi le legge il giocatore.
    const VALUTE = {
        credits: { icon: '💰', nome: 'Crediti', singolare: 'Credito', etichetta: 'Crediti' },
        starChips: { icon: '⭐', nome: 'Stelle', singolare: 'Stella', etichetta: 'Stelle' },
        locatorCards: { icon: '🃏', nome: 'Carte Locazione', singolare: 'Carta Locazione', etichetta: 'Carte Locazione' },
        millenniumCards: { icon: '🔱', nome: 'Carte del Millennio', singolare: 'Carta del Millennio', etichetta: 'Carte del Millennio' }
    };
    /** Il nome di una valuta accordato alla quantità. */
    function nomeValuta(valuta, quantita) {
        const meta = VALUTE[valuta];
        return quantita === 1 ? (meta.singolare || meta.nome) : meta.nome;
    }

    function db() {
        if (typeof cardDatabase !== 'undefined' && Array.isArray(cardDatabase)) return cardDatabase;
        return window.cardDatabase || [];
    }
    function cartaPerId(cardId) {
        return db().find((x) => x.id === cardId) || null;
    }
    function nomeCarta(cardId) {
        const c = cartaPerId(cardId);
        return c ? c.name : 'Carta';
    }
    /** "1.250" invece di "1250": i prezzi grandi si leggono a colpo d'occhio. */
    function numero(n) { return Number(n).toLocaleString('it-IT'); }

    function applicaEmblema(nodo, busta) {
        const mostroId = busta && busta.mostroSimboloId;
        if (mostroId) {
            const carta = cartaPerId(mostroId);
            const immagine = document.createElement('img');
            immagine.src = carta && typeof window.getCardImagePath === 'function'
                ? window.getCardImagePath(carta)
                : `images/cards/${mostroId}.jpg`;
            immagine.alt = carta ? carta.name : '';
            immagine.loading = 'lazy';
            nodo.classList.add('pack-theme-monster');
            nodo.appendChild(immagine);
            return;
        }
        const pos = busta && busta.emblema;
        if (!pos) { nodo.textContent = '✦'; return; }
        nodo.classList.add('pack-emblem-sprite');
        nodo.style.setProperty('--emblem-x', `${pos[0] * 100 / 3}%`);
        nodo.style.setProperty('--emblem-y', '0%');
    }

    /**
     * Solo l'account amministratore può riacquistare un mazzo già suo.
     * Il privilegio deriva dal profilo Cloud (con la cache offline già
     * gestita da CloudSync), non da un parametro URL o dal salvataggio:
     * un giocatore normale non può quindi abilitarlo modificando il save.
     */
    function adminPuoRiacquistareMazzi() {
        return !!(window.CloudSync
            && typeof CloudSync.isAdmin === 'function'
            && CloudSync.isAdmin());
    }

    function el(tag, className, testo) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (testo != null) e.textContent = testo;
        return e;
    }

    /** Miniatura di una carta vera, con la stessa cornice del duello (serve js/ui/card.css). */
    function miniatura(cardId, larghezza) {
        const carta = db().find((c) => c.id === cardId);
        if (!carta || typeof window.createCardElement !== 'function') return el('div', '', '?');
        const node = window.createCardElement(carta);
        const w = larghezza || CARD_W;
        node.style.setProperty('--card-w', w);
        node.style.setProperty('--card-h', `calc(${w} / var(--card-ratio))`);
        // Riflesso per rarità e inclinazione sotto il mouse (js/ui/card-renderer.js).
        if (window.CartaViva) CartaViva.rendi(node, carta, { modo: 'fila' });
        return node;
    }

    function formattaAttesa(ms) {
        const totaleMin = Math.max(0, Math.floor(ms / 60000));
        const giorni = Math.floor(totaleMin / 1440);
        const ore = Math.floor((totaleMin % 1440) / 60);
        const minuti = totaleMin % 60;
        if (giorni > 0) return `cambia fra ${giorni}g ${ore}h`;
        if (ore > 0) return `cambia fra ${ore}h ${minuti}m`;
        return `cambia fra ${minuti}m`;
    }

    /**
     * Innesta il Negozio dentro `contenitore`. Torna un oggetto con
     * `refresh()` per chi deve ridisegnarlo (es. la vista fusa, quando ci
     * si rientra dopo aver giocato e guadagnato).
     */
    function mount(contenitore) {
        if (!contenitore) return null;
        contenitore.innerHTML = '';
        const root = el('div', 'shop-root');
        contenitore.appendChild(root);

        // ---- Portafoglio
        const walletRow = el('div', 'wallet-row');
        const valori = {};
        Object.keys(VALUTE).forEach((chiave) => {
            const tile = el('div', 'wallet-tile');
            tile.appendChild(el('div', 'wallet-icon', VALUTE[chiave].icon));
            const box = el('div');
            const val = el('div', 'wallet-value', '0');
            box.appendChild(val);
            box.appendChild(el('div', 'wallet-label', VALUTE[chiave].etichetta));
            tile.appendChild(box);
            walletRow.appendChild(tile);
            valori[chiave] = val;
        });
        root.appendChild(walletRow);

        // ---- Avviso orologio: mostrato SOLO se la data non viene dal
        // server. Il giocatore deve sapere che la rotazione sta seguendo
        // l'orologio del dispositivo, non scoprirlo da sé.
        const avviso = el('div', 'clock-warning');
        avviso.style.display = 'none';
        avviso.textContent = '⚠️ Non è stato possibile leggere la data dal server: la rotazione sta seguendo l\'orologio di questo dispositivo. Alla prossima apertura con connessione tornerà allineata a quella di tutti.';
        root.appendChild(avviso);

        /** Costruisce l'intestazione di uno scaffale: titolo, conto alla rovescia, e la REGOLA di rifornimento. */
        function sezione(titolo, regolaHtml) {
            const sec = el('section', 'shop-section');
            const head = el('div', 'shop-head');
            head.appendChild(el('h2', null, titolo));
            const timer = el('span', 'shop-timer', '—');
            head.appendChild(timer);
            sec.appendChild(head);
            const regola = el('p', 'shop-rule');
            regola.innerHTML = regolaHtml;
            sec.appendChild(regola);
            const grid = el('div', 'shop-grid');
            sec.appendChild(grid);
            root.appendChild(sec);
            return { grid: grid, timer: timer };
        }

        const secCarte = sezione('🗓️ Carte in rotazione',
            '<strong>3 comuni e 2 rare</strong> cambiano ogni giorno; Super, Ultra e Leggendaria hanno rotazioni più lunghe. Le <strong>comuni e le rare costano solo Crediti</strong>; dalle Super in su servono anche Stelle. Le carte firma compaiono soltanto dopo il primo sblocco.');
        const secBuste = sezione('📦 Buste della settimana',
            'Tre buste generiche e tre tematiche da <strong>10 carte</strong>. Nelle tematiche ogni carta rispetta il soggetto; alcune creature base mantengono l\'apertura equilibrata. I temi ruotano ogni lunedì.');
        secBuste.grid.classList.add('packs');
        // Starter e Structure in due scaffali distinti — richiesta
        // esplicita dell'utente: sono due cose diverse (i primi
        // introducono al gioco, i secondi sono mazzi a tema già
        // specializzati) e costano prezzi diversi, quindi mescolarli in
        // un'unica griglia da diciotto scatole rendeva difficile
        // orientarsi.
        /**
         * La regola dei prezzi crescenti, scritta con i numeri VERI del
         * catalogo — compresa la quantità di carte speciali, letta da
         * `ShopCatalog.extraRichieste` invece che scritta a mano: quel
         * numero è cresciuto più volte nella storia di questo file (da 1 a
         * 2, e continuerà a crescere via via che si comprano altri mazzi),
         * e un "1" fisso qui sarebbe rimasto disallineato dal vero
         * comportamento del Negozio alla prima modifica successiva.
         */
        function regolaMazzi(kind, introduzione) {
            const t = ShopCatalog.PREZZI_MAZZI[kind];
            // La quantità richiesta esattamente dal mazzo-soglia (il primo
            // per cui extraDalNumero scatta): è quella giusta da mostrare
            // nella regola generale, anche se un giocatore già più avanti
            // ne vedrà una più alta nel proprio pulsante d'acquisto.
            const extra = ShopCatalog.extraRichieste(t.extraDalNumero, t.extraDalNumero);
            const pluraleExtra = extra === 1 ? 'Carta' : 'Carte';
            return introduzione
                + ` Si pagano in <strong>⭐ Stelle</strong> (che arrivano quasi solo dai tornei) <strong>e Crediti</strong> insieme:`
                + ` si parte da <strong>${t.stelleBase} ⭐ + ${t.creditiBase} 💰</strong>.`
                + ` <strong>Ogni mazzo di questo tipo che compri fa salire il prezzo del successivo</strong>`
                + ` di ${t.stellePerAcquisto} ⭐ e ${t.creditiPerAcquisto} 💰 — i due tipi hanno contatori separati.`
                // "dal primo"/"dal secondo" letto da extraDalNumero: gli
                // Structure le chiedono già dal primo, gli Starter no.
                + ` ${t.extraDalNumero === 0 ? 'Già dal <strong>primo</strong>' : 'Dal <strong>secondo in poi</strong>'} serve in più <strong>${extra} 🃏 ${pluraleExtra} Locazione oppure ${extra} 🔱 ${pluraleExtra} del Millennio</strong>,`
                + ` a tua scelta — e la quantità richiesta cresce ulteriormente con altri acquisti dello stesso tipo.`
                + ` Ogni mazzo si acquista <strong>una volta sola</strong> e le sue carte entrano subito nella collezione.`;
        }

        const secStarter = sezione('🎓 Starter Deck',
            regolaMazzi('starter', 'I mazzi d\'ingresso, uno per Duellante storico.'));
        secStarter.grid.classList.add('decks');

        const secStructure = sezione('🏗️ Structure Deck',
            regolaMazzi('structure', 'Mazzi a tema già specializzati (Draghi, Zombie, Guerrieri...), più cari degli Starter perché più utili a costruirsi un mazzo vero.'));
        secStructure.grid.classList.add('decks');

        // ---- Regole dell'economia
        const secRegole = el('section', 'shop-section');
        const rulesBox = el('div', 'rules-box');
        rulesBox.appendChild(el('h2', null, '💡 Come si guadagna'));
        (window.Rewards ? Rewards.rulesSummary() : []).forEach((r) => {
            const riga = el('div', 'rule-item');
            riga.appendChild(el('span', 'rule-icon', r.icon));
            const testo = el('span');
            testo.appendChild(el('span', 'rule-title', r.titolo));
            testo.appendChild(document.createElement('br'));
            testo.appendChild(el('span', 'rule-text', r.testo));
            riga.appendChild(testo);
            rulesBox.appendChild(riga);
        });
        secRegole.appendChild(rulesBox);
        root.appendChild(secRegole);

        // Strumento temporaneo richiesto per provare la nuova cerimonia,
        // invisibile a chiunque non sia amministratore. Non accredita la
        // carta: mostra soltanto l'animazione con Kuriboo (id 861).
        if (adminPuoRiacquistareMazzi()) {
            const adminTools = el('section', 'shop-section shop-admin-tools');
            adminTools.appendChild(el('h2', null, 'Strumenti Admin'));
            adminTools.appendChild(el('p', 'shop-rule', 'Anteprima temporanea: non modifica la collezione.'));
            const provaDrop = el('button', 'buy-btn admin-drop-preview', 'Prova animazione ricompensa · Kuriboo');
            provaDrop.type = 'button';
            provaDrop.onclick = () => {
                if (window.CardDropAnimation) CardDropAnimation.enqueue({
                    cardId: 861, nome: 'Kuriboo',
                    rule: 'Anteprima amministratore — nessuna carta è stata aggiunta alla collezione.'
                });
            };
            adminTools.appendChild(provaDrop);
            root.appendChild(adminTools);
        }

        // ---- Modale di apertura busta
        const pullBackdrop = el('div', 'shop-pull-backdrop');
        const pullCard = el('div', 'shop-pull-card');
        const pullTitle = el('h3', null, 'Busta aperta!');
        const pullSub = el('p', 'shop-pull-sub');
        const pullGrid = el('div', 'shop-pull-grid');
        const pullClose = el('button', 'shop-pull-close', 'Chiudi');
        pullClose.type = 'button';
        pullCard.appendChild(pullTitle);
        pullCard.appendChild(pullSub);
        pullCard.appendChild(pullGrid);
        pullCard.appendChild(pullClose);
        pullBackdrop.appendChild(pullCard);
        document.body.appendChild(pullBackdrop);
        pullClose.onclick = () => pullBackdrop.classList.remove('open');
        pullBackdrop.addEventListener('click', (e) => { if (e.target === pullBackdrop) pullBackdrop.classList.remove('open'); });

        // ================================================================
        // Acquisti
        // ================================================================
        function aggiornaPortafoglio() {
            const w = SaveManager.getCurrency();
            Object.keys(valori).forEach((chiave) => { valori[chiave].textContent = numero(w[chiave] || 0); });
            return w;
        }

        /**
         * Pulsante d'acquisto per UNA valuta. Se il saldo non basta resta
         * visibile ma disabilitato e dice quanto manca: farlo sparire
         * lascerebbe il giocatore senza sapere nemmeno il prezzo.
         */
        function pulsanteAcquisto(valuta, importo, alternativo, onBuy) {
            const w = SaveManager.getCurrency();
            const meta = VALUTE[valuta];
            const btn = el('button', 'buy-btn' + (alternativo ? ' alt' : ''));
            btn.type = 'button';
            const basta = (w[valuta] || 0) >= importo;
            btn.disabled = !basta;
            const quanto = importo - (w[valuta] || 0);
            btn.textContent = basta
                ? `${meta.icon} ${numero(importo)}`
                : `${meta.icon} ${numero(importo)} — te ne manca${quanto === 1 ? '' : 'no'} ${numero(quanto)}`;
            btn.onclick = () => onBuy(valuta, importo);
            return btn;
        }

        /** Doppio controllo sul saldo: il pulsante è già disabilitato, ma un click duplicato non deve poter passare. */
        function paga(valuta, importo) {
            const w = SaveManager.getCurrency();
            if ((w[valuta] || 0) < importo) return false;
            SaveManager.addCurrency(valuta, -importo);
            return true;
        }

        /**
         * Pagamento COMPOSTO: più valute insieme, tutte o nessuna. Serve
         * ai mazzi, che costano Stelle *e* Crediti e — dal secondo Starter,
         * già dal primo Structure — anche carte speciali.
         * `parti` è una mappa valuta -> importo. Si controlla PRIMA che
         * tutte bastino e solo dopo si scala: mai lasciare il giocatore
         * con una valuta già spesa e l'acquisto non concluso.
         */
        function pagaComposto(parti) {
            const w = SaveManager.getCurrency();
            const valute = Object.keys(parti);
            if (!valute.every((v) => (w[v] || 0) >= parti[v])) return false;
            valute.forEach((v) => SaveManager.addCurrency(v, -parti[v]));
            return true;
        }

        /**
         * Pulsante per un costo composto. Mostra TUTTE le voci del
         * prezzo, e quando manca qualcosa dice quale — con tre valute in
         * gioco, un generico "non puoi permettertelo" lascerebbe il
         * giocatore a indovinare cosa gli serve.
         */
        function pulsanteComposto(parti, etichettaExtra, alternativo, onBuy) {
            const w = SaveManager.getCurrency();
            const btn = el('button', 'buy-btn' + (alternativo ? ' alt' : ''));
            btn.type = 'button';
            const voci = Object.keys(parti).map((v) => `${VALUTE[v].icon} ${numero(parti[v])}`);
            const mancanti = Object.keys(parti).filter((v) => (w[v] || 0) < parti[v]);
            btn.disabled = mancanti.length > 0;
            btn.textContent = (etichettaExtra ? etichettaExtra + ' · ' : '') + voci.join('  ');
            if (mancanti.length > 0) {
                btn.textContent += (mancanti.length === 1 ? ' — ti manca ' : ' — ti mancano ') + mancanti
                    .map((v) => {
                        const quanto = parti[v] - (w[v] || 0);
                        return `${numero(quanto)} ${nomeValuta(v, quanto)}`;
                    })
                    .join(' e ');
            }
            btn.onclick = () => onBuy(parti);
            return btn;
        }

        function renderCarteDelGiorno() {
            secCarte.grid.innerHTML = '';
            const carte = ShopCatalog.carteDelGiorno();
            // Una sola copia al giorno per carta — richiesto esplicitamente
            // dall'utente: appena comprata, sparisce dalla vetrina invece
            // di restare lì ricomprabile finché bastano i crediti. Torna
            // domani con la rotazione nuova (ShopCatalog.carteDelGiorno la
            // marca `acquistataOggi` leggendo lo stesso dayKey della
            // rotazione, vedi shop-catalog.js).
            const disponibili = carte.filter((voce) => {
                const cap = window.CardAcquisition && CardAcquisition.copyCapFor
                    ? CardAcquisition.copyCapFor(voce.cardId) : 3;
                return !voce.acquistataOggi && SaveManager.getOwnedCount(voce.cardId) < cap;
            });
            if (disponibili.length === 0) {
                secCarte.grid.appendChild(el('div', 'shop-empty-note',
                    'Hai già comprato tutte le carte di oggi. Torna a mezzanotte per una rotazione nuova.'));
                return;
            }
            disponibili.forEach((voce) => {
                const item = el('div', 'shop-item rarity-' + voce.rarity);
                const art = el('div', 'shop-item-art');
                const mini = miniatura(voce.cardId);
                // La carta in vendita si può aprire per leggerla: chi sta
                // per spendere crediti deve poter vedere cosa fa, non
                // solo il nome — richiesta esplicita dell'utente.
                mini.style.cursor = 'pointer';
                mini.title = 'Vedi la scheda';
                mini.onclick = () => { if (window.CardDetail) CardDetail.open(cartaPerId(voce.cardId)); };
                art.appendChild(mini);
                item.appendChild(art);
                item.appendChild(el('span', 'shop-badge ' + voce.rarity, CardRarity.label(voce.rarity)));
                item.appendChild(el('div', 'shop-item-name', nomeCarta(voce.cardId)));
                const possedute = SaveManager.getOwnedCount(voce.cardId);
                item.appendChild(el('div', 'shop-item-meta',
                    possedute > 0 ? `Ne possiedi ${possedute}` : 'Non ancora nella collezione'));

                const riga = el('div', 'buy-row');
                const compra = () => {
                    if (!pagaComposto(voce.costo)) return;
                    SaveManager.addOwnedCards(voce.cardId, 1);
                    // Segnata SUBITO, prima di qualunque refresh: sia quello
                    // immediato qui sotto sia quello passato come callback a
                    // festeggiaCarta devono già trovarla esclusa dalla
                    // prossima ShopCatalog.carteDelGiorno().
                    ShopCatalog.segnaCartaDelGiornoComprata(voce.cardId);
                    if (window.NativeHaptics) NativeHaptics.success();
                    // La carta appena comprata si fa vedere: prima
                    // l'acquisto era un click e un numero che cambiava, e
                    // non c'era modo di capire che fosse andato a buon
                    // fine se non ricontando le copie possedute.
                    if (window.PackOpening && typeof PackOpening.festeggiaCarta === 'function') {
                        PackOpening.festeggiaCarta(voce.cardId, item, refresh);
                    }
                    refresh();
                };
                riga.appendChild(pulsanteComposto(voce.costo, '', false, compra));
                item.appendChild(riga);
                secCarte.grid.appendChild(item);
            });
        }

        function mostraApertura(busta, estratte, nuove) {
            pullTitle.textContent = `${busta.icona} ${busta.nome}`;
            const conUltra = estratte.some((id) => CardRarity.of(id) === 'ultra');
            pullSub.textContent = conUltra
                ? `Hai trovato un'ULTRA RARA! ${nuove.length} carte mai avute prima.`
                : `${nuove.length} carte mai avute prima su ${estratte.length}.`;
            pullGrid.innerHTML = '';
            estratte.forEach((id, i) => {
                const cell = el('div', 'shop-pull-cell');
                cell.style.animationDelay = (i * 90) + 'ms';
                const mini = miniatura(id, 'var(--carta-piccola)');
                mini.style.cursor = 'pointer';
                cell.appendChild(mini);
                cell.appendChild(el('div', 'shop-pull-name', nomeCarta(id)));
                const r = CardRarity.of(id);
                if (r !== 'common') cell.appendChild(el('span', 'shop-badge ' + r, CardRarity.label(r)));
                if (nuove.indexOf(id) !== -1) cell.appendChild(el('span', 'shop-pull-new', '★ NUOVA'));
                // Anche le carte appena trovate si aprono: la prima cosa
                // che si vuole fare con un'ultra rara è leggerla.
                cell.onclick = () => { if (window.CardDetail) CardDetail.open(cartaPerId(id)); };
                pullGrid.appendChild(cell);
            });
            pullBackdrop.classList.add('open');
        }

        function renderBuste() {
            secBuste.grid.innerHTML = '';
            ShopCatalog.busteDellaSettimana().forEach((busta) => {
                const item = el('div', 'shop-item');

                // La bustina in finto 3D (vedi .pack-art in shop.css):
                // stesso spirito della deck box dei mazzi qui sotto —
                // un prodotto si guarda prima di comprarlo.
                const stage = el('div', 'pack-stage');
                const art = el('div', 'pack-art');
                art.style.setProperty('--pack-base', busta.colore);
                art.innerHTML = '<div class="pk-body">'
                    + '<div class="pk-tear"></div>'
                    + `<div class="pk-band">${busta.nomeBreve}</div>`
                    + '<div class="pk-emblem"></div>'
                    + `<div class="pk-count">${busta.carte} CARTE</div>`
                    + '</div>';
                applicaEmblema(art.querySelector('.pk-emblem'), busta);
                stage.appendChild(art);
                item.appendChild(stage);

                const titolo = el('div', 'shop-item-name', busta.nome);
                titolo.style.fontSize = '0.95rem';
                item.appendChild(titolo);
                const desc = el('div', 'shop-item-meta',
                    // La percentuale di ultra rara è scritta a chiare
                    // lettere: è la sola differenza vera fra le tre buste,
                    // e nasconderla renderebbe la scelta un tiro al buio.
                    busta.descrizione + (busta.legendaryChance
                        ? ` Probabilità di leggendaria: ${Math.round(busta.legendaryChance * 100)}%.` : ''));
                desc.style.lineHeight = '1.45';
                item.appendChild(desc);

                const riga = el('div', 'buy-row');
                const apri = () => {
                    if (!pagaComposto(busta.costo)) return;
                    const estratte = ShopCatalog.apriBusta(busta);
                    const nuove = estratte.filter((id) => SaveManager.getOwnedCount(id) === 0);
                    estratte.forEach((id) => SaveManager.addOwnedCards(id, 1));
                    // La cerimonia (js/economy/pack-opening.js): la bustina
                    // si apre, le carte escono coperte e si girano una
                    // alla volta. Le carte sono GIÀ state estratte e
                    // accreditate qui sopra — l'animazione racconta un
                    // esito già avvenuto e non decide niente, quindi se
                    // il modulo non c'è si ricade sulla vecchia griglia
                    // invece di lasciare il giocatore senza sapere cosa ha
                    // preso.
                    if (window.PackOpening && typeof PackOpening.apri === 'function') {
                        PackOpening.apri(busta, estratte, nuove, refresh);
                    } else {
                        if (window.NativeHaptics) NativeHaptics.success();
                        mostraApertura(busta, estratte, nuove);
                    }
                    refresh();
                };
                riga.appendChild(pulsanteComposto(busta.costo, '', false, apri));
                item.appendChild(riga);
                secBuste.grid.appendChild(item);
            });
        }

        function renderMazzi() {
            secStarter.grid.innerHTML = '';
            secStructure.grid.innerHTML = '';
            ShopCatalog.mazziInVendita().forEach((deck) => {
                const riacquistoAdmin = deck.posseduto && adminPuoRiacquistareMazzi();
                const griglia = deck.kind === 'structure' ? secStructure.grid : secStarter.grid;
                const item = el('div', 'shop-item deck-box'
                    + (deck.posseduto ? ' owned' : '')
                    + (riacquistoAdmin ? ' admin-rebuy' : ''));
                // Stessa "deck box" 3D di Creazione Deck — richiesta
                // esplicita dell'utente: lo stesso mazzo deve avere lo
                // stesso aspetto ovunque lo si guardi. Il disegno vive in
                // js/ui/deck-box.css + js/ui/deck-box.js, condivisi.
                const cover = deck.coverCardId ? db().find((c) => c.id === deck.coverCardId) : null;
                item.innerHTML = DeckBox.markup({
                    name: deck.nome,
                    // Il colore non è scelto dal giocatore (questi mazzi
                    // non sono suoi): si deriva dall'id, così ogni
                    // pacchetto ha sempre la stessa scatola ma due
                    // pacchetti diversi quasi mai lo stesso colore.
                    color: DeckBox.colorForId(deck.packId),
                    coverSrc: cover && typeof window.getCardImagePath === 'function' ? window.getCardImagePath(cover) : '',
                    emblem: riacquistoAdmin ? '↻' : (deck.posseduto ? '✓' : '')
                });
                item.appendChild(el('div', 'shop-item-name', deck.nome));
                item.appendChild(el('div', 'shop-item-meta', `${deck.carte} carte`));
                const riga = el('div', 'buy-row');
                // "Vedi le carte" c'è SEMPRE, anche per un mazzo non
                // ancora posseduto: guardare cosa contiene è esattamente
                // ciò che serve per decidere se spenderci le Stelle —
                // stesso principio già adottato in Creazione Deck.
                const vedi = el('button', 'buy-btn ghost', '👁 Vedi le carte');
                vedi.type = 'button';
                vedi.onclick = () => mostraContenutoMazzo(deck);
                riga.appendChild(vedi);
                if (deck.posseduto && !riacquistoAdmin) {
                    riga.appendChild(el('div', 'shop-owned-note', '✓ Già acquistato'));
                } else {
                    if (riacquistoAdmin) {
                        riga.appendChild(el('div', 'shop-owned-note admin-rebuy-note',
                            '↻ Admin: riacquistabile senza limiti'));
                    }
                    const compra = (parti) => {
                        // Si RICONTROLLA il possesso qui, un istante prima
                        // di pagare, invece di fidarsi di com'era la
                        // schermata quando è stata disegnata. Il pulsante
                        // non esiste nemmeno per un mazzo già posseduto,
                        // ma fra il disegno e il tocco può passare di
                        // tutto: un acquisto appena fatto in un'altra
                        // scheda, un salvataggio arrivato dal cloud, un
                        // doppio tocco che fa partire due volte lo stesso
                        // handler. Senza questo controllo il giocatore
                        // pagherebbe una seconda volta un mazzo che ha già
                        // — addOwnedPack non aggiunge il duplicato, ma le
                        // Stelle e i Crediti sarebbero comunque spesi.
                        const giaPosseduto = SaveManager.ownsPack(deck.packId);
                        const puoRiacquistare = giaPosseduto && adminPuoRiacquistareMazzi();
                        if (giaPosseduto && !puoRiacquistare) {
                            // Niente messaggio da inventare: basta
                            // ridisegnare, e il mazzo si presenta come
                            // quello che è, "✓ Già acquistato", al posto
                            // del pulsante che non doveva più esserci.
                            refresh();
                            return;
                        }
                        if (!pagaComposto(parti)) return;
                        // Il primo acquisto registra il mazzo e versa le
                        // carte. Nei riacquisti admin il diritto di possesso
                        // resta unico, ma viene aggiunta un'altra copia del
                        // contenuto (sempre entro il limite globale di 99).
                        const pack = ShopCatalog.mazzoCompleto(deck.packId);
                        if (puoRiacquistare) {
                            if (pack) SaveManager.addOwnedCardsFromDeck(pack);
                        } else {
                            SaveManager.addOwnedPack(deck.packId);
                        }
                        if (window.NativeHaptics) NativeHaptics.success();
                        // La scatola si apre e ne esce un ventaglio di
                        // carte. Se ne mostrano cinque e non quaranta: un
                        // mazzo è un oggetto, non un elenco — e l'elenco
                        // completo ha già il suo pulsante "Vedi le carte"
                        // qui accanto.
                        if (window.PackOpening && typeof PackOpening.festeggiaMazzo === 'function') {
                            // `deck.carte` è un CONTEGGIO, non una lista:
                            // le carte vere stanno in mazzoCompleto, la
                            // stessa fonte che usa "Vedi le carte" qui
                            // accanto.
                            const anteprima = ((pack && pack.main) || []).slice(0, 5).map((v) => v.id);
                            PackOpening.festeggiaMazzo(deck, anteprima, refresh);
                        }
                        refresh();
                    };
                    const base = { starChips: deck.costo.starChips, credits: deck.costo.credits };
                    if (!deck.costo.richiedeExtra) {
                        riga.appendChild(pulsanteComposto(base, '', false, compra));
                    } else {
                        // Quando il tipo lo chiede (extraDalNumero) servono
                        // anche carte speciali, e si può scegliere QUALE
                        // delle due spendere: un pulsante per ciascuna,
                        // così chi ha fatto Battle City e chi ha fatto il
                        // Torneo Kaiba possono entrambi proseguire.
                        deck.costo.extraValute.forEach((valuta, i) => {
                            const parti = Object.assign({}, base);
                            parti[valuta] = deck.costo.extraQuantita;
                            riga.appendChild(pulsanteComposto(parti, '', i > 0, compra));
                        });
                    }
                }
                item.appendChild(riga);
                griglia.appendChild(item);
            });
        }

        /**
         * Il contenuto di uno Starter/Structure Deck, come in Creazione
         * Deck: Main ed Extra, ogni carta con il proprio ×N. Le carte
         * sono cliccabili e aprono la scheda SOPRA questa lista senza
         * chiuderla — chi sta valutando un mazzo vuole leggere un effetto
         * e tornare subito al punto in cui era.
         */
        function mostraContenutoMazzo(deck) {
            const pack = ShopCatalog.mazzoCompleto(deck.packId);
            if (!pack) return;
            pullTitle.textContent = deck.nome;
            pullSub.textContent = `${deck.carte} carte · costa ${deck.costo.starChips} ⭐`
                + (deck.posseduto ? ' · già tuo' : '');
            pullGrid.innerHTML = '';
            [
                { etichetta: 'Main Deck', lista: pack.main || [] },
                { etichetta: 'Extra Deck', lista: pack.extra || [] }
            ].forEach((zona) => {
                if (zona.lista.length === 0) return;
                const titolo = el('div', 'shop-pull-zone',
                    `${zona.etichetta} — ${zona.lista.reduce((s, e) => s + (e.qty || 0), 0)} carte`);
                pullGrid.appendChild(titolo);
                zona.lista.forEach((voce) => {
                    const cell = el('div', 'shop-pull-cell');
                    const mini = miniatura(voce.id, 'var(--carta-piccola)');
                    mini.style.cursor = 'pointer';
                    cell.appendChild(mini);
                    cell.appendChild(el('div', 'shop-pull-name', nomeCarta(voce.id)));
                    if ((voce.qty || 1) > 1) cell.appendChild(el('span', 'shop-pull-qty', '×' + voce.qty));
                    cell.onclick = () => { if (window.CardDetail) CardDetail.open(cartaPerId(voce.id)); };
                    pullGrid.appendChild(cell);
                });
            });
            pullBackdrop.classList.add('open');
        }

        function aggiornaTimer() {
            if (!window.ServerDate) return;
            secCarte.timer.textContent = formattaAttesa(ServerDate.msToNextDay());
            secBuste.timer.textContent = formattaAttesa(ServerDate.msToNextWeek());
        }

        /**
         * Al posto del conto alla rovescia, gli scaffali dei mazzi mostrano
         * a che punto è salito il loro prezzo: è la loro "regola di
         * rifornimento", e va letta a colpo d'occhio come le altre.
         */
        function aggiornaEtichetteMazzi() {
            [['starter', secStarter], ['structure', secStructure]].forEach(([kind, sez]) => {
                const c = ShopCatalog.costoMazzo(kind);
                sez.timer.textContent = c.giaPosseduti === 0
                    ? `prossimo: ${c.starChips} ⭐ + ${numero(c.credits)} 💰`
                    : `${c.giaPosseduti} già tuoi · prossimo: ${c.starChips} ⭐ + ${numero(c.credits)} 💰${c.richiedeExtra ? ' + 1 🃏/🔱' : ''}`;
            });
        }

        function refresh() {
            aggiornaPortafoglio();
            renderCarteDelGiorno();
            renderBuste();
            renderMazzi();
            aggiornaTimer();
            aggiornaEtichetteMazzi();
        }

        aggiornaPortafoglio();
        // La data va chiesta al server PRIMA di decidere l'offerta: con
        // l'orologio locale basterebbe spostare l'ora del telefono per far
        // ruotare le carte a piacere (vedi js/cloud/server-date.js).
        const pronto = window.ServerDate ? ServerDate.sync() : Promise.resolve(false);
        pronto.then(() => {
            if (window.ServerDate && !ServerDate.isTrusted()) avviso.style.display = 'block';
            refresh();
        });
        const intervallo = setInterval(aggiornaTimer, 30000);

        const api = {
            refresh: refresh,
            /** Da chiamare se il Negozio viene rimosso dal documento, per non lasciare timer orfani. */
            destroy: function () {
                clearInterval(intervallo);
                pullBackdrop.remove();
            }
        };
        // Riferimento all'ultimo Negozio innestato: serve a chi lo apre
        // senza tenersi il valore di ritorno (la pagina autonoma) e a
        // poterlo ridisegnare da fuori.
        ShopUI.current = api;
        return api;
    }

    window.ShopUI = { mount: mount, current: null };
})();
