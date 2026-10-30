/**
 * fx-gsap.js — Backend di animazione basato su GSAP (js/vendor/gsap.min.js).
 * =====================================================================
 * E' un PLUGIN, nel senso pieno del termine: rimpiazza alcune animazioni
 * di js/ui/effects.js con una versione a timeline, e nient'altro nel
 * progetto sa che esiste.
 *
 *   - Per SPEGNERLO senza toccare il codice: window.FX_BACKEND = 'css'.
 *   - Per RIMUOVERLO del tutto: cancellare questo file e il suo <script>.
 *     Il gioco torna esattamente alle animazioni CSS di base, senza che
 *     serva modificare una riga altrove.
 *   - Per FORZARLO anche se un altro backend venisse registrato dopo:
 *     window.FX_BACKEND = 'gsap'.
 *
 * PERCHE' GSAP E NON PIXI. Il campo di duello e' fatto di elementi DOM
 * (le carte sono nodi, non sprite): GSAP anima il DOM, ed e' esattamente
 * il lavoro che serve qui. PixiJS e' un renderer WebGL su canvas — puo'
 * solo stare sopra o sotto le carte, mai intrecciarsi con loro, e le
 * particelle di effects.js girano gia' su un canvas 2D che funziona.
 * Per i colpi di scena a schermo intero c'e' gia' FX.playVideoOverlay
 * (filmati pre-renderizzati), che costa meno e rende di piu'.
 *
 * COSA AGGIUNGE DAVVERO rispetto alle versioni CSS, che restano buone:
 * sequenze vere. Le animazioni di base sono catene di setTimeout e toggle
 * di classi, dove ogni ritardo e' un numero scritto a mano da tenere
 * allineato al CSS; qui una timeline descrive l'intera sequenza in un
 * punto solo, con easing che il CSS non ha (expo, circ, bounce) e la
 * possibilita' di interromperla pulita.
 *
 * DIPENDENZA PIGRA: gsap.min.js viene caricato dopo l'evento 'load' (vedi
 * duelMonstersCore.html), quindi al momento in cui questo file gira la
 * libreria di solito NON c'e' ancora. Non e' un problema: il backend si
 * registra comunque dichiarando `requires: ['gsap']`, e la facciata FX lo
 * considera attivo solo quando quel globale esiste davvero. L'unica
 * accortezza e' richiamare FX.refreshBackend() quando la libreria
 * atterra, cosa che facciamo in fondo a questo file.
 *
 * NOTA SUL RISPETTO DELL'UTENTE: prefers-reduced-motion e' gestito una
 * volta sola dalla facciata (js/ui/effects.js), che in quel caso non
 * chiama affatto il backend. Qui dentro non serve ricontrollarlo.
 */
