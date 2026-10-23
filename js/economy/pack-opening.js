/**
 * pack-opening.js — la cerimonia di apertura di una bustina, e i
 * festeggiamenti per un acquisto.
 * =====================================================================
 * Prima comprare qualcosa era un click e un numero che cambiava. Il
 * momento in cui si scopre cosa c'era dentro è il motivo per cui si
 * compra una bustina: saltarlo è come scartare un regalo dentro una
 * busta trasparente.
 *
 * UNA CARTA ALLA VOLTA, e non tutte insieme. Il primo tentativo metteva
 * le dieci carte in una griglia che si girava a cascata: erano troppe per
 * stare in schermo, la griglia andava a capo, la scena diventava più alta
 * della finestra e compariva uno scorrimento in mezzo a un'animazione —
 * con le ultime carte che finivano sotto il pulsante. Il difetto non era
 * la misura di un margine: era la pretesa di mostrare dieci carte grandi
 * insieme.
 *
 * Adesso la scena ha tre fasce di altezza FISSA e non scorre mai:
 *
 *   ┌──────────────────────────────┐
 *   │  titolo + contatore  3 / 10  │  ← alta quanto il testo
 *   ├──────────────────────────────┤
 *   │                              │
 *   │      la carta in mostra      │  ← si prende quello che resta,
 *   │   (e dietro, il mazzetto     │    e la carta è misurata in vh:
 *   │    di quelle non ancora      │    non può sbordare per costruzione
 *   │    scoperte)                 │
 *   ├──────────────────────────────┤
 *   │  ▪ ▪ ▪ ▫ ▫ ▫ ▫ ▫ ▫ ▫         │  ← le carte già scoperte
 *   ├──────────────────────────────┤
 *   │         Continua ›           │
 *   └──────────────────────────────┘
 *
 * LA SEQUENZA: la bustina entra sospesa e si apre al tocco (o da sola
 * dopo 2,5s — aspettare un gesto che potrebbe non arrivare mai non è
 * un'esperienza); si strappa con un lampo; resta un mazzetto coperto da
 * cui le carte si alzano UNA ALLA VOLTA, si girano grandi al centro, e
 * scendono nella striscia in basso. Una rara arriva con più luce;
 * un'ULTRA RARA fa esplodere lo sfondo e resta in mostra più a lungo.
 * Toccando lo sfondo si salta alla fine: chi ha già capito cosa ha
 * trovato non deve restare a guardare.
 *
 * COSA NON FA: non decide niente. Le carte le ha già estratte e
 * accreditate chi chiama — questa funzione RACCONTA un esito già
 * avvenuto, come la cinematica di vittoria del duello. Se si fermasse a
 * metà, il giocatore avrebbe comunque le sue carte.
 *
 * È un file a sé e non dentro shop-ui.js (che si occupa di cataloghi,
 * prezzi e portafoglio) perché è tutta e sola presentazione, ed è
 * riusabile: una futura "bustina gratis" a fine torneo può chiamare
 * `PackOpening.apri(...)` senza passare dal Negozio.
 *
 * RISPETTA `prefers-reduced-motion`: chi ha chiesto meno movimento vede
 * le stesse carte, tutte scoperte subito, senza sequenza.
 */
