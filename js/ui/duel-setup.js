/**
 * duel-setup.js — il selettore "com'è fatto questo duello": mazzo,
 * arena, colonna sonora.
 * =====================================================================
 * Gemello di js/ui/duel-setup.css (questo costruisce il markup, quello
 * lo disegna), sullo stesso modello di deck-box.js/.css.
 *
 * Nato nella Sala d'Attesa del Multiplayer e subito estratto qui perché
 * la stessa scelta serve prima di un Duello Libero, in due pagine
 * diverse (la vista dentro index.html e la pagina standalone). Senza
 * questo file sarebbero state TRE copie della stessa cosa: in questo
 * progetto una copia a mano diverge sempre — le liste di arene e musiche
 * lo avevano già fatto, con una traccia etichettata male in una sola
 * delle due.
 *
 * Cosa NON fa, di proposito: non decide nulla al posto di chi lo usa.
 * Non lancia il duello, non salva impostazioni, non conosce il
 * Multiplayer. Espone la scelta corrente e avvisa quando cambia; l'unica
 * eccezione è il mazzo, che scrive davvero SaveManager.setActiveDeckId
 * perché "mazzo scelto" in questo gioco È il mazzo corrente (lo stesso
 * campo che imposta Creazione Deck), non una preferenza a parte.
 *
 * Uso:
 *   const setup = DuelSetup.mount(elemento, {
 *       decks: true,              // mostra il selettore di mazzi
 *       arena: true,              // mostra arena e musica (default: sì)
 *       readOnly: false,          // arena/musica in sola lettura
 *       deckHref: 'creazione-deck.html',  // dove mandare chi non ha mazzi
 *       onChange(sel) { ... }     // { field, music } dopo ogni scelta
 *   });
 *   setup.getSelection();         // { field, music } ('random' se non scelto)
 *   setup.showSelection({field, music});  // evidenzia una scelta altrui
 *   setup.setReadOnly(true);
 *   setup.stopPreview();          // sempre, prima di lasciare la schermata
 */