(function () {
    'use strict';

    if (!window.FX || typeof FX.registerBackend !== 'function') {
        // effects.js non caricato (o versione precedente al sistema a
        // backend): questo file non ha nulla a cui agganciarsi.
        return;
    }

    /** Centro di un elemento in coordinate di viewport — gemella di quella in effects.js, che non e' esposta. */
    function centerOf(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
    }

    /**
     * Un elemento usa-e-getta posizionato a schermo, rimosso da solo.
     * Gli effetti di base fanno lo stesso con spawnDomFx(), che pero' e'
     * interna a effects.js: qui serve una versione propria, minima.
     */
    function fxLayer(className, x, y, w, h) {
        const el = document.createElement('div');
        el.className = className;
        el.style.position = 'fixed';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        if (w !== undefined) el.style.width = w + 'px';
        if (h !== undefined) el.style.height = h + 'px';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9998';
        // Ogni strato creato qui nasce per essere animato e buttato via
        // subito dopo: dichiararlo in anticipo fa si' che il browser gli
        // dia una superficie tutta sua invece di disegnarlo insieme al
        // resto della pagina. Senza, anche una semplice dissolvenza
        // sporca l'area del documento che ci sta sotto e la costringe a
        // ridipingersi. E' il caso d'uso per cui `will-change` esiste
        // (elemento effimero e sicuramente animato), non un'ottimizzazione
        // sparsa a caso su elementi statici, dove sarebbe solo spreco di
        // memoria.
        el.style.willChange = 'transform, opacity';
        document.body.appendChild(el);
        return el;
    }

    /**
     * Uno strato circolare che deve CRESCERE (onde d'urto, vampate,
     * anelli di luce). Si crea gia' alla dimensione FINALE e si parte
     * rimpiccioliti: a crescere e' `scale`, non `width`/`height`.
     *
     * Perche' non si anima direttamente la dimensione, che sarebbe la
     * strada piu' corta da scrivere: cambiare larghezza e altezza a un
     * elemento lo fa ridisegnare da capo ad OGNI fotogramma, e siccome
     * questi strati stanno appesi al documento (position:fixed sotto
     * <body>) a essere ridipinto e' l'intero schermo, non il solo
     * cerchio. Misurato col profiler del browser su un attacco
     * mostro-contro-mostro: 1469ms di rasterizzazione in 2,6 secondi,
     * contro i 73ms del gioco fermo, con il documento ridipinto per
     * intero 68 volte. Con `scale` il cerchio viene disegnato UNA volta
     * e poi soltanto ingrandito dal compositore, che e' il lavoro per
     * cui esiste.
     *
     * Torna la funzione che converte un diametro in pixel nel fattore di
     * scala corrispondente, cosi' i punti d'uso restano scritti in pixel
     * ("arriva a 240") invece che in fattori astratti.
     *
     * Una differenza visiva c'e', ed e' voluta: un bordo viene scalato
     * insieme al cerchio, quindi un anello parte con un tratto piu'
     * sottile di prima invece di mantenerlo costante in pixel. A
     * dimensione piena — dove l'anello resta per quasi tutta la sua vita,
     * visto che questi tween usano tutti un easing "out" che arriva
     * grande quasi subito — il tratto e' identico a prima.
     */
    function cerchioCheCresce(el, diametroIniziale, diametroFinale, stile) {
        const scalaDi = (diametro) => diametro / diametroFinale;
        gsap.set(el, Object.assign({
            xPercent: -50,
            yPercent: -50,
            width: diametroFinale,
            height: diametroFinale,
            borderRadius: '50%',
            scale: scalaDi(diametroIniziale)
        }, stile || {}));
        return scalaDi;
    }

    /**
     * Opzioni comuni a OGNI tween che tocca un elemento del gioco (una
     * carta sul campo o in mano), invece di uno degli strati usa-e-getta
     * creati qui dentro.
     *
     * `overwrite: 'auto'` perche' in duello capita davvero che due
     * animazioni finiscano sulla stessa carta a distanza di un istante
     * (una carta pescata e subito evocata, un mostro colpito mentre sta
     * ancora atterrando): senza, i due tween si sovrappongono e l'ultimo a
     * finire lascia inline i valori dell'altro.
     *
     * Lo stesso motivo per cui ogni timeline chiude con PULIZIA (qui
     * sotto) e non con i soli valori finali: le carte hanno animazioni
     * CSS proprie (deal-in, fxSummonGlow...) che devono poter riprendere
     * il controllo, e una proprieta' rimasta inline le sovrascriverebbe
     * per sempre. Vale anche per `opacity`, che GSAP puo' scrivere anche
     * quando non la si anima esplicitamente.
     */
    const SU_CARTA = { overwrite: 'auto' };
    const PULIZIA = { clearProps: 'transform,filter,opacity', duration: 0 };

    /** Pannello a schermo intero riusando lo stile gia' esistente del randomizzatore (moneta/dado). */
    function fxBackdrop(className) {
        const el = document.createElement('div');
        el.className = className;
        document.body.appendChild(el);
        return el;
    }

    const impls = {
        /**
         * Evocazione: la carta "atterra" invece di limitarsi ad accendersi,
         * e l'anello d'urto parte in contemporanea invece che a un
         * setTimeout indovinato.
         * NIENTE rimbalzo (niente back/elastic): richiesta esplicita
         * dell'utente — un mostro che si materializza deve ARRIVARE e
         * restare fermo, non sobbalzare come un oggetto di gomma. `expo.out`
         * da' un atterraggio pesante che decelera fino a zero senza mai
         * superare la posizione finale. Stessa regola per ogni altro
         * atterraggio 3D di questo file.
         */
        playSummonShockwave: function (monsterElement) {
            if (!monsterElement) return;
            const c = centerOf(monsterElement);

            const ring = fxLayer('fx-gsap-ring', c.x, c.y);
            const arrivo = Math.max(monsterElement.offsetWidth * 3.2, 180);
            cerchioCheCresce(ring, 40, arrivo, { border: '3px solid #ffdf8c', opacity: 0.9 });
            gsap.to(ring, {
                scale: 1,
                opacity: 0,
                duration: 0.7,
                ease: 'power2.out',
                onComplete: () => ring.remove()
            });

            // Atterraggio in 3D: la carta arriva inclinata all'indietro e
            // si raddrizza appoggiandosi sul campo, invece di comparire di
            // faccia e basta. transformPerspective e' per-elemento, quindi
            // non serve toccare gli antenati.
            gsap.timeline()
                .fromTo(monsterElement,
                    { scale: 0.72, y: -26, transformPerspective: 800, rotationX: -52, filter: 'brightness(2.2)' },
                    Object.assign({ scale: 1, y: 0, rotationX: 0, filter: 'brightness(1)', duration: 0.6, ease: 'expo.out' }, SU_CARTA))
                .to(monsterElement, PULIZIA);

            if (typeof FX.spawnParticles === 'function') {
                FX.spawnParticles(c.x, c.y, { count: 26, speed: 5, life: 700, size: 3, spread: 360, gravity: 0.04 });
            }
        },

        /**
         * Danno ai Life Points: scossa con smorzamento vero al posto della
         * classe .fx-shake a durata fissa. Il colpo parte forte e si
         * spegne, invece di vibrare uguale per 450ms.
         */
        playDamageEffect: function (amount, opts) {
            const container = document.querySelector('.game-container') || document.body;
            const forza = Math.min(18, 6 + (Number(amount) || 0) / 260);
            const mobileTouch = window.matchMedia
                && window.matchMedia('(pointer: coarse)').matches;

            if (!mobileTouch) {
                gsap.timeline()
                    .to(container, { x: -forza, duration: 0.05, ease: 'none' })
                    .to(container, { x: forza * 0.8, duration: 0.06 })
                    .to(container, { x: -forza * 0.5, duration: 0.06 })
                    .to(container, { x: forza * 0.25, duration: 0.06 })
                    .to(container, { x: 0, duration: 0.08, ease: 'power2.out', clearProps: 'transform' });
            }

            const vignetta = fxLayer('fx-gsap-vignette', 0, 0, window.innerWidth, window.innerHeight);
            gsap.set(vignetta, { background: 'radial-gradient(circle, rgba(255,0,0,0) 45%, rgba(255,0,0,0.55) 100%)', opacity: 0 });
            gsap.to(vignetta, {
                opacity: 1, duration: 0.12, ease: 'power2.out',
                onComplete: () => gsap.to(vignetta, { opacity: 0, duration: 0.42, onComplete: () => vignetta.remove() })
            });

            // Il numero che sale: la parte che i giocatori guardano davvero,
            // e che l'animazione di base non ha affatto. `anchorEl` e' il
            // nome che usa gia' il chiamante (vedi playDamageEffect in
            // js/ui/effects.js); senza, si mette al centro dello schermo.
            const target = (opts && opts.anchorEl) || null;
            const p = target ? centerOf(target) : { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
            if (mobileTouch) {
                // Impulso locale: anima un piccolo livello indipendente vicino
                // ai LP colpiti, non l'albero DOM del duello. Due soli tween di
                // transform/opacity mantengono l'impatto anche sui telefoni
                // meno potenti senza il calo di frame della scossa globale.
                const impulso = fxLayer('fx-gsap-mobile-hit', p.x, p.y, 116, 116);
                gsap.fromTo(impulso,
                    { xPercent: -50, yPercent: -50, scale: 0.35, opacity: 0.9 },
                    { scale: 1.28, opacity: 0, duration: 0.34, ease: 'power2.out', onComplete: () => impulso.remove() });
            }
            const testo = fxLayer('fx-gsap-damage-number', p.x, p.y);
            testo.textContent = '-' + (Number(amount) || 0);
            gsap.set(testo, {
                xPercent: -50, yPercent: -50,
                color: '#ff5b5b', fontWeight: 900, fontSize: 'clamp(1.6rem, 5vw, 3rem)',
                textShadow: '0 0 12px rgba(255,0,0,0.8), 0 2px 6px rgba(0,0,0,0.9)',
                scale: 0.4, opacity: 0
            });
            gsap.timeline({ onComplete: () => testo.remove() })
                .to(testo, { scale: 1.15, opacity: 1, duration: 0.22, ease: 'power3.out' })
                .to(testo, { scale: 1, duration: 0.1 })
                .to(testo, { y: '-=42', opacity: 0, duration: 0.5, ease: 'power1.in' }, '+=0.25');
        },

        /**
         * Tributo: la carta viene risucchiata verso l'alto e sbriciolata,
         * invece di sfumare sul posto. Il senso e' "questa carta se ne va
         * per farne arrivare un'altra", e si vede.
         */
        playTributeSacrifice: function (cardElement) {
            if (!cardElement) return;
            const c = centerOf(cardElement);

            gsap.timeline()
                .to(cardElement, { scale: 1.12, filter: 'brightness(1.8)', duration: 0.16, ease: 'power2.out' })
                .to(cardElement, Object.assign({ scale: 0.1, y: -70, rotation: 12, opacity: 0, duration: 0.5, ease: 'power2.in' }, SU_CARTA))
                .to(cardElement, PULIZIA);

            if (typeof FX.spawnParticles === 'function') {
                FX.spawnParticles(c.x, c.y, {
                    count: 34, speed: 6, life: 900, size: 3, spread: 120, baseAngle: -90,
                    gravity: -0.03, colors: ['#ffdf8c', '#f39c12', '#ffffff']
                });
            }
        },

        /**
         * Scontro in battaglia: i due mostri si vanno addosso e il lampo
         * scoppia nel punto d'impatto. Nella versione di base attaccante e
         * bersaglio non si muovono affatto — qui la carica c'e' davvero, ed
         * e' la ragione principale per cui vale la pena di una timeline.
         */
        playBattleClashEpic: function (attackerEl, targetEl) {
            const a = attackerEl ? centerOf(attackerEl) : null;
            const t = targetEl ? centerOf(targetEl) : null;
            const point = t || a;
            if (!point) return;
            const midX = a && t ? (a.x + t.x) / 2 : point.x;
            const midY = a && t ? (a.y + t.y) / 2 : point.y;

            const tl = gsap.timeline();

            if (false && attackerEl && a && t) {
                // (disattivato: la rincorsa e' UNA sola, quella CSS chargeAttack — due movimenti sommati facevano accelerare la carta)
                // Rincula, poi carica verso il bersaglio fermandosi a meta'.
                const dx = (t.x - a.x) * 0.42;
                const dy = (t.y - a.y) * 0.42;
                tl.to(attackerEl, Object.assign({ x: -dx * 0.22, y: -dy * 0.22, duration: 0.14, ease: 'power2.out' }, SU_CARTA))
                  .to(attackerEl, { x: dx, y: dy, duration: 0.16, ease: 'power3.in' })
                  .to(attackerEl, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' }, '+=0.05')
                  .to(attackerEl, PULIZIA);
            }

            const lampo = fxLayer('fx-gsap-clash', midX, midY);
            const scalaLampo = cerchioCheCresce(lampo, 30, 300, {
                background: 'radial-gradient(circle, #ffffff 0%, #ffdf8c 45%, rgba(243,156,18,0) 70%)',
                opacity: 0
            });
            tl.to(lampo, { opacity: 1, scale: scalaLampo(220), duration: 0.16, ease: 'power3.out' }, a && t ? 0.3 : 0)
              .to(lampo, { opacity: 0, scale: 1, duration: 0.3, ease: 'power2.out', onComplete: () => lampo.remove() });

            if (targetEl) {
                tl.to(targetEl, Object.assign({ x: 6, duration: 0.05, repeat: 5, yoyo: true }, SU_CARTA), a && t ? 0.32 : 0.02)
                  .to(targetEl, PULIZIA);
            }

            if (typeof FX.spawnParticles === 'function') {
                setTimeout(() => {
                    FX.spawnParticles(midX, midY, { count: 46, speed: 9, life: 800, size: 4, spread: 360, gravity: 0.05 });
                }, a && t ? 300 : 0);
            }
        },

        /**
         * Passaggio di controllo: la carta si stacca dal campo che lascia,
         * attraversa il tavolo ruotando su se stessa e si posa nella
         * casella del nuovo proprietario, che si illumina per accoglierla.
         * Il volo NON e' in linea retta: sale ad arco, perche' un mostro
         * che cambia padrone deve sembrare strappato via, non trascinato.
         */
        playControlSwitch: function (card, fromOwner, fromIndex, toOwner, toIndex) {
            if (!card || typeof window.createCardElement !== 'function') return;
            const slotRect = (owner, index) => {
                const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                const el = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return r.width ? { rect: r, el: el } : null;
            };
            const da = slotRect(fromOwner, fromIndex);
            const a = slotRect(toOwner, toIndex);
            if (!da || !a) return;

            const fantasma = window.createCardElement(card);
            Object.assign(fantasma.style, {
                position: 'fixed', left: da.rect.left + 'px', top: da.rect.top + 'px',
                width: da.rect.width + 'px', height: da.rect.height + 'px',
                margin: '0', zIndex: '10045', pointerEvents: 'none'
            });
            document.body.appendChild(fantasma);

            // L'arco: x scorre a velocita' costante, y scende e risale —
            // due tween sullo stesso elemento, ognuno con la propria curva.
            const dx = a.rect.left - da.rect.left;
            const dy = a.rect.top - da.rect.top;
            const altezzaArco = Math.min(120, Math.abs(dy) * 0.45 + 40);

            gsap.timeline({ onComplete: () => fantasma.remove() })
                .to(fantasma, { x: dx, duration: 0.62, ease: 'power1.inOut' }, 0)
                .to(fantasma, { y: dy - altezzaArco, duration: 0.31, ease: 'power2.out' }, 0)
                .to(fantasma, { y: dy, duration: 0.31, ease: 'power2.in' }, 0.31)
                .to(fantasma, { rotationY: 360, scale: 1.12, duration: 0.42, ease: 'power2.out' }, 0)
                .to(fantasma, { scale: 1, duration: 0.2, ease: 'power2.in' }, 0.42)
                .to(fantasma, { opacity: 0, duration: 0.12 }, 0.55);

            gsap.set(fantasma, {
                transformPerspective: 700,
                filter: 'drop-shadow(0 0 22px rgba(200,120,255,0.95))'
            });

            // La casella d'arrivo si illumina mentre la carta e' in volo.
            const alone = fxLayer('fx-gsap-control-target', a.rect.left, a.rect.top, a.rect.width, a.rect.height);
            gsap.set(alone, {
                zIndex: 10030, borderRadius: '8px',
                border: '2px solid rgba(200,120,255,0.9)',
                boxShadow: '0 0 26px rgba(200,120,255,0.75), inset 0 0 22px rgba(200,120,255,0.45)',
                opacity: 0
            });
            gsap.timeline({ onComplete: () => alone.remove() })
                .to(alone, { opacity: 1, duration: 0.2, delay: 0.18 })
                .to(alone, { opacity: 0, duration: 0.3, delay: 0.25 });

            if (typeof FX.spawnParticles === 'function') {
                FX.spawnParticles(da.rect.left + da.rect.width / 2, da.rect.top + da.rect.height / 2, {
                    count: 20, colors: ['#c87aff', '#e9c9ff', '#ffffff'], speed: 4, life: 620, gravity: -0.05
                });
            }
        },

        /**
         * L'attacco si INFRANGE: il bersaglio ha retto. Lo scudo di
         * energia compare fra i due, prende il colpo, si incrina e si
         * spegne; l'attaccante rimbalza indietro e le scintille tornano
         * verso di lui. Nessun frammento che vola via: la carta non si e'
         * rotta, ed e' tutto il punto dell'effetto.
         */
        playAttackBlocked: function (attackerEl, targetEl) {
            if (!targetEl) return;
            const t = centerOf(targetEl);
            const a = attackerEl ? centerOf(attackerEl) : null;

            // Lo scudo si mette FRA i due, spostato verso l'attaccante:
            // e' li' che il colpo arriva, non al centro della carta.
            let sx = t.x, sy = t.y;
            if (a) {
                const dx = a.x - t.x, dy = a.y - t.y;
                const d = Math.hypot(dx, dy) || 1;
                sx = t.x + (dx / d) * Math.min(38, d * 0.32);
                sy = t.y + (dy / d) * Math.min(38, d * 0.32);
            }

            const lato = Math.max(targetEl.offsetWidth * 1.25, 90);
            const scudo = fxLayer('fx-gsap-shield', sx, sy, lato, lato * 1.12);
            gsap.set(scudo, {
                zIndex: 10035, xPercent: -50, yPercent: -50,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: 'linear-gradient(180deg, rgba(190,235,255,0.6), rgba(90,170,255,0.3))',
                boxShadow: '0 0 38px rgba(120,200,255,0.9)',
                opacity: 0, scale: 0.5
            });

            gsap.timeline({ onComplete: () => scudo.remove() })
                .to(scudo, { opacity: 1, scale: 1.14, duration: 0.12, ease: 'power3.out' })
                .to(scudo, { scale: 1, duration: 0.1, ease: 'power2.out' })
                // Il tremito dello scudo che regge: corto e nervoso.
                .to(scudo, { x: '+=4', duration: 0.04, repeat: 5, yoyo: true })
                .to(scudo, { opacity: 0, scale: 1.08, duration: 0.26, ease: 'power2.in' });

            // Incrinature: due lampi netti sullo scudo, non frammenti.
            for (let i = 0; i < 2; i++) {
                const crepa = fxLayer('fx-gsap-crack', sx, sy, lato * 0.7, 3);
                gsap.set(crepa, {
                    zIndex: 10036, xPercent: -50, yPercent: -50,
                    background: 'linear-gradient(90deg, transparent, #ffffff, transparent)',
                    rotation: i === 0 ? -28 : 34, opacity: 0
                });
                gsap.timeline({ onComplete: () => crepa.remove() })
                    .to(crepa, { opacity: 1, duration: 0.06, delay: 0.1 + i * 0.05 })
                    .to(crepa, { opacity: 0, duration: 0.3, ease: 'power2.out' });
            }

            // L'attaccante rimbalza INDIETRO: e' quello che racconta
            // "non e' passato".
            if (attackerEl && a) {
                const dx = (t.x - a.x), dy = (t.y - a.y);
                const d = Math.hypot(dx, dy) || 1;
                gsap.timeline()
                    .to(attackerEl, Object.assign({ x: -(dx / d) * 16, y: -(dy / d) * 16, duration: 0.12, ease: 'power3.out' }, SU_CARTA))
                    // Rientro secco, senza oscillazione elastica: l'attacco
                    // e' stato RESPINTO da uno scudo, non e' finito contro
                    // una molla.
                    .to(attackerEl, { x: 0, y: 0, duration: 0.34, ease: 'power3.out' })
                    .to(attackerEl, PULIZIA);
            }

            // Il bersaglio incassa senza spostarsi dal posto.
            gsap.timeline()
                .to(targetEl, Object.assign({ x: 4, duration: 0.04, repeat: 5, yoyo: true }, SU_CARTA))
                .to(targetEl, PULIZIA);

            // Scintille che rimbalzano verso chi ha attaccato.
            if (typeof FX.spawnParticles === 'function') {
                const verso = a ? Math.atan2(a.y - t.y, a.x - t.x) * (180 / Math.PI) : -90;
                FX.spawnParticles(sx, sy, {
                    count: 26, colors: ['#bfe9ff', '#ffffff', '#7dd3fc'],
                    speed: 7, life: 600, size: 3, spread: 85, baseAngle: verso, gravity: 0.07
                });
            }
        },

        /**
         * Distruzione in battaglia. Il primo tentativo rimpiccioliva e
         * ruotava la carta mentre sbiadiva, ed e' stato scartato
         * dall'utente ("era meglio l'effetto precedente"): una carta che si
         * accartoccia sembra un annullamento, non una distruzione.
         *
         * Qui la carta NON si muove quasi: incassa un colpo secco, lampeggia
         * bianca e collassa sul posto in un attimo. Tutto lo spettacolo sta
         * FUORI di lei — l'onda d'urto, i frammenti che schizzano via e
         * cadono, la vampata. E' il linguaggio della versione CSS, che
         * all'utente piaceva, portato piu' in la' invece che sostituito.
         */
        playBattleDestroyEffect: function (cardElement) {
            if (!cardElement) return;
            const c = centerOf(cardElement);

            // La carta: colpo, lampo bianco, collasso verticale sul posto.
            gsap.timeline()
                .to(cardElement, Object.assign({ x: -5, duration: 0.035, repeat: 3, yoyo: true }, SU_CARTA))
                .to(cardElement, { filter: 'brightness(4) contrast(0.6)', duration: 0.08 }, 0)
                .to(cardElement, { filter: 'brightness(1)', duration: 0.1 }, 0.12)
                // Il collasso avviene INCLINANDOSI all'indietro nello
                // spazio (rotationX) invece di schiacciarsi sul posto: la
                // carta cade dentro al campo, non si appiattisce.
                .to(cardElement, Object.assign({ transformPerspective: 700, rotationX: -70, scaleY: 0.2, opacity: 0, duration: 0.18, ease: 'power3.in' }, SU_CARTA), 0.26)
                .to(cardElement, PULIZIA);

            // Vampata sul posto della carta: e' quello che si nota per primo.
            const vampata = fxLayer('fx-gsap-destroy-flash', c.x, c.y, c.rect.width * 1.5, c.rect.height * 1.5);
            gsap.set(vampata, {
                xPercent: -50, yPercent: -50, borderRadius: '50%',
                background: 'radial-gradient(circle, #ffffff 0%, #ffd27a 30%, rgba(231,76,60,0.45) 55%, rgba(0,0,0,0) 72%)',
                opacity: 0
            });
            gsap.timeline({ onComplete: () => vampata.remove() })
                .to(vampata, { opacity: 1, duration: 0.09, ease: 'power2.out' })
                .to(vampata, { opacity: 0, scale: 1.5, duration: 0.4, ease: 'power2.out' });

            // Due onde d'urto sfalsate: una sola sembra un cerchio, due
            // danno l'idea dell'esplosione.
            [0, 0.12].forEach((ritardo, n) => {
                const onda = fxLayer('fx-gsap-destroy-ring', c.x, c.y);
                cerchioCheCresce(onda, 24, n === 0 ? 240 : 330, {
                    border: (n === 0 ? '5px' : '2px') + ' solid ' + (n === 0 ? '#ffd27a' : '#ff8a5b'),
                    opacity: 0.95
                });
                gsap.to(onda, {
                    scale: 1, opacity: 0,
                    duration: 0.55, delay: ritardo, ease: 'power3.out',
                    onComplete: () => onda.remove()
                });
            });

            // NIENTE FRAMMENTI VOLANTI. Il primo tentativo ne spargeva
            // nove, colorati e rotanti: letti a schermo sembravano
            // coriandoli, non una carta che esplode — segnalato
            // dall'utente, e aveva ragione. L'esplosione si fa con luce,
            // fumo e scossa, non con pezzi che schizzano.

            // Nucleo incandescente: piccolo, violentissimo, dura un
            // istante. E' quello che da' il "botto".
            const nucleo = fxLayer('fx-gsap-destroy-core', c.x, c.y);
            cerchioCheCresce(nucleo, 30, c.rect.width * 2.2, {
                background: 'radial-gradient(circle, #ffffff 0%, #fff3c4 40%, rgba(255,190,90,0) 70%)',
                opacity: 1
            });
            gsap.timeline({ onComplete: () => nucleo.remove() })
                .to(nucleo, { scale: 1, duration: 0.13, ease: 'power4.out' })
                .to(nucleo, { opacity: 0, duration: 0.22, ease: 'power2.out' }, 0.08);

            // Fumo che sale e si allarga: quello che resta DOPO il botto,
            // e che fa sembrare l'esplosione una cosa con un peso.
            for (let i = 0; i < 4; i++) {
                const sbuffo = fxLayer('fx-gsap-destroy-smoke', c.x + (Math.random() * 40 - 20), c.y + (Math.random() * 24 - 12), 46, 46);
                gsap.set(sbuffo, {
                    xPercent: -50, yPercent: -50, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(60,50,46,0.75) 0%, rgba(40,34,32,0.4) 45%, rgba(0,0,0,0) 72%)',
                    opacity: 0, scale: 0.5
                });
                gsap.timeline({ onComplete: () => sbuffo.remove() })
                    .to(sbuffo, { opacity: 0.85, scale: 1.1, duration: 0.16, delay: 0.06 + i * 0.04, ease: 'power2.out' })
                    .to(sbuffo, { y: '-=46', scale: 2.3, opacity: 0, duration: 0.85, ease: 'power1.out' });
            }

            // Scossa del campo: un'esplosione si sente anche nella
            // cornice, non solo dove e' avvenuta.
            const campo = document.querySelector('.game-container');
            if (campo) {
                gsap.timeline()
                    .to(campo, { x: -6, duration: 0.045, ease: 'none' })
                    .to(campo, { x: 5, duration: 0.05 })
                    .to(campo, { x: -3, duration: 0.05 })
                    .to(campo, { x: 0, duration: 0.07, ease: 'power2.out', clearProps: 'transform' });
            }

            if (typeof FX.spawnParticles === 'function') {
                // Due ondate invece di una: la prima secca e veloce, la
                // seconda piu' lenta e pesante, come braci che ricadono.
                FX.spawnParticles(c.x, c.y, { count: 44, colors: ['#fff3c4', '#ffdf8c', '#ffffff'], speed: 11, life: 520, size: 4, gravity: 0.05 });
                setTimeout(() => {
                    FX.spawnParticles(c.x, c.y, { count: 26, colors: ['#e74c3c', '#c2560f', '#ffb36b'], speed: 4.5, life: 900, size: 3, gravity: 0.3 });
                }, 110);
            }
        },

        /**
         * Pescata: una carta COPERTA vola dal mazzo fino al posto che
         * occupera' in mano, e svanisce nell'istante in cui quella vera
         * compare. E' la pescata che mancava — prima il mazzo restava
         * fermo e la carta si materializzava in mano dal nulla.
         *
         * REGOLA DA NON VIOLARE: qui NON si tocca `cardElement`. Tutti e
         * tre i chiamanti (js/engine/game-flow.js) le mettono la classe
         * `.deal-in` un istante PRIMA di chiamarci, cioe' la keyframe CSS
         * `handDealIn` che la fa entrare da destra. Scrivere un transform
         * sullo stesso elemento vuol dire litigare con quella keyframe, ed
         * era esattamente il movimento sbagliato che si vedeva: due
         * animazioni sulla stessa carta che si sovrascrivevano a vicenda.
         * Si anima solo un elemento nostro, sopra a tutto; la carta vera
         * resta libera di fare la sua entrata di sempre.
         */
        playDrawEffect: function (cardElement) {
            if (!cardElement) return;
            const arrivo = cardElement.getBoundingClientRect();
            if (!arrivo.width) return;

            // Il mazzo e' uno slot del Terreno con data-zone="deck"
            // (vedi renderFields in js/engine/game-flow.js).
            const mazzo = document.querySelector('#playerFieldBoard .field-slot[data-zone="deck"]')
                || document.querySelector('.field-slot[data-zone="deck"]');
            if (!mazzo) return;
            const partenza = mazzo.getBoundingClientRect();
            if (!partenza.width) return;

            const volante = fxLayer('fx-gsap-draw-card', partenza.left, partenza.top, partenza.width, partenza.height);
            gsap.set(volante, {
                zIndex: 10040,
                borderRadius: getComputedStyle(cardElement).borderRadius || '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.55), 0 0 18px rgba(125,211,252,0.45)',
                rotation: -10
            });

            // Il mazzo REAGISCE alla partenza: un bagliore breve sul
            // bordo della pila, cosi' si capisce da dove arriva la carta
            // invece di vederla sbucare dal nulla.
            //
            // Su uno strato usa-e-getta sovrapposto, NON sullo slot vero:
            // renderFields() ricostruisce l'intero Terreno ad ogni
            // updateUI() (circa una volta al secondo in un duello vero),
            // quindi un tween scritto sullo slot verrebbe buttato via a
            // meta' insieme all'elemento. Stesso principio per cui gli
            // ologrammi vivono su un livello tutto loro.
            const bagliore = fxLayer('fx-gsap-deck-pulse', partenza.left, partenza.top, partenza.width, partenza.height);
            gsap.set(bagliore, {
                zIndex: 10039,
                borderRadius: getComputedStyle(cardElement).borderRadius || '6px',
                boxShadow: '0 0 0 2px rgba(125,211,252,0.9), 0 0 26px 6px rgba(125,211,252,0.55)',
                opacity: 0
            });
            gsap.timeline({ onComplete: () => bagliore.remove() })
                .to(bagliore, { opacity: 1, duration: 0.09, ease: 'power2.out' })
                .to(bagliore, { opacity: 0, duration: 0.34, ease: 'power2.in' });

            // Stessa durata della keyframe d'ingresso della carta (300ms):
            // la carta coperta "diventa" quella scoperta senza stacco.
            gsap.timeline({ onComplete: () => volante.remove() })
                .to(volante, {
                    left: arrivo.left, top: arrivo.top,
                    width: arrivo.width, height: arrivo.height,
                    rotation: 0, duration: 0.3, ease: 'power2.inOut'
                })
                .to(volante, { opacity: 0, duration: 0.12, ease: 'power1.in' }, 0.22);

            // NIENTE particelle qui: erano state provate e scartate
            // dall'utente. Pescare una carta e' un gesto asciutto, non
            // un'esplosione — scintille e polvere intorno al mazzo non
            // raccontano nulla e sporcano l'angolo del campo.
        },

        /**
         * CONVERGENZA ELEMENTALE (Evocazione di Livello 7+ senza filmato
         * dedicato) — la sequenza che si vede piu' spesso in un duello
         * vero, quindi quella che vale di piu' rifare bene.
         *
         * Rispetto alla versione CSS: il rituale avviene su un PIANO
         * inclinato attorno al mostro (due anelli in prospettiva che
         * ruotano in versi opposti e si stringono), l'energia arriva da
         * FUORI campo in profondita' invece che da raggi piatti, e il
         * mostro stesso si solleva dal piano prima di assestarsi.
         *
         * VINCOLO DI DURATA: deve restare dentro ELEMENTAL_CONVERGENCE_MS
         * (4000ms, js/ui/effects.js) — e' il tempo che il motore aspetta
         * prima di lasciar proseguire il duello (FX.isCinematicPlaying /
         * waitForSummonCinematics in js/ai/bot.js). Sforare lascerebbe
         * l'animazione a schermo a duello gia' ripartito.
         *
         * `theme` e' lo stesso oggetto della versione di base
         * (bright/mid/midSoft/deep/particleColors), scelto per Attributo.
         */
        playElementalConvergence: function (monsterElement, card, theme) {
            if (!monsterElement || !theme) return;
            const c = centerOf(monsterElement);
            const W = window.innerWidth;
            const H = window.innerHeight;

            // 1) La scena si oscura e si tinge dell'Attributo.
            const fondale = fxLayer('fx-gsap-conv-backdrop', 0, 0, W, H);
            gsap.set(fondale, {
                zIndex: 10040,
                background: `radial-gradient(circle at ${(c.x / W) * 100}% ${(c.y / H) * 100}%, ${theme.midSoft} 0%, rgba(0,0,0,0.86) 55%, rgba(0,0,0,0.95) 100%)`,
                opacity: 0
            });
            gsap.timeline({ onComplete: () => fondale.remove() })
                .to(fondale, { opacity: 1, duration: 0.5, ease: 'power2.out' })
                .to(fondale, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 3.3);

            // 2) Due anelli rituali su un piano inclinato: girano in versi
            // opposti e si stringono sul mostro mentre la carica sale.
            [0, 1].forEach((k) => {
                const anello = fxLayer('fx-gsap-conv-ring', c.x, c.y, 460, 460);
                gsap.set(anello, {
                    zIndex: 10041, xPercent: -50, yPercent: -50, borderRadius: '50%',
                    border: `${k === 0 ? 4 : 2}px solid ${k === 0 ? theme.bright : theme.mid}`,
                    boxShadow: `0 0 34px ${theme.mid}, inset 0 0 26px ${theme.midSoft}`,
                    transformPerspective: 1000,
                    rotationX: 70 + k * 6,
                    rotationZ: k * 40,
                    scale: 0.2, opacity: 0
                });
                gsap.timeline({ onComplete: () => anello.remove() })
                    .to(anello, { opacity: 0.95, scale: 1, duration: 0.7, ease: 'expo.out' }, k * 0.12)
                    .to(anello, { rotationZ: (k === 0 ? 1 : -1) * 540, duration: 2.3, ease: 'power2.in' }, 0)
                    .to(anello, { scale: 0.28, opacity: 0, duration: 0.45, ease: 'power3.in' }, 2.1);
            });

            // 3) Schegge di energia che arrivano dal fondo della scena: non
            // raggi piatti sul piano dello schermo, ma frammenti che
            // "sbucano" da lontano e accelerano verso il mostro.
            const SCHEGGE = 14;
            for (let i = 0; i < SCHEGGE; i++) {
                const ang = (Math.PI * 2 / SCHEGGE) * i + Math.random() * 0.4;
                const dist = Math.max(W, H) * 0.55;
                const sx = c.x + Math.cos(ang) * dist;
                const sy = c.y + Math.sin(ang) * dist;
                const scheggia = fxLayer('fx-gsap-conv-shard', sx, sy, 120, 4);
                gsap.set(scheggia, {
                    zIndex: 10042, xPercent: -50, yPercent: -50, borderRadius: '2px',
                    background: `linear-gradient(90deg, rgba(255,255,255,0), ${theme.bright})`,
                    boxShadow: `0 0 14px ${theme.mid}`,
                    rotation: (ang * 180 / Math.PI) + 180,
                    transformPerspective: 900,
                    scale: 0.2, opacity: 0
                });
                gsap.timeline({ onComplete: () => scheggia.remove() })
                    .to(scheggia, { opacity: 1, scale: 1, duration: 0.18 }, 0.35 + i * 0.055)
                    .to(scheggia, {
                        x: (c.x - sx), y: (c.y - sy), scale: 0.25, opacity: 0,
                        duration: 0.5, ease: 'power3.in'
                    }, 0.4 + i * 0.055);
            }

            // 4) Il mostro si carica e si SOLLEVA dal piano, poi si assesta.
            //    Niente overshoot: sale e si posa, non rimbalza.
            gsap.timeline()
                .fromTo(monsterElement,
                    { transformPerspective: 900, rotationX: 0, y: 0, scale: 1 },
                    Object.assign({ rotationX: -16, y: -18, scale: 1.1, filter: `brightness(1.9) drop-shadow(0 0 26px ${theme.bright})`, duration: 1.8, ease: 'power2.in' }, SU_CARTA))
                .to(monsterElement, { rotationX: 0, y: 0, scale: 1, filter: 'brightness(1)', duration: 0.75, ease: 'expo.out' }, 2.3)
                .to(monsterElement, PULIZIA, 3.2);

            // 5) Culmine: lampo, onda d'urto sul piano, scossa, particelle.
            gsap.delayedCall(2.25, () => {
                const lampo = fxLayer('fx-gsap-conv-flash', 0, 0, W, H);
                gsap.set(lampo, { zIndex: 10045, background: theme.bright, opacity: 0 });
                gsap.timeline({ onComplete: () => lampo.remove() })
                    .to(lampo, { opacity: 0.85, duration: 0.09, ease: 'power2.out' })
                    .to(lampo, { opacity: 0, duration: 0.45, ease: 'power2.in' });

                const onda = fxLayer('fx-gsap-conv-shock', c.x, c.y);
                cerchioCheCresce(onda, 60, Math.max(W, 900), {
                    zIndex: 10044,
                    border: `3px solid ${theme.bright}`,
                    transformPerspective: 1000, rotationX: 72, opacity: 1
                });
                gsap.to(onda, {
                    scale: 1, opacity: 0,
                    duration: 0.75, ease: 'power2.out', onComplete: () => onda.remove()
                });

                const container = document.querySelector('.game-container') || document.body;
                gsap.timeline()
                    .to(container, { x: -10, duration: 0.05 })
                    .to(container, { x: 8, duration: 0.06 })
                    .to(container, { x: -5, duration: 0.06 })
                    .to(container, { x: 0, duration: 0.1, ease: 'power2.out', clearProps: 'transform' });

                if (typeof FX.spawnParticles === 'function') {
                    FX.spawnParticles(c.x, c.y, { count: 46, colors: theme.particleColors, speed: 9, life: 780, size: 3, spread: 360 });
                }
            });

            // 6) Cartiglio col nome: entra ruotando di taglio e si presenta
            //    frontale, poi svanisce dentro il budget dei 4 secondi.
            gsap.delayedCall(2.5, () => {
                const banner = fxLayer('fx-gsap-conv-banner', W / 2, H * 0.3);
                banner.textContent = ((card && card.name) || 'Evocazione').toUpperCase();
                gsap.set(banner, {
                    zIndex: 10046, xPercent: -50, yPercent: -50,
                    whiteSpace: 'nowrap',
                    fontWeight: 900, letterSpacing: '3px',
                    fontSize: 'clamp(1.1rem, 4.2vw, 2.4rem)',
                    color: '#fff',
                    textShadow: `0 0 18px ${theme.bright}, 0 0 40px ${theme.mid}, 0 3px 8px rgba(0,0,0,0.9)`,
                    transformPerspective: 900, rotationY: -80, scale: 0.9, opacity: 0
                });
                gsap.timeline({ onComplete: () => banner.remove() })
                    .to(banner, { rotationY: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out' })
                    .to(banner, { scale: 1.04, duration: 0.5, ease: 'sine.inOut' })
                    .to(banner, { rotationY: 70, scale: 0.92, opacity: 0, duration: 0.38, ease: 'power2.in' });
            });
        },

        /**
         * BUCO NERO — singolarita' vera, in 3D.
         *
         * Rispetto alla versione precedente (un cerchio piatto che si
         * allargava, con le carte a spirale): ora c'e' un disco di
         * accrescimento inclinato in prospettiva (rotateX), un orizzonte
         * degli eventi nero che lo buca al centro, una lente che distorce
         * quello che c'e' dietro e un'onda d'urto finale quando il vortice
         * collassa. Le carte non spiraleggiano soltanto: si INCLINANO verso
         * il piano del disco mentre cadono dentro, cosi' sembrano risucchiate
         * SOTTO invece che scivolare sullo schermo.
         */
        playDarkHoleVortex: function (sucked) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const DURATA = 2.25;

            // Oscuramento della scena: il buco nero si mangia anche la luce.
            const buio = fxLayer('fx-gsap-darkhole-dim', 0, 0, window.innerWidth, window.innerHeight);
            gsap.set(buio, { zIndex: 10048, background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.96) 0%, rgba(8,0,20,0.76) 34%, rgba(22,5,45,0.36) 58%, rgba(0,0,0,0) 82%)', opacity: 0, backdropFilter: 'blur(0px) saturate(1)' });
            gsap.timeline({ onComplete: () => buio.remove() })
                .to(buio, { opacity: 1, backdropFilter: 'blur(3px) saturate(.45)', duration: 0.42, ease: 'power2.out' })
                .to(buio, { opacity: 0, backdropFilter: 'blur(0px) saturate(1)', duration: 0.5, ease: 'power3.in' }, DURATA - 0.38);

            // Lente gravitazionale: comprime otticamente il tavolo attorno
            // alla singolarita' e pulsa mentre il vortice acquista massa.
            const lente = fxLayer('fx-gsap-darkhole-lens', cx, cy, 720, 720);
            gsap.set(lente, {
                zIndex: 10049, xPercent: -50, yPercent: -50, borderRadius: '50%',
                border: '2px solid rgba(218,172,255,.52)',
                boxShadow: 'inset 0 0 90px 24px rgba(98,34,160,.38), 0 0 80px 12px rgba(154,76,230,.3)',
                backdropFilter: 'blur(4px) contrast(1.28)',
                transformPerspective: 1000, rotationX: 67, scale: 0.04, opacity: 0
            });
            gsap.timeline({ onComplete: () => lente.remove() })
                .to(lente, { scale: 1, opacity: .86, duration: .62, ease: 'expo.out' })
                .to(lente, { scale: 1.09, opacity: .48, duration: .7, ease: 'sine.inOut', yoyo: true, repeat: 1 })
                .to(lente, { scale: .02, opacity: 0, duration: .22, ease: 'power4.in' }, DURATA - .22);

            // Disco di accrescimento: un anello spesso schiacciato in
            // prospettiva (rotateX ~72°) che gira sempre piu' veloce.
            const disco = fxLayer('fx-gsap-darkhole-disc', cx, cy, 590, 590);
            gsap.set(disco, {
                zIndex: 10050, xPercent: -50, yPercent: -50, borderRadius: '50%',
                background: 'repeating-conic-gradient(from 0deg, rgba(89,25,160,0) 0deg 12deg, rgba(207,118,255,.92) 20deg 34deg, rgba(255,205,139,.98) 43deg 50deg, rgba(112,33,210,.62) 61deg 78deg, rgba(89,25,160,0) 90deg 108deg)',
                filter: 'blur(5px) brightness(1.2)',
                boxShadow: '0 0 65px 18px rgba(139,56,227,.5), inset 0 0 42px rgba(255,205,150,.55)',
                transformPerspective: 900, rotationX: 72, rotationZ: 0,
                scale: 0.15, opacity: 0
            });
            gsap.timeline({ onComplete: () => disco.remove() })
                .to(disco, { opacity: 1, scale: 1, duration: 0.52, ease: 'expo.out' })
                .to(disco, { rotationZ: 1440, duration: DURATA, ease: 'power2.in' }, 0)
                .to(disco, { rotationX: 84, duration: DURATA, ease: 'power1.in' }, 0)
                .to(disco, { scale: 0.05, opacity: 0, duration: 0.35, ease: 'power3.in' }, DURATA - 0.3);

            // Orizzonte degli eventi: il nero assoluto al centro del disco,
            // con un sottile anello di luce (photon ring) sul bordo.
            const orizzonte = fxLayer('fx-gsap-darkhole-core', cx, cy, 178, 178);
            gsap.set(orizzonte, {
                zIndex: 10051, xPercent: -50, yPercent: -50, borderRadius: '50%',
                background: 'radial-gradient(circle, #000 58%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0) 74%)',
                boxShadow: '0 0 0 3px rgba(255,225,174,.9), 0 0 18px 7px rgba(255,174,113,.72), 0 0 62px 22px rgba(140,60,220,.72)',
                scale: 0, opacity: 1
            });
            gsap.timeline({ onComplete: () => orizzonte.remove() })
                .to(orizzonte, { scale: 1, duration: 0.4, ease: 'expo.out' })
                .to(orizzonte, { scale: 1.12, duration: DURATA - 0.7, ease: 'sine.inOut' })
                // Collasso + onda d'urto: sparisce in un lampo, non sfuma.
                .to(orizzonte, { scale: 0, duration: 0.18, ease: 'power4.in' });

            // Tre orbite irregolari e frammenti luminosi danno scala e
            // profondita': non sono cerchi decorativi fermi, ma materia
            // che accelera e scompare sotto il disco.
            [0, 1, 2].forEach((n) => {
                const size = 300 + n * 112;
                const orbita = fxLayer('fx-gsap-darkhole-orbit', cx, cy, size, size * .42);
                gsap.set(orbita, {
                    zIndex: 10050, xPercent: -50, yPercent: -50, borderRadius: '50%',
                    border: `${3 - n * .55}px solid rgba(${220 - n * 22}, ${148 - n * 26}, 255, ${.74 - n * .13})`,
                    borderLeftColor: 'transparent', borderBottomColor: 'rgba(255,196,132,.2)',
                    filter: `blur(${n * .7}px) drop-shadow(0 0 8px rgba(192,105,255,.8))`,
                    transformPerspective: 1000, rotationX: 61 + n * 6, rotationZ: n * 43,
                    scale: .08, opacity: 0
                });
                gsap.timeline({ onComplete: () => orbita.remove() })
                    .to(orbita, { scale: 1, opacity: 1, duration: .4 + n * .08, ease: 'expo.out' })
                    .to(orbita, { rotationZ: (n % 2 ? -1 : 1) * (720 + n * 260), scale: .2, duration: DURATA - .22, ease: 'power3.in' }, 0)
                    .to(orbita, { opacity: 0, duration: .18 }, DURATA - .18);
            });

            for (let i = 0; i < 22; i++) {
                const angle = (Math.PI * 2 * i / 22) + (i % 3) * .11;
                const radius = 260 + (i % 5) * 48;
                const mote = fxLayer('fx-gsap-darkhole-mote', cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 3 + (i % 4), 3 + (i % 4));
                gsap.set(mote, { zIndex: 10051, borderRadius: '50%', background: i % 3 ? '#d59aff' : '#ffd19a', boxShadow: '0 0 9px currentColor', opacity: 0 });
                gsap.to(mote, { opacity: .95, duration: .18, delay: .12 + (i % 6) * .025 });
                const state = { a: angle, r: radius };
                gsap.to(state, {
                    a: angle + Math.PI * (4.2 + (i % 3) * .45), r: 0,
                    duration: 1.45 + (i % 5) * .075, delay: .18, ease: 'power3.in',
                    onUpdate: () => {
                        mote.style.left = (cx + Math.cos(state.a) * state.r) + 'px';
                        mote.style.top = (cy + Math.sin(state.a) * state.r) + 'px';
                        gsap.set(mote, { scale: Math.max(.08, state.r / radius) });
                    },
                    onComplete: () => mote.remove()
                });
            }

            // Onda d'urto del collasso.
            gsap.delayedCall(DURATA - 0.12, () => {
                const onda = fxLayer('fx-gsap-darkhole-shock', cx, cy);
                cerchioCheCresce(onda, 60, Math.max(window.innerWidth, 900), {
                    zIndex: 10052,
                    border: '3px solid rgba(210,160,255,0.9)', opacity: 1,
                    transformPerspective: 900, rotationX: 70
                });
                gsap.to(onda, {
                    scale: 1,
                    opacity: 0, duration: 0.55, ease: 'power2.out',
                    onComplete: () => onda.remove()
                });
                if (typeof FX.spawnParticles === 'function') {
                    FX.spawnParticles(cx, cy, { count: 34, speed: 9, life: 620, size: 3, spread: 360, colors: ['#c586ff', '#ffb478', '#ffffff'] });
                }
                const container = document.querySelector('.game-container') || document.body;
                gsap.timeline()
                    .to(container, { scale: 1.012, x: -8, duration: .055 })
                    .to(container, { x: 7, y: 4, duration: .055 })
                    .to(container, { x: -4, y: -3, duration: .055 })
                    .to(container, { scale: 1, x: 0, y: 0, duration: .14, clearProps: 'transform' });
            });

            if (window.SFX && typeof SFX.darkHole === 'function') SFX.darkHole();

            if (!Array.isArray(sucked) || typeof window.createCardElement !== 'function') return;
            sucked.forEach(({ card, rect }, i) => {
                if (!card || !rect || rect.width === 0) return;
                const fantasma = window.createCardElement(card);
                Object.assign(fantasma.style, {
                    position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
                    width: rect.width + 'px', height: rect.height + 'px',
                    margin: '0', zIndex: '10053', pointerEvents: 'none'
                });
                document.body.appendChild(fantasma);

                const px = rect.left + rect.width / 2;
                const py = rect.top + rect.height / 2;
                const angoloIniziale = Math.atan2(py - cy, px - cx);
                const raggio = Math.hypot(px - cx, py - cy);
                const ritardo = 0.28 + i * 0.035;
                // La spirale vera: angolo che avanza e raggio che si
                // stringe, aggiornati insieme — una retta sola non
                // racconterebbe il risucchio.
                const stato = { ang: angoloIniziale, r: raggio };
                gsap.to(stato, {
                    ang: angoloIniziale + Math.PI * 3.7,
                    r: 0,
                    duration: 1.35,
                    delay: ritardo,
                    ease: 'power3.in',
                    onUpdate: () => {
                        fantasma.style.left = (cx + Math.cos(stato.ang) * stato.r - rect.width / 2) + 'px';
                        fantasma.style.top = (cy + Math.sin(stato.ang) * stato.r - rect.height / 2) + 'px';
                    },
                    onComplete: () => fantasma.remove()
                });
                // ...e mentre cade si corica sul piano del disco (rotationX
                // verso 78°) girando su se stessa: e' questo a farla sembrare
                // inghiottita SOTTO, non spinta di lato.
                gsap.to(fantasma, {
                    transformPerspective: 800,
                    rotationX: 78,
                    rotationZ: (i % 2 === 0 ? 1 : -1) * 420,
                    scale: 0.04,
                    opacity: 0,
                    duration: 1.35, delay: ritardo, ease: 'power3.in'
                });
            });
        },

        /**
         * SPADE RIVELATRICI — pioggia di lame di luce in 3D.
         *
         * La versione di base fa scendere delle barre luminose con una
         * transizione CSS su `top`. Qui ogni spada e' una vera lama che
         * arriva dall'alto RUOTATA nello spazio (rotationX/rotationY/
         * rotationZ) e si raddrizza piantandosi sul campo, con un lampo
         * d'impatto e una scossa quando l'ultima atterra.
         *
         * Il contratto con il chiamante resta identico a quello della
         * versione di base (vedi playSwordsOfRevealingLight in
         * js/ui/effects.js): le spade NON spariscono da sole — `onLanded`
         * riceve la funzione che le rimuove, e il chiamante la invoca
         * DOPO aver ridisegnato il campo con i segni fissi.
         */
        /**
         * RAIGEKI — la fila e' investita da cinque fulmini in profondita'.
         * Ogni slot viene colpito anche se vuoto; `onImpact` scatta solo
         * sul lampo conclusivo, quando la logica puo' distruggere i mostri.
         */
        playRaigeki: function (owner, onImpact) {
            const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
            const slots = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"]`));
            if (!slots.length) { if (typeof onImpact === 'function') onImpact(); return; }

            const rects = slots.map((slot) => slot.getBoundingClientRect());
            const center = (rects.length - 1) / 2;
            const order = rects.map((_, i) => i).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
            const rowLeft = Math.min(...rects.map((r) => r.left));
            const rowRight = Math.max(...rects.map((r) => r.right));
            const rowBottom = Math.max(...rects.map((r) => r.bottom));
            const storm = fxLayer('fx-raigeki-storm', rowLeft - 80, 0, rowRight - rowLeft + 160, rowBottom + 30);
            storm.style.animation = 'none';
            gsap.set(storm, { opacity: 0, zIndex: 10043, transformPerspective: 1000, rotationX: -5 });
            gsap.to(storm, { opacity: 1, duration: 0.22, ease: 'power2.out' });
            if (window.SFX && typeof SFX.raigeki === 'function') SFX.raigeki();

            order.forEach((slotIndex, sequence) => {
                const rect = rects[slotIndex];
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height * 0.52;
                const bolt = fxLayer('fx-raigeki-bolt', x, 0, 52, Math.max(120, y));
                bolt.style.animation = 'none';
                bolt.innerHTML = '<span class="fx-raigeki-core"></span><span class="fx-raigeki-branch fx-raigeki-branch-a"></span><span class="fx-raigeki-branch fx-raigeki-branch-b"></span>';
                gsap.set(bolt, {
                    xPercent: -50, opacity: 0, scaleY: 0.03, zIndex: 10051,
                    transformOrigin: '50% 0%', transformPerspective: 900,
                    rotationY: (slotIndex - center) * 4, rotationZ: (sequence % 2 ? 2.5 : -2.5)
                });
                const delay = 0.25 + sequence * 0.075;
                gsap.timeline({ delay, onComplete: () => bolt.remove() })
                    .to(bolt, { opacity: 1, scaleY: 1, duration: 0.075, ease: 'power4.in' })
                    .to(bolt, { x: 4, opacity: 0.28, duration: 0.045 })
                    .to(bolt, { x: -3, opacity: 1, duration: 0.045 })
                    .to(bolt, { x: 0, opacity: 0, duration: 0.28, ease: 'power2.out' });

                gsap.delayedCall(delay + 0.075, () => {
                    const hit = fxLayer('fx-raigeki-impact', x, y, rect.width * 1.7, rect.height * 1.25);
                    hit.style.animation = 'none';
                    gsap.set(hit, { xPercent: -50, yPercent: -50, scale: 0.12, opacity: 1, zIndex: 10050, transformPerspective: 700, rotationX: 64 });
                    gsap.to(hit, { scale: 1.45, opacity: 0, duration: 0.5, ease: 'power3.out', onComplete: () => hit.remove() });
                    if (typeof FX.spawnParticles === 'function') {
                        FX.spawnParticles(x, y, { count: 16, speed: 7, life: 470, size: 2.8, spread: 210, colors: ['#ffffff', '#bdf6ff', '#fff65c', '#69bfff'] });
                    }
                });
            });

            const finalAt = 0.25 + (rects.length - 1) * 0.075 + 0.09;
            gsap.delayedCall(finalAt, () => {
                storm.classList.add('fx-raigeki-storm-impact');
                const container = document.querySelector('.game-container') || document.body;
                gsap.timeline()
                    .to(container, { x: -6, y: 3, duration: 0.045 })
                    .to(container, { x: 5, y: -3, duration: 0.045 })
                    .to(container, { x: -3, y: 1, duration: 0.045 })
                    .to(container, { x: 0, y: 0, duration: 0.09, clearProps: 'transform' });
                if (typeof onImpact === 'function') onImpact();
            });
            gsap.delayedCall(finalAt + 0.7, () => storm.remove());
        },

        // (Spade Rivelatrici: solo WebGL, js/ui/fx-webgl.js; qui non c'e' piu' una versione GSAP.)

        /**
         * Lancio della moneta: gira davvero su se stessa in prospettiva e
         * rallenta fino a fermarsi, invece di ruotare a velocita' costante
         * per un tempo fisso. Durata complessiva invariata (~1.7s): i
         * chiamanti non aspettano questa animazione, ma tanto vale non
         * allungarle la vita sullo schermo.
         */
        playCoinFlip: function (heads) {
            const backdrop = fxBackdrop('fx-randomizer-backdrop');
            const moneta = document.createElement('div');
            moneta.className = 'fx-coinflip-coin';
            moneta.textContent = '🪙';
            const etichetta = document.createElement('div');
            etichetta.className = 'fx-coinflip-label';
            etichetta.textContent = heads ? 'TESTA' : 'CROCE';
            backdrop.appendChild(moneta);
            backdrop.appendChild(etichetta);

            gsap.set(backdrop, { perspective: 900 });
            gsap.set(moneta, { transformStyle: 'preserve-3d' });
            gsap.set(etichetta, { opacity: 0, scale: 0.6 });

            gsap.timeline()
                .fromTo(moneta, { y: 40, scale: 0.7 }, { y: -30, scale: 1.15, duration: 0.4, ease: 'power2.out' })
                // Atterra e si ferma: niente rimbalzo (preferenza esplicita
                // dell'utente per ogni atterraggio in 3D del duello).
                .to(moneta, { y: 0, scale: 1, duration: 0.45, ease: 'power3.out' })
                // 5 giri che rallentano: il risultato compare a rotazione
                // quasi ferma, come se fosse la moneta a deciderlo.
                .to(moneta, { rotationX: 1800, duration: 1.0, ease: 'power3.out' }, 0)
                .call(() => { moneta.textContent = heads ? '☀️' : '🌑'; }, null, 0.95)
                .to(etichetta, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, 1.0)
                .to(backdrop, { opacity: 0, duration: 0.25, onComplete: () => backdrop.remove() }, 1.45);
        },

        /**
         * Attivazione di Magia/Trappola a centro schermo. E' l'animazione
         * piu' vista del duello (18 punti di chiamata: ogni singola
         * attivazione), e ha tre vincoli che NON vanno persi riscrivendola:
         *
         * 1. DEVE stare dentro FX.ACTIVATE_CENTER_DURATION_MS (2s). I
         *    chiamanti non aspettano una callback: aspettano quel tempo e
         *    tirano dritto. Sforare vuol dire una carta che resta a
         *    schermo mentre il gioco e' gia' andato avanti.
         * 2. La carta deve essere GIA' al centro a ~260ms: a quell'istante
         *    i preset di VisualEffects leggono il rettangolo del wrapper
         *    per far partire le particelle, e parte anche il suono. Se
         *    arrivasse piu' tardi, le particelle scoppierebbero dove la
         *    carta non e' ancora.
         * 3. Il preset scrive `filter` sulla CARTA; questa timeline anima
         *    il `filter` del WRAPPER. Sono due elementi diversi apposta —
         *    animare quello della carta cancellerebbe il glow del preset.
         *
         * Per il resto la struttura DOM e' identica a quella di base
         * (stesse classi, stesso ordine, stesso blocco audio): cambia solo
         * chi muove il wrapper, GSAP al posto della keyframe CSS, che viene
         * spenta con `animation: none` per non farle litigare.
         */
        playCardActivateCenterScreen: function (card) {
            if (!card || typeof window.createCardElement !== 'function') return;

            const backdrop = fxBackdrop('fx-activate-center-backdrop');

            const wrapper = document.createElement('div');
            wrapper.className = 'fx-activate-center-card';
            const cardEl = window.createCardElement(card);
            cardEl.style.setProperty('--card-w', 'clamp(160px, 22vw, 260px)');
            cardEl.style.setProperty('--card-h', 'calc(clamp(160px, 22vw, 260px) / var(--card-ratio))');
            wrapper.appendChild(cardEl);
            document.body.appendChild(wrapper);

            // La keyframe CSS farebbe lo stesso lavoro di questa timeline,
            // in contemporanea: va spenta, o le due si sovrascrivono a
            // vicenda sul transform.
            wrapper.style.animation = 'none';
            // transformPerspective mette la carta in uno SPAZIO 3D vero:
            // senza, un rotationY sarebbe solo uno schiacciamento piatto.
            // La carta arriva quasi di taglio (-78 gradi) e ruota verso chi
            // guarda finche' non e' frontale — la rivelazione che una
            // semplice scalata non puo' dare.
            gsap.set(wrapper, {
                xPercent: -50, yPercent: -50, opacity: 0, scale: 0.35,
                transformPerspective: 1000, rotationY: -78, rotationX: 12, rotation: -8
            });

            // Anello di luce dietro la carta (z-index del backdrop, quindi
            // sotto al wrapper che sta a 10060).
            const anello = fxLayer('fx-gsap-activate-ring', window.innerWidth / 2, window.innerHeight / 2);
            const scalaAnello = cerchioCheCresce(anello, 40, 420, {
                zIndex: 10059,
                border: '2px solid rgba(247,215,116,0.85)',
                boxShadow: '0 0 40px rgba(247,215,116,0.5), inset 0 0 30px rgba(247,215,116,0.35)',
                opacity: 0
            });

            // Stesso ordine della versione di base: il preset va applicato
            // subito dopo aver messo la carta nel documento.
            if (window.VisualEffects) VisualEffects.applyPreset(card, wrapper, cardEl);

            // NIENTE "battiti" di scala. La versione precedente faceva
            // 1.08 -> 1 -> 1.06 -> 1 -> 1.04 -> 1: tre andirivieni, che
            // l'occhio legge esattamente come un rimbalzo anche senza un
            // easing elastico — ed e' quello che l'utente ha respinto
            // ("c'e' ancora l'effetto bounce quando si attiva l'effetto di
            // una carta"). Il 3D resta, ma affidato a un movimento
            // CONTINUO e monotono: la carta ruota lentamente nello spazio
            // a scala FISSA, come un oggetto sospeso che si gira per farsi
            // guardare. Nessun valore torna mai indietro.
            gsap.timeline()
                // Ingresso: arriva quasi di taglio e si presenta frontale
                // entro 260ms (vincolo 2), fermandosi esattamente a scala 1
                // — nessun sorpasso da recuperare dopo.
                // L'ingresso si ferma gia' a -11 gradi, non a zero: e' da li'
                // che riparte la deriva subito dopo, senza alcuno scatto fra
                // le due fasi (fermarsi frontale e poi saltare a -11 sarebbe
                // uno strappo visibile). A 11 gradi la carta e' comunque
                // perfettamente leggibile.
                .to(wrapper, {
                    opacity: 1, scale: 1, rotation: 0, rotationY: -11, rotationX: 4,
                    filter: 'drop-shadow(0 0 26px rgba(247,215,116,0.8))',
                    duration: 0.26, ease: 'expo.out'
                })
                // Permanenza: una sola, lenta deriva rotazionale da -11 a
                // +11 gradi su Y (con un filo di X in controfase), a
                // velocita' costante. Un unico movimento dall'inizio alla
                // fine, mai una oscillazione avanti-indietro.
                .to(wrapper, { rotationY: 11, rotationX: -4, duration: 1.31, ease: 'none' }, 0.26)
                // Uscita: la carta se ne va INDIETRO nello spazio, girando
                // di taglio — non un ultimo ingrandimento verso chi guarda,
                // che sarebbe l'ennesimo scatto di scala. Chiusa a 1.95s,
                // dentro il budget di 2s (vincolo 1).
                .to(wrapper, { opacity: 0, scale: 0.84, rotationY: 62, duration: 0.38, ease: 'power2.in' }, 1.57)
                // L'anello si allarga sull'atterraggio e svanisce.
                .to(anello, { opacity: 1, scale: scalaAnello(300), duration: 0.4, ease: 'power3.out' }, 0.16)
                .to(anello, { opacity: 0, scale: 1, duration: 0.5, ease: 'power2.out' }, 0.56)
                .to(anello, { rotation: 180, duration: 1.2, ease: 'none' }, 0.16);

            // NIENTE riflesso che scorre sulla carta: era stato provato e
            // scartato dall'utente ("l'effetto di riflesso e' orrendo").
            // La carta si guarda per leggerla, e una striscia lucida che le
            // passa sopra copre proprio l'illustrazione e il testo.

            // Blocco audio IDENTICO a quello della versione di base: suono
            // dedicato alla carta se esiste, altrimenti quello standard.
            setTimeout(() => {
                const kind = card.type === 'trap' ? 'trappole' : 'magie';
                if (window.AudioLibrary && AudioLibrary.tryPlayCardSound(card, kind)) return;
                if (!window.SFX) return;
                if (card.type === 'trap') SFX.activateTrap();
                else SFX.activateSpell();
            }, 260);

            // Stessa rimozione a 2s della versione di base: e' il contratto
            // su cui contano i chiamanti.
            setTimeout(() => {
                backdrop.remove();
                wrapper.remove();
                anello.remove();
            }, 2000);
        },

        /** Dado: rotola su due assi e si assesta sul risultato, stesso impianto della moneta. */
        playDiceRoll: function (result) {
            const backdrop = fxBackdrop('fx-randomizer-backdrop');
            const dado = document.createElement('div');
            dado.className = 'fx-dice-cube';
            dado.textContent = '🎲';
            const etichetta = document.createElement('div');
            etichetta.className = 'fx-dice-label';
            etichetta.textContent = `RISULTATO: ${result}`;
            backdrop.appendChild(dado);
            backdrop.appendChild(etichetta);

            gsap.set(backdrop, { perspective: 900 });
            gsap.set(dado, { transformStyle: 'preserve-3d' });
            gsap.set(etichetta, { opacity: 0, y: 12 });

            gsap.timeline()
                // Come la moneta: atterra e si ferma, senza rimbalzi né scatti oltre il bersaglio.
                .fromTo(dado, { scale: 0.6, y: -50 }, { scale: 1, y: 0, duration: 0.5, ease: 'power3.out' })
                .to(dado, { rotationX: 1080, rotationY: 720, duration: 1.0, ease: 'power3.out' }, 0)
                .call(() => { dado.textContent = String(result); }, null, 0.95)
                .to(dado, { scale: 1.2, duration: 0.16, ease: 'power2.out' }, 0.95)
                .to(dado, { scale: 1, duration: 0.14 })
                .to(etichetta, { opacity: 1, y: 0, duration: 0.28 }, 1.05)
                .to(backdrop, { opacity: 0, duration: 0.25, onComplete: () => backdrop.remove() }, 1.45);
        }
    };

    FX.registerBackend('gsap', { requires: ['gsap'], impls: impls });

    // gsap.min.js arriva DOPO l'evento 'load' (caricamento pigro): al
    // momento della registrazione qui sopra il globale non esiste ancora,
    // quindi la facciata ha appena concluso che il backend non e'
    // utilizzabile. Va rivalutato quando la libreria atterra davvero —
    // niente polling: si guarda al primo frame utile dopo il 'load' e si
    // riprova qualche volta a intervalli crescenti, poi si lascia perdere.
    (function attendiGsap() {
        let tentativi = 0;
        function riprova() {
            if (window.gsap) { FX.refreshBackend(); return; }
            if (++tentativi > 12) return; // ~10s: se non e' arrivata, non arrivera'
            setTimeout(riprova, 200 * tentativi);
        }
        if (document.readyState === 'complete') riprova();
        else window.addEventListener('load', riprova, { once: true });
    })();
})();