(function () {
    'use strict';

    /**
     * Quanto resta in mostra una carta prima di scendere nella striscia. Super, leggendaria, segreta e mitica
     * non avevano una voce (cadevano sul valore delle comuni, e nessuna luce): ora ogni fascia ha la sua.
     */
    const MOSTRA_MS = { common: 620, rare: 900, super: 1250, ultra: 1900, legendary: 2300, secret: 2600, mythic: 2600 };
    /**
     * Il TIER della luce WebGL (js/economy/pack-opening-webgl.js): 0 è lo strappo della busta, poi dalla comune
     * (1) alla segreta/mitica (6). Una fascia sconosciuta vale come una comune.
     */
    const TIER_LUCE = { common: 1, rare: 2, super: 3, ultra: 4, legendary: 5, secret: 6, mythic: 6 };
    /** Dall'ultra rara in su: sfondo che si accende, tocco di vibrazione, riga di riepilogo dedicata. */
    const FASCE_ALTE = new Set(['ultra', 'legendary', 'secret', 'mythic']);
    const ATTESA_APERTURA_AUTOMATICA_MS = 2500;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function el(tag, className, testo) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (testo != null) e.textContent = testo;
        return e;
    }

    function cartaPerId(cardId) {
        const lista = (typeof cardDatabase !== 'undefined' && cardDatabase) || [];
        return lista.find((c) => c.id === cardId) || null;
    }

    /**
     * Una carta vera con la cornice del duello. La larghezza arriva da
     * fuori come stringa CSS: chi la usa sa in quale fascia della scena
     * sta, e solo lui può misurarla in modo che non sbordi.
     */
    function nodoCarta(cardId, larghezza) {
        const carta = cartaPerId(cardId);
        if (!carta || typeof window.createCardElement !== 'function') return el('div', 'po-carta-mancante', '?');
        const nodo = window.createCardElement(carta);
        nodo.style.setProperty('--card-w', larghezza);
        nodo.style.setProperty('--card-h', `calc(${larghezza} / var(--card-ratio))`);
        // Riflesso per rarità e inclinazione sotto il mouse (mai sotto il
        // dito: la fila lì scorre). Fuori dal mouse le animazioni della
        // busta restano padrone della carta.
        if (window.CartaViva) CartaViva.rendi(nodo, carta, { modo: 'fila' });
        return nodo;
    }

    function rarita(cardId) {
        return (window.CardRarity && typeof CardRarity.of === 'function') ? CardRarity.of(cardId) : 'common';
    }

    function scintille(x, y, opzioni) {
        if (window.FX && typeof FX.spawnParticles === 'function') FX.spawnParticles(x, y, opzioni);
    }

    function centroDi(nodo) {
        const r = nodo.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r };
    }

    /**
     * Le carte mantengono una dimensione leggibile. Se la fila non entra
     * nello spazio disponibile diventa un carosello orizzontale: niente
     * riduzione estrema e niente sovrapposizione che nasconda le immagini.
     */
    function disponiRiepilogo(striscia) {
        const slots = Array.from(striscia.children);
        slots.forEach((slot, i) => {
            slot.style.marginLeft = '';
            slot.style.zIndex = String(i + 1);
        });
        if (slots.length < 1 || striscia.clientWidth <= 0) return;
        const cardWidth = slots[0].getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(striscia).columnGap || getComputedStyle(striscia).gap) || 0;
        const naturalWidth = cardWidth * slots.length + gap * (slots.length - 1);
        striscia.classList.toggle('is-scrollable', naturalWidth > striscia.clientWidth + 1);
    }

    /**
     * Su touch lo scorrimento resta nativo; su desktop si puo trascinare la
     * fila come un carosello. Il flag `haTrascinato` impedisce che il rilascio
     * dopo uno swipe apra per errore il dettaglio della carta sottostante.
     */
    function abilitaScorrimentoOrizzontale(striscia) {
        let partenzaX = 0;
        let scrollIniziale = 0;
        let trascina = false;
        let haTrascinato = false;
        striscia.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'touch' || event.button !== 0) return;
            partenzaX = event.clientX;
            scrollIniziale = striscia.scrollLeft;
            trascina = true;
            haTrascinato = false;
        });
        striscia.addEventListener('pointermove', (event) => {
            if (!trascina) return;
            const delta = event.clientX - partenzaX;
            if (Math.abs(delta) > 5) {
                if (!haTrascinato) {
                    // Un semplice click deve restare indirizzato allo slot.
                    // Catturiamo il puntatore solo quando il gesto e' ormai
                    // inequivocabilmente un trascinamento del carosello.
                    striscia.setPointerCapture(event.pointerId);
                }
                haTrascinato = true;
                striscia.classList.add('is-dragging');
            }
            if (haTrascinato) striscia.scrollLeft = scrollIniziale - delta;
        });
        const termina = () => {
            trascina = false;
            striscia.classList.remove('is-dragging');
            setTimeout(() => { haTrascinato = false; }, 0);
        };
        striscia.addEventListener('pointerup', termina);
        striscia.addEventListener('pointercancel', termina);
        striscia.addEventListener('click', (event) => {
            if (!haTrascinato) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
        striscia.addEventListener('wheel', (event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || striscia.scrollWidth <= striscia.clientWidth) return;
            event.preventDefault();
            striscia.scrollLeft += event.deltaY;
        }, { passive: false });
    }

    /** La stessa busta metallizzata esposta nello scaffale del Negozio. */
    function nodoBustina(busta) {
        const bustina = el('div', 'po-bustina');
        bustina.style.setProperty('--pack-base', (busta && busta.colore) || '#1d4f9e');
        const corpo = el('div', 'po-pack-body');
        corpo.appendChild(el('div', 'po-pack-tear'));
        corpo.appendChild(el('div', 'po-pack-band', (busta && busta.nomeBreve) || (busta && busta.nome) || 'BUSTINA'));
        const emblema = el('div', 'po-pack-emblem');
        const mostroId = busta && busta.mostroSimboloId;
        const cartaSimbolo = mostroId ? cartaPerId(mostroId) : null;
        const pos = busta && busta.emblema;
        if (mostroId) {
            const immagine = document.createElement('img');
            immagine.src = cartaSimbolo && typeof window.getCardImagePath === 'function'
                ? window.getCardImagePath(cartaSimbolo)
                : `images/cards/${mostroId}.jpg`;
            immagine.alt = cartaSimbolo ? cartaSimbolo.name : '';
            emblema.classList.add('pack-theme-monster');
            emblema.appendChild(immagine);
        } else if (pos) {
            emblema.classList.add('pack-emblem-sprite');
            emblema.style.setProperty('--emblem-x', `${pos[0] * 100 / 3}%`);
            emblema.style.setProperty('--emblem-y', '0%');
        } else emblema.textContent = '✦';
        corpo.appendChild(emblema);
        corpo.appendChild(el('div', 'po-pack-count', `${(busta && busta.carte) || ''} CARTE`));
        corpo.appendChild(el('div', 'po-bustina-luccichio'));
        bustina.appendChild(corpo);
        bustina.appendChild(el('div', 'po-bustina-invito', 'Tocca per strappare'));
        return bustina;
    }

    // ==================================================================
    // Apertura bustina
    // ==================================================================
    function apri(busta, estratte, nuove, onDone) {
        const elenco = Array.isArray(estratte) ? estratte.slice() : [];
        const nuoveSet = new Set(nuove || []);

        const backdrop = el('div', 'po-backdrop');
        const scena = el('div', 'po-scena');
        backdrop.appendChild(scena);
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('po-in'));

        // La luce WebGL della cerimonia (null se manca WebGL o c'è il movimento ridotto: allora restano le
        // scintille di prima). Si rilascia SEMPRE alla chiusura: su telefono i contesti sono pochi.
        const luce = window.PackOpeningGL ? PackOpeningGL.crea(backdrop) : null;

        let chiuso = false;
        const chiudi = () => {
            if (chiuso) return;
            chiuso = true;
            backdrop.classList.remove('po-in');
            setTimeout(() => {
                if (luce) luce.distruggi();
                backdrop.remove();
                if (typeof onDone === 'function') onDone();
            }, 260);
        };

        if (menoMovimento()) {
            scenaSenzaMovimento(scena, elenco, nuoveSet, chiudi, busta);
            return;
        }

        const bustina = nodoBustina(busta);
        scena.appendChild(bustina);

        let aperta = false;
        const apriBustina = () => {
            if (aperta) return;
            aperta = true;
            clearTimeout(timerAuto);

            const c = centroDi(bustina);
            bustina.classList.add('po-bustina-strappata');
            if (luce) luce.impulso(c.x, c.y, 0);
            else scintille(c.x, c.y, {
                count: 46, colors: ['#ffdf8c', '#f39c12', '#ffffff'], speed: 8, life: 950, spread: 360, gravity: 0.04, size: 4
            });
            if (window.SFX && typeof SFX.summon === 'function') SFX.summon('attack');
            if (window.NativeHaptics) NativeHaptics.success();

            const lampo = el('div', 'po-lampo');
            backdrop.appendChild(lampo);
            setTimeout(() => lampo.remove(), 560);

            setTimeout(() => {
                bustina.remove();
                sequenza(backdrop, scena, elenco, nuoveSet, chiudi, busta, luce);
            }, 680);
        };

        bustina.addEventListener('click', apriBustina);
        const timerAuto = setTimeout(apriBustina, ATTESA_APERTURA_AUTOMATICA_MS);
    }

    /**
     * Il cuore: mazzetto coperto, una carta alla volta in mostra, e la
     * striscia che si riempie. Le tre fasce hanno altezze indipendenti e
     * NESSUNA di loro scorre — è così che la scena sta sempre in schermo,
     * su qualunque formato, senza doverla misurare caso per caso.
     */
    function sequenza(backdrop, scena, elenco, nuoveSet, chiudi, busta, luce) {
        const testa = el('div', 'po-testa');
        testa.appendChild(el('div', 'po-titolo', (busta && busta.nome) || 'Bustina'));
        const contatore = el('div', 'po-contatore', `0 / ${elenco.length}`);
        testa.appendChild(contatore);
        scena.appendChild(testa);

        const palco = el('div', 'po-palco');
        scena.appendChild(palco);

        // Il mazzetto di quelle ancora da scoprire: qualche retro
        // sovrapposto, non uno per carta — dieci nodi sovrapposti costano
        // e non si distinguono comunque.
        const mazzetto = el('div', 'po-mazzetto');
        for (let i = 0; i < Math.min(4, elenco.length); i++) {
            const retro = el('div', 'po-retro po-mazzetto-carta');
            retro.style.setProperty('--i', i);
            mazzetto.appendChild(retro);
        }
        palco.appendChild(mazzetto);

        const striscia = el('div', 'po-striscia');
        abilitaScorrimentoOrizzontale(striscia);
        scena.appendChild(striscia);

        const pulsante = el('button', 'po-chiudi', 'Continua ›');
        pulsante.type = 'button';
        scena.appendChild(pulsante);

        const osservaStriscia = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => disponiRiepilogo(striscia))
            : null;
        if (osservaStriscia) osservaStriscia.observe(striscia);
        const chiudiSequenza = () => {
            if (osservaStriscia) osservaStriscia.disconnect();
            chiudi();
        };
        pulsante.onclick = chiudiSequenza;

        let i = 0;
        let saltato = false;
        let timer = null;

        /** Aggiunge una miniatura alla striscia delle carte già viste. */
        function aggiungiAllaStriscia(id) {
            const r = rarita(id);
            const slot = el('div', 'po-slot po-slot-' + r);
            slot.appendChild(nodoCarta(id, 'var(--carta-striscia)'));
            if (nuoveSet.has(id)) slot.appendChild(el('span', 'po-slot-nuova', '★'));
            slot.title = ((cartaPerId(id) || {}).name || '') + (nuoveSet.has(id) ? ' — nuova' : '');
            slot.onclick = () => {
                striscia.querySelectorAll('.po-slot.is-selected').forEach((n) => n.classList.remove('is-selected'));
                slot.classList.add('is-selected');
                if (window.CardDetail) CardDetail.open(cartaPerId(id));
            };
            striscia.appendChild(slot);
            requestAnimationFrame(() => disponiRiepilogo(striscia));
        }

        function finisci() {
            saltato = true;
            clearTimeout(timer);
            if (luce) luce.spegniAmbiente();
            palco.querySelectorAll('.po-mostra').forEach((n) => n.remove());
            mazzetto.style.display = 'none';
            while (striscia.children.length < elenco.length) {
                aggiungiAllaStriscia(elenco[striscia.children.length]);
            }
            contatore.textContent = `${elenco.length} / ${elenco.length}`;
            // La fascia più alta trovata: dalla ultra rara in su il riepilogo la annuncia.
            const ordine = ['ultra', 'legendary', 'secret', 'mythic'];
            const migliore = elenco.map(rarita).filter((r) => FASCE_ALTE.has(r))
                .sort((a, b) => ordine.indexOf(b) - ordine.indexOf(a))[0];
            const nomiFascia = { ultra: 'ULTRA RARA', legendary: 'LEGGENDARIA', secret: 'SEGRETA', mythic: 'MITICA' };
            const quanteNuove = elenco.filter((id) => nuoveSet.has(id)).length;
            testa.appendChild(el('div', 'po-riepilogo',
                (migliore ? `✨ Hai trovato ${migliore === 'ultra' ? 'un\'' : 'una '}${nomiFascia[migliore]}! ` : '')
                + (quanteNuove > 0 ? `${quanteNuove} mai avute prima su ${elenco.length}.` : 'Nessuna nuova questa volta.')));
            pulsante.classList.add('po-chiudi-pronto');
        }

        function prossima() {
            if (saltato) return;
            if (i >= elenco.length) { finisci(); return; }
            const id = elenco[i];
            const r = rarita(id);
            i++;
            contatore.textContent = `${i} / ${elenco.length}`;
            if (i >= elenco.length - 3) {
                const ultimo = mazzetto.lastElementChild;
                if (ultimo) ultimo.remove();
            }

            const mostra = el('div', 'po-mostra po-mostra-' + r);
            // Misurata in vh oltre che in vw: la fascia centrale è ciò che
            // AVANZA fra testa, striscia e pulsante, quindi una carta
            // misurata sulla sola larghezza sborderebbe su uno schermo
            // basso — è esattamente com'era nata la versione con lo
            // scorrimento.
            mostra.appendChild(nodoCarta(id, 'var(--carta-rivelata)'));
            const targhetta = el('div', 'po-targhetta');
            targhetta.appendChild(el('div', 'po-nome', (cartaPerId(id) || {}).name || '???'));
            if (r !== 'common' && window.CardRarity) {
                targhetta.appendChild(el('span', 'po-rarita po-rarita-' + r, CardRarity.label(r)));
            }
            if (nuoveSet.has(id)) targhetta.appendChild(el('span', 'po-nuova', '★ NUOVA'));
            mostra.appendChild(targhetta);
            palco.appendChild(mostra);

            requestAnimationFrame(() => {
                const c = centroDi(mostra);
                const alta = FASCE_ALTE.has(r);
                if (alta) {
                    backdrop.classList.add('po-ultra-attiva');
                    if (window.NativeHaptics) NativeHaptics.success();
                }
                if (luce) {
                    // La luce vera: un impulso alla comparsa (colore e forza dal tier) e, dalla rara in su,
                    // un alone che resta dietro la carta finché è in mostra.
                    luce.impulso(c.x, c.y, TIER_LUCE[r] || 1);
                    if (r !== 'common') luce.ambiente(c.x, c.y, TIER_LUCE[r] || 1);
                } else if (alta) {
                    scintille(c.x, c.y, {
                        count: 80, colors: ['#ffd700', '#fff6dc', '#ffffff', '#ffb347'],
                        speed: 10, life: 1300, spread: 360, gravity: 0.02, size: 5
                    });
                } else if (r === 'rare') {
                    scintille(c.x, c.y, {
                        count: 28, colors: ['#8ad7ff', '#ffffff', '#c9e9ff'], speed: 5, life: 750, spread: 360, gravity: -0.02
                    });
                }
            });

            timer = setTimeout(() => {
                if (saltato) return;
                backdrop.classList.remove('po-ultra-attiva');
                if (luce) luce.spegniAmbiente();
                // La carta scende nella striscia: si toglie il nodo grande
                // e si aggiunge la miniatura, che entra con un suo piccolo
                // ingresso — il passaggio si legge come "riposta via"
                // senza dover animare un volo vero fra due contenitori che
                // si ridimensionano.
                mostra.classList.add('po-mostra-via');
                setTimeout(() => mostra.remove(), 260);
                aggiungiAllaStriscia(id);
                prossima();
            }, MOSTRA_MS[r] || MOSTRA_MS.common);
        }

        // Toccare lo sfondo (non la striscia, non il pulsante) salta alla
        // fine.
        backdrop.addEventListener('click', (ev) => {
            if (ev.target !== backdrop && ev.target !== palco && ev.target !== scena) return;
            if (!saltato) finisci();
        });

        setTimeout(prossima, 420);
    }

    /** Tutte scoperte e ferme, per chi ha chiesto meno movimento. */
    function scenaSenzaMovimento(scena, elenco, nuoveSet, chiudi, busta) {
        scena.appendChild(el('div', 'po-titolo', (busta && busta.nome) || 'Bustina'));
        const striscia = el('div', 'po-striscia po-striscia-larga');
        abilitaScorrimentoOrizzontale(striscia);
        elenco.forEach((id) => {
            const slot = el('div', 'po-slot po-slot-' + rarita(id));
            slot.appendChild(nodoCarta(id, 'var(--carta-casella)'));
            if (nuoveSet.has(id)) slot.appendChild(el('span', 'po-slot-nuova', '★'));
            slot.onclick = () => {
                striscia.querySelectorAll('.po-slot.is-selected').forEach((n) => n.classList.remove('is-selected'));
                slot.classList.add('is-selected');
                if (window.CardDetail) CardDetail.open(cartaPerId(id));
            };
            striscia.appendChild(slot);
        });
        scena.appendChild(striscia);
        const pulsante = el('button', 'po-chiudi po-chiudi-pronto', 'Continua ›');
        pulsante.type = 'button';
        pulsante.onclick = chiudi;
        scena.appendChild(pulsante);
    }

    // ==================================================================
    // Acquisto di UNA carta
    // ==================================================================
    /**
     * La carta si alza, si ingrandisce con la luce della propria rarità e
     * si ripone. Breve di proposito: se ne comprano più di fila, e una
     * cerimonia lunga diventerebbe un ostacolo invece di un premio.
     */
    function festeggiaCarta(cardId, origineEl, onDone) {
        if (menoMovimento()) { if (onDone) onDone(); return; }
        const carta = cartaPerId(cardId);
        if (!carta || typeof window.createCardElement !== 'function') { if (onDone) onDone(); return; }

        const r = rarita(cardId);
        const backdrop = el('div', 'po-backdrop po-backdrop-leggero');
        const gruppo = el('div', 'po-acquisto-gruppo');
        const nodo = nodoCarta(cardId, 'var(--carta-acquisto)');
        nodo.classList.add('po-acquisto', 'po-acquisto-' + r);
        gruppo.appendChild(nodo);
        gruppo.appendChild(el('div', 'po-acquisto-nome', carta.name));
        backdrop.appendChild(gruppo);
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('po-in'));

        const box = origineEl && origineEl.getBoundingClientRect();
        if (box) {
            scintille(box.left + box.width / 2, box.top + box.height / 2, {
                count: r === 'ultra' ? 46 : 22,
                colors: r === 'ultra' ? ['#ffd700', '#fff6dc', '#ffffff'] : ['#8ad7ff', '#ffffff', '#c9e9ff'],
                speed: 5, life: 800, spread: 360, gravity: -0.03
            });
        }
        if (window.NativeHaptics) NativeHaptics.success();

        let via = false;
        const chiudi = () => {
            if (via) return;
            via = true;
            backdrop.classList.remove('po-in');
            setTimeout(() => { backdrop.remove(); if (onDone) onDone(); }, 260);
        };
        backdrop.addEventListener('click', chiudi);
        setTimeout(chiudi, r === 'ultra' ? 1900 : 1300);
    }

    // ==================================================================
    // Acquisto di un MAZZO
    // ==================================================================
    /**
     * La scatola VERA del mazzo (js/ui/deck-box.js, la stessa in 3D che si
     * vede in Creazione Deck, nel Negozio e nel Profilo) si apre, e ne
     * esce un ventaglio di carte.
     *
     * Si riusa quel componente invece di disegnare una scatola qui: era
     * la parte che stonava di più — un rettangolo con un'emoji sopra
     * accanto alle scatole vere della stessa pagina. E così un mazzo ha
     * lo stesso colore e lo stesso aspetto ovunque compaia, senza che
     * nessuno debba tenere allineate due versioni.
     *
     * Non si mostrano quaranta carte: un mazzo è un oggetto, non un
     * elenco — e l'elenco completo ha già il suo pulsante "Vedi le carte"
     * nel Negozio.
     */
    function festeggiaMazzo(deck, anteprimaIds, onDone) {
        const backdrop = el('div', 'po-backdrop');
        const scena = el('div', 'po-scena po-scena-mazzo');

        scena.appendChild(el('div', 'po-titolo', (deck && deck.nome) || 'Nuovo mazzo'));
        scena.appendChild(el('div', 'po-sottotitolo', 'Le sue carte sono entrate nella tua collezione.'));

        const palco = el('div', 'po-palco po-palco-mazzo');
        palco.appendChild(el('div', 'po-deck-aura'));

        // Il ventaglio sta DIETRO la scatola nel DOM ma sopra nello
        // z-index: le carte devono sembrare uscire da dentro.
        const ventaglio = el('div', 'po-ventaglio');
        const ids = (anteprimaIds || []).slice(0, 5);
        ids.forEach((id, k) => {
            const c = el('div', 'po-ventaglio-carta');
            // Posizione nel ventaglio calcolata attorno al centro: con un
            // numero dispari la carta di mezzo resta dritta, con uno pari
            // il ventaglio resta comunque simmetrico.
            c.style.setProperty('--i', k - (ids.length - 1) / 2);
            // Il ritardo vale da quando la scatola si apre (vedi .po-deck-rivelato in pack-opening.css).
            c.style.animationDelay = (240 + k * 100) + 'ms';
            c.appendChild(nodoCarta(id, 'var(--carta-ventaglio)'));
            ventaglio.appendChild(c);
        });
        palco.appendChild(ventaglio);

        const scatola = el('div', 'po-scatola');
        if (window.DeckBox && typeof DeckBox.markup === 'function') {
            const coverCard = deck && deck.coverCardId ? cartaPerId(deck.coverCardId) : null;
            scatola.innerHTML = DeckBox.markup({
                name: (deck && deck.nome) || 'Mazzo',
                color: (deck && deck.colore) || DeckBox.colorForId((deck && deck.packId) || 'mazzo'),
                coverSrc: (deck && deck.copertina)
                    || (coverCard && typeof window.getCardImagePath === 'function' ? window.getCardImagePath(coverCard) : null)
            });
        } else {
            // La scatola vera non c'è (pagina che non carica deck-box.js):
            // meglio niente scatola che un rettangolo diverso da tutte
            // quelle della stessa pagina.
            scatola.appendChild(el('div', 'po-scatola-icona', (deck && deck.icona) || '📦'));
        }
        palco.appendChild(scatola);
        scena.appendChild(palco);
        const sigillo = el('div', 'po-deck-sigillo', 'MAZZO ACQUISITO');
        scena.appendChild(sigillo);

        const pulsante = el('button', 'po-chiudi po-chiudi-pronto', 'Continua ›');
        pulsante.type = 'button';
        scena.appendChild(pulsante);
        backdrop.appendChild(scena);
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('po-in'));

        // La luce WebGL (null senza WebGL o con il movimento ridotto: allora la cerimonia è quella di sempre,
        // con le scintille DOM). Si rilascia alla chiusura.
        const luce = window.PackOpeningGL ? PackOpeningGL.crea(backdrop) : null;
        const timer = [];
        const tra = (ms, fn) => { timer.push(setTimeout(fn, ms)); };
        const centroScatola = () => {
            const b = scatola.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height * 0.42, alto: b.top + b.height * 0.2 };
        };

        if (!menoMovimento()) {
            // TRE ATTI. 1) CARICA: la luce si raccoglie sulla scatola mentre trema (0,9 s). 2) APERTURA: il
            // colpo — flash, onde d'urto, raggi, colonna di luce, fontana di scintille — e il ventaglio esce.
            // 3) L'alone oro resta dietro, e il sigillo arriva con un ultimo lampo.
            const attesaCarica = luce ? 900 : 300;
            if (luce) {
                scatola.classList.add('po-scatola-carica');
                requestAnimationFrame(() => { const c = centroScatola(); luce.impulso(c.x, c.y, 8); });
                if (window.NativeHaptics) NativeHaptics.light();
            }
            tra(attesaCarica, () => {
                scatola.classList.remove('po-scatola-carica');
                scatola.classList.add('po-scatola-aperta');
                scena.classList.add('po-deck-rivelato');
                const c = centroScatola();
                if (luce) {
                    luce.impulso(c.x, c.y, 7);
                    luce.impulso(c.x, c.alto, 9);
                    luce.ambiente(c.x, c.y, 7);
                } else {
                    scintille(c.x, c.alto, {
                        count: 52, colors: ['#ffdf8c', '#f39c12', '#ffffff'], speed: 7, life: 1100, spread: 150, baseAngle: -90, gravity: 0.03
                    });
                }
                if (window.NativeHaptics) NativeHaptics.success();
                if (luce) {
                    tra(180, () => { if (window.NativeHaptics) NativeHaptics.light(); });
                    // Il sigillo "MAZZO ACQUISITO" è il terzo atto: un lampo sopra di lui quando compare.
                    tra(1200, () => {
                        const s = sigillo.getBoundingClientRect();
                        luce.impulso(s.left + s.width / 2, s.top + s.height / 2, 4);
                    });
                }
            });
        } else {
            scatola.classList.add('po-scatola-aperta');
            scena.classList.add('po-deck-rivelato');
        }

        let via = false;
        pulsante.onclick = () => {
            if (via) return;
            via = true;
            timer.forEach(clearTimeout);
            backdrop.classList.remove('po-in');
            setTimeout(() => { if (luce) luce.distruggi(); backdrop.remove(); if (onDone) onDone(); }, 260);
        };
    }

    window.PackOpening = {
        apri: apri,
        festeggiaCarta: festeggiaCarta,
        festeggiaMazzo: festeggiaMazzo
    };
})();