(function () {
    'use strict';

    const ANTEPRIMA_MAX_MS = 20000;

    // Un solo elemento audio per pagina: due anteprime insieme sarebbero
    // solo rumore. Vive fuori dall'istanza perché il vincolo è dell'utente
    // (un paio di orecchie), non del componente.
    let anteprima = null;
    let anteprimaBtn = null;
    let anteprimaStop = null;

    function musicaDiPagina() { return document.getElementById('bgMusicAudio'); }

    // La musica di sottofondo si ferma e riparte tramite DuelMusic, che
    // conosce il backend vero: nell'APK è il MediaPlayer nativo, e mettere
    // in pausa l'<audio> della pagina lì non fermava niente (l'anteprima
    // suonava sopra il sottofondo). Il ripiego sull'elemento resta per le
    // pagine che non hanno avviato l'audio manager.
    let sottofondoFermatoDaNoi = false;
    function fermaSottofondo() {
        if (window.DuelMusic && typeof DuelMusic.sospendi === 'function') { DuelMusic.sospendi(); return; }
        const bg = musicaDiPagina();
        if (bg && !bg.paused) { bg.pause(); sottofondoFermatoDaNoi = true; }
    }
    function riprendiSottofondo() {
        if (window.DuelMusic && typeof DuelMusic.riprendi === 'function') { DuelMusic.riprendi(); return; }
        const bg = musicaDiPagina();
        // Un play() rifiutato dal browser non è un errore da mostrare: la
        // musica riprenderà al primo gesto vero.
        if (bg && sottofondoFermatoDaNoi) bg.play().catch(() => {});
        sottofondoFermatoDaNoi = false;
    }

    // Dissolvenze dell'anteprima: SOLO nel browser (richiesta dell'utente).
    // Nell'APK il sottofondo è il player nativo e l'anteprima parte e si
    // ferma secca, come prima. Il sottofondo, nel browser, sfuma da sé in
    // DuelMusic.sospendi/riprendi: insieme fanno una dissolvenza incrociata.
    const VOLUME_ANTEPRIMA = 0.6;
    const SFUMA_ANTEPRIMA_MS = 450;
    function sfumatureAttive() {
        return !(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    }
    function sfumaElemento(el, verso, durataMs, allaFine) {
        if (el._timerSfumatura) clearInterval(el._timerSfumatura);
        const da = el.volume;
        const passi = Math.max(1, Math.round(durataMs / 30));
        let passo = 0;
        el._timerSfumatura = setInterval(() => {
            passo++;
            el.volume = Math.min(1, Math.max(0, da + (verso - da) * (passo / passi)));
            if (passo >= passi) {
                clearInterval(el._timerSfumatura);
                el._timerSfumatura = null;
                if (allaFine) allaFine();
            }
        }, durataMs / passi);
    }

    // Toglie l'anteprima in corso senza toccare il sottofondo: serve fra
    // un'anteprima e la successiva, dove far ripartire la musica per un
    // istante e rifermarla subito si sentirebbe come un singhiozzo. Nel
    // browser la traccia uscente sfuma per conto suo, staccata dal resto.
    function spegniAnteprima() {
        if (anteprimaStop) { clearTimeout(anteprimaStop); anteprimaStop = null; }
        const cera = !!anteprima;
        if (anteprima) {
            const uscente = anteprima;
            uscente.onended = null;
            if (sfumatureAttive()) sfumaElemento(uscente, 0, SFUMA_ANTEPRIMA_MS * 0.7, () => uscente.pause());
            else uscente.pause();
            anteprima = null;
        }
        if (anteprimaBtn) {
            anteprimaBtn.textContent = '▶';
            anteprimaBtn.classList.remove('suona');
            anteprimaBtn = null;
        }
        return cera;
    }

    /** Fine dell'anteprima (finita, fermata, o schermata chiusa): il sottofondo riparte. */
    function fermaAnteprima() {
        if (spegniAnteprima()) riprendiSottofondo();
    }

    function alternaAnteprima(file, btn, onBloccata) {
        const eraLoStesso = anteprimaBtn === btn;
        if (eraLoStesso) { fermaAnteprima(); return; }
        spegniAnteprima();
        fermaSottofondo();

        anteprima = new Audio(window.ArenaOptions.audioFor(file));
        const sfuma = sfumatureAttive();
        anteprima.volume = sfuma ? 0 : VOLUME_ANTEPRIMA;
        anteprimaBtn = btn;
        btn.textContent = '⏸';
        btn.classList.add('suona');
        const entrante = anteprima;
        anteprima.play().then(() => {
            if (sfuma && anteprima === entrante) sfumaElemento(entrante, VOLUME_ANTEPRIMA, SFUMA_ANTEPRIMA_MS);
        }).catch(() => {
            if (onBloccata) onBloccata();
            fermaAnteprima();
        });
        anteprima.onended = fermaAnteprima;
        // Un assaggio, non l'ascolto integrale.
        anteprimaStop = setTimeout(fermaAnteprima, ANTEPRIMA_MAX_MS);
    }

    /**
     * Fa scorrere il nome sul coperchio quando non ci sta. Va richiamata
     * quando i selettori sono VISIBILI: un elemento nascosto misura zero,
     * e ogni nome risulterebbe "che ci sta" — da qui `refresh()` sul
     * controller, che le schermate chiamano al momento di mostrarsi.
     */
    function adattaNomi(radice) {
        radice.querySelectorAll('.ds-deck .dbx-name').forEach((coperchio) => {
            const testo = coperchio.querySelector('.dbx-name-text');
            if (!testo) return;
            coperchio.classList.remove('is-scorrevole');
            const eccesso = testo.scrollWidth - coperchio.clientWidth;
            if (eccesso <= 2) return;
            coperchio.classList.add('is-scorrevole');
            coperchio.style.setProperty('--ds-name-shift', eccesso + 'px');
            // Velocità costante invece di durata fissa: un nome appena più
            // lungo non deve strisciare, uno lunghissimo non deve sfrecciare.
            coperchio.style.setProperty('--ds-name-time', Math.max(5, 4 + eccesso / 12).toFixed(1) + 's');
        });
    }

    function segna(radice, selettore, valore, attributo) {
        radice.querySelectorAll(selettore).forEach((el) => {
            el.setAttribute('aria-pressed', String(el.dataset[attributo] === String(valore)));
        });
    }

    function gruppo(etichetta, icona) {
        const box = document.createElement('div');
        box.className = 'ds-group';
        const lab = document.createElement('span');
        lab.className = 'ds-group-label';
        if (icona && window.Icons) {
            const svg = Icons.buildIcon(icona);
            if (svg) lab.appendChild(svg);
        }
        if (lab.childNodes.length) lab.appendChild(document.createTextNode(' '));
        lab.appendChild(document.createTextNode(etichetta));
        box.appendChild(lab);
        return box;
    }

    function mount(container, options) {
        const opts = options || {};
        const radice = typeof container === 'string' ? document.querySelector(container) : container;
        if (!radice) return null;

        const scelta = {
            field: (opts.initial && opts.initial.field) || window.ArenaOptions.RANDOM,
            music: (opts.initial && opts.initial.music) || window.ArenaOptions.RANDOM,
            // 'yu-gi-oh' e non 'all': la restrizione dev'essere una scelta
            // consapevole, ma il duello classico è ciò che il giocatore si
            // aspetta aprendo il gioco. Stesso default del menu a tendina
            // che questo gruppo sostituisce.
            origin: (opts.initial && opts.initial.origin) || 'yu-gi-oh'
        };

        radice.classList.add('ds-setup');
        // `compact`: per chi lo monta dentro una finestra che sotto ha
        // ancora dei comandi (vedi duel-setup.css).
        radice.classList.toggle('ds-setup--compact', !!opts.compact);
        radice.classList.toggle('ds-setup--readonly', !!opts.readOnly);
        radice.innerHTML = '';

        const avvisa = () => {
            if (opts.onChange) opts.onChange({ field: scelta.field, music: scelta.music, origin: scelta.origin });
        };

        // --- Mazzi (facoltativo) ---------------------------------------
        if (opts.decks) {
            // `deckLabel: false` per chi ha già un'intestazione propria sopra
            // il punto di innesto (la Sala d'Attesa): ripetere "Il tuo mazzo"
            // due volte di fila sembra un errore, non un'enfasi.
            const g = opts.deckLabel === false
                ? Object.assign(document.createElement('div'), { className: 'ds-group' })
                : gruppo(opts.deckLabel || '🃏 Il tuo mazzo');
            const strip = document.createElement('div');
            strip.className = 'ds-strip';
            const mazzi = (window.SaveManager && SaveManager.getDecks && SaveManager.getDecks()) || [];

            if (mazzi.length === 0) {
                const vuoto = document.createElement('div');
                vuoto.className = 'ds-empty';
                vuoto.innerHTML = 'Non hai ancora un mazzo tuo: si duella con un mazzo generato al momento.<br>'
                    + `<a href="${opts.deckHref || 'creazione-deck.html'}">Creane uno in Creazione Deck</a>`;
                g.appendChild(vuoto);
            } else {
                mazzi.forEach((mazzo) => {
                    const el = document.createElement('div');
                    el.className = 'ds-deck';
                    el.setAttribute('role', 'button');
                    el.setAttribute('tabindex', '0');
                    el.dataset.deckId = mazzo.id;

                    const conteggio = (mazzo.main || []).reduce((tot, v) => tot + (v.qty || 1), 0);
                    // Sotto le 40 carte il mazzo non è legale: si può
                    // comunque scegliere (il motore non lo rifiuta), ma va
                    // detto PRIMA del duello, non scoperto durante.
                    const avviso = conteggio < 40 ? ' <span class="ds-deck-warn">⚠</span>' : '';
                    el.innerHTML = (window.DeckBox ? window.DeckBox.markup({
                        name: mazzo.name,
                        color: mazzo.color || window.DeckBox.colorForId(mazzo.id)
                    }) : '')
                        + `<div class="ds-deck-meta">${conteggio} carte${avviso}</div>`;

                    const seleziona = () => {
                        if (!SaveManager.setActiveDeckId || !SaveManager.setActiveDeckId(mazzo.id)) return;
                        segna(radice, '.ds-deck', mazzo.id, 'deckId');
                        if (opts.onDeckChange) opts.onDeckChange(mazzo);
                        if (window.NativeHaptics) NativeHaptics.light();
                    };
                    el.onclick = seleziona;
                    el.onkeydown = (ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); seleziona(); }
                    };
                    strip.appendChild(el);
                });
                g.appendChild(strip);
            }
            radice.appendChild(g);
        }

        // Arena e musica si possono lasciare fuori: la Sala d'Attesa del
        // Multiplayer le tiene in un riquadro separato da quello del
        // mazzo, perché hanno un padrone diverso (il mazzo è personale,
        // l'arena la decide chi ha creato la stanza).
        if (opts.arena === false) {
            adattaNomi(radice);
            return {
                getSelection: () => ({ field: scelta.field, music: scelta.music }),
                showSelection: () => {},
                setReadOnly: (ro) => radice.classList.toggle('ds-setup--readonly', !!ro),
                refresh: () => adattaNomi(radice),
                stopPreview: fermaAnteprima,
                element: radice
            };
        }

        // --- Arene ------------------------------------------------------
        const gArene = gruppo('Arena', 'arena');
        const stripArene = document.createElement('div');
        stripArene.className = 'ds-strip';

        const casuale = document.createElement('button');
        casuale.type = 'button';
        casuale.className = 'ds-field ds-field--random';
        const iconaCasuale = window.Icons && Icons.buildIcon('random');
        if (iconaCasuale) casuale.appendChild(iconaCasuale);
        else casuale.textContent = 'Casuale';
        casuale.title = 'Arena casuale';
        casuale.dataset.file = window.ArenaOptions.RANDOM;
        stripArene.appendChild(casuale);

        window.ArenaOptions.FIELDS.forEach((campo) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'ds-field';
            el.dataset.file = campo.file;
            el.dataset.preview = window.ArenaOptions.previewFor
                ? window.ArenaOptions.previewFor(campo.file)
                : window.ArenaOptions.imageFor(campo.file);
            const nome = document.createElement('span');
            nome.className = 'ds-field-name';
            nome.textContent = campo.nome;
            el.appendChild(nome);
            stripArene.appendChild(el);
        });

        // Le background-image CSS non supportano loading="lazy": prima tutte
        // le 36 arene partivano insieme, comprese quelle molto oltre il bordo
        // destro dello strip. L'observer carica la miniatura solo quando sta
        // per entrare nella zona scorribile; il fallback copre browser vecchi.
        const caricaAnteprimaCampo = (el) => {
            if (!el || !el.dataset.preview || el.dataset.previewLoaded === '1') return;
            el.dataset.previewLoaded = '1';
            el.style.backgroundImage = `url('${el.dataset.preview}')`;
        };
        if ('IntersectionObserver' in window) {
            const osservaArene = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    caricaAnteprimaCampo(entry.target);
                    observer.unobserve(entry.target);
                });
            }, { root: stripArene, rootMargin: '0px 240px' });
            stripArene.querySelectorAll('.ds-field[data-preview]').forEach((el) => osservaArene.observe(el));
        } else {
            stripArene.querySelectorAll('.ds-field[data-preview]').forEach(caricaAnteprimaCampo);
        }

        stripArene.querySelectorAll('.ds-field').forEach((el) => {
            el.onclick = () => {
                scelta.field = el.dataset.file;
                segna(radice, '.ds-field', scelta.field, 'file');
                if (window.NativeHaptics) NativeHaptics.light();
                avvisa();
            };
        });
        gArene.appendChild(stripArene);
        radice.appendChild(gArene);

        // --- Colonne sonore --------------------------------------------
        const gMusica = gruppo('Musica di battaglia', 'audio');
        const tracce = document.createElement('div');
        tracce.className = 'ds-tracks';

        const aggiungiTraccia = (file, nome, anteprimabile) => {
            // Riga come <div role="button"> e non <button>: dentro c'è un
            // secondo pulsante (l'anteprima), e un pulsante dentro un
            // pulsante è markup non valido — i browser lo "riparano"
            // spezzando l'annidamento, con risultati imprevedibili.
            const riga = document.createElement('div');
            riga.className = 'ds-track';
            riga.setAttribute('role', 'button');
            riga.setAttribute('tabindex', '0');
            riga.dataset.file = file;

            const etichetta = document.createElement('span');
            etichetta.className = 'ds-track-name';
            etichetta.textContent = nome;
            riga.appendChild(etichetta);

            if (anteprimabile) {
                const play = document.createElement('button');
                play.type = 'button';
                play.className = 'ds-preview';
                play.textContent = '▶';
                play.title = 'Ascolta un assaggio';
                play.onclick = (ev) => {
                    ev.stopPropagation(); // ascoltare non significa scegliere
                    alternaAnteprima(file, play, opts.onPreviewBlocked);
                };
                riga.appendChild(play);
            }

            const seleziona = () => {
                scelta.music = file;
                segna(radice, '.ds-track', scelta.music, 'file');
                if (window.NativeHaptics) NativeHaptics.light();
                avvisa();
            };
            riga.onclick = seleziona;
            riga.onkeydown = (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); seleziona(); }
            };
            tracce.appendChild(riga);
        };

        aggiungiTraccia(window.ArenaOptions.RANDOM, 'Casuale', false);
        window.ArenaOptions.TRACKS.forEach((t) => aggiungiTraccia(t.file, t.nome, true));
        gMusica.appendChild(tracce);
        radice.appendChild(gMusica);

        // --- Carte ammesse ----------------------------------------------
        // È una REGOLA del duello, non un gusto: dice quali carte possono
        // scendere in campo, e il motore ci blocca davvero un mazzo che non
        // la rispetta (vedi allowedOrigin in js/duel-session.js). In
        // Multiplayer la decide quindi chi crea la stanza, come l'arena.
        const gOrigini = gruppo('Carte ammesse', 'cards');
        const origini = document.createElement('div');
        origini.className = 'ds-origins';

        const noti = (typeof CARD_ORIGIN_LABELS !== 'undefined') ? CARD_ORIGIN_LABELS : { 'yu-gi-oh': 'Yu-Gi-Oh!' };
        const voci = Object.keys(noti).map((key) => ({ key: key, label: 'Solo ' + noti[key] }));
        // Le provenienze inventate dal giocatore (crea-carta.html) valgono
        // quanto quelle di serie: chi si è costruito un set deve poterci
        // duellare senza che questo file sappia nulla di lui.
        if (window.CustomTaxonomy && typeof CustomTaxonomy.listOrigins === 'function') {
            CustomTaxonomy.listOrigins().forEach((o) => {
                if (!voci.some((v) => v.key === o.key)) voci.push({ key: o.key, label: 'Solo ' + o.label });
            });
        }
        voci.push({ key: 'all', label: 'Tutte le provenienze' });

        voci.forEach((voce) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ds-origin';
            chip.dataset.origin = voce.key;
            chip.textContent = voce.label;
            chip.onclick = () => {
                scelta.origin = voce.key;
                segna(radice, '.ds-origin', scelta.origin, 'origin');
                if (window.NativeHaptics) NativeHaptics.light();
                avvisa();
            };
            origini.appendChild(chip);
        });
        gOrigini.appendChild(origini);
        radice.appendChild(gOrigini);

        segna(radice, '.ds-field', scelta.field, 'file');
        segna(radice, '.ds-track', scelta.music, 'file');
        segna(radice, '.ds-origin', scelta.origin, 'origin');
        if (opts.decks) {
            segna(radice, '.ds-deck', SaveManager.getActiveDeckId ? SaveManager.getActiveDeckId() : null, 'deckId');
        }
        adattaNomi(radice);

        return {
            /** La scelta corrente, ancora "casuale" se tale: risolverla spetta a chi avvia il duello. */
            getSelection: () => ({ field: scelta.field, music: scelta.music, origin: scelta.origin }),
            /** Evidenzia una scelta decisa da qualcun altro (in Multiplayer, quella di chi ha creato la stanza). */
            showSelection: (sel) => {
                if (!sel) return;
                if (sel.field) segna(radice, '.ds-field', sel.field, 'file');
                if (sel.music) segna(radice, '.ds-track', sel.music, 'file');
                if (sel.origin) segna(radice, '.ds-origin', sel.origin, 'origin');
            },
            setReadOnly: (ro) => radice.classList.toggle('ds-setup--readonly', !!ro),
            /** Da chiamare quando i selettori diventano visibili: vedi adattaNomi. */
            refresh: () => adattaNomi(radice),
            stopPreview: fermaAnteprima,
            element: radice
        };
    }

    /** Nome leggibile di una provenienza, per chi deve solo MOSTRARE la regola (es. il conto alla rovescia). */
    function originLabel(key) {
        if (!key || key === 'all') return 'Tutte le provenienze';
        if (typeof CARD_ORIGIN_LABELS !== 'undefined' && CARD_ORIGIN_LABELS[key]) return CARD_ORIGIN_LABELS[key];
        const custom = window.CustomTaxonomy && typeof CustomTaxonomy.listOrigins === 'function'
            ? CustomTaxonomy.listOrigins().find((o) => o.key === key)
            : null;
        return custom ? custom.label : key;
    }

    window.DuelSetup = { mount: mount, stopPreview: fermaAnteprima, originLabel: originLabel };
})();
