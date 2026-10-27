/**
 * effects.js — Motore effetti visivi in stile Yu-Gi-Oh! Master Duel
 * ---------------------------------------------------------------
 * Libreria PURAMENTE ADDITIVA: non legge né modifica gameState,
 * non tocca la logica di gioco. Espone window.FX con funzioni
 * riutilizzabili da chiamare nei punti giusti del codice esistente.
 *
 * Funzioni esposte:
 *   FX.playBattleDestroyEffect(cardElement)
 *   FX.playSummonShockwave(monsterElement)
 *   FX.playSummonCircle(monsterElement)
 *   FX.playElementalConvergence(monsterElement, card, theme)
 *   FX.playVideoOverlay(path, onDone)
 *   FX.playMonsterSummonEffect(card, monsterElement)
 *   FX.playInstantWinCinematic(kind, bannerText, pieceElements, onDone)
 *   FX.playDamageEffect(amount, { anchorEl })
 *   FX.playDrawEffect(cardElement)
 *   FX.playCardActivateEffect(cardElement)
 *   FX.playCardActivateCenterScreen(card)
 *   FX.playSwordsOfRevealingLight(owner)
 *   FX.playRaigeki(owner, onImpact)
 *   FX.playDarkHoleVortex(sucked)
 *   FX.playMirrorForce(attackerOwner)
 *   FX.playMagicCylinder(attackerOwner, attackerIndex, damagedOwner, damage)
 *   FX.playMonsterReborn(graveyardOwner, card, targetOwner, targetIndex, onImpact)
 *   FX.playTrapHole(owner, index, card)
 *   FX.playTorrentialTribute()
 *   FX.playRingOfDestruction(owner, index, damage)
 *   FX.playHeavyStorm(onImpact)
 *   FX.playMysticalSpaceTyphoon(owner, index, onImpact)
 *   FX.playMindControl(card, owner, index, mode)
 *   FX.playCallOfTheHaunted(owner, card, targetIndex, onImpact)
 *   FX.playBottomlessTrapHole(owner, index, card)
 *   FX.playSakuretsuArmor(owner, index)
 *   FX.playSolemnJudgment(owner, cost)
 *   FX.playBookOfMoon(owner, index, card)
 *   FX.playCrushCardVirus(owner, targetIndices)
 *   FX.playNegateAttack(attackerOwner, attackerIndex)
 *   FX.playScapegoat(owner, tokenIndices)
 *   FX.playMysticBox(destroyedTarget, offeredTarget)
 *   FX.playLimiterRemoval(owner, machineIndices)
 *   FX.playShadowSpell(owner, index)
 *   FX.playTributeSacrifice(cardElement)
 *   FX.spawnParticles(x, y, opts)
 */
(function () {
    'use strict';

    // ============================================================
    // Layer particellare condiviso (canvas fullscreen, no immagini)
    // ============================================================
    let fxCanvas = null;
    let fxCtx = null;
    let fxParticles = [];
    let fxRafId = null;

    function ensureCanvas() {
        if (fxCanvas) return;
        fxCanvas = document.createElement('canvas');
        fxCanvas.id = 'fxParticleCanvas';
        assegnaStile(fxCanvas.style, {
            position: 'fixed',
            inset: '0',
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: '10050'
        });
        document.body.appendChild(fxCanvas);
        fxCtx = fxCanvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        if (!fxCanvas) return;
        const dpr = window.devicePixelRatio || 1;
        fxCanvas.width = Math.round(window.innerWidth * dpr);
        fxCanvas.height = Math.round(window.innerHeight * dpr);
        fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Genera particelle energetiche in un punto dello schermo.
     * opts: { count, colors[], spread(deg), speed, life(ms), size, gravity, baseAngle(deg) }
     */
    function spawnParticles(x, y, opts = {}) {
        ensureCanvas();
        const count = opts.count ?? 24;
        const colors = opts.colors ?? ['#ffdf8c', '#f39c12', '#ffffff'];
        const spread = opts.spread ?? 360;
        const speed = opts.speed ?? 4;
        const life = opts.life ?? 600;
        const size = opts.size ?? 3;
        const gravity = opts.gravity ?? 0.05;
        const baseAngle = opts.baseAngle ?? -90;

        for (let i = 0; i < count; i++) {
            const angle = ((Math.random() * spread - spread / 2) + baseAngle) * (Math.PI / 180);
            const v = speed * (0.4 + Math.random() * 0.9);
            fxParticles.push({
                x, y,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life,
                size: size * (0.6 + Math.random() * 0.8),
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity,
                born: performance.now()
            });
        }
        runParticleLoop();
    }

    function runParticleLoop() {
        if (fxRafId) return;
        const step = (t) => {
            fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
            fxParticles = fxParticles.filter((p) => {
                const age = t - p.born;
                if (age > p.life) return false;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                const alpha = Math.max(1 - age / p.life, 0);
                fxCtx.globalAlpha = alpha;
                fxCtx.fillStyle = p.color;
                fxCtx.shadowColor = p.color;
                fxCtx.shadowBlur = 8;
                fxCtx.beginPath();
                fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                fxCtx.fill();
                return true;
            });
            fxCtx.globalAlpha = 1;
            fxCtx.shadowBlur = 0;
            fxRafId = fxParticles.length > 0 ? requestAnimationFrame(step) : null;
        };
        fxRafId = requestAnimationFrame(step);
    }

    function centerOf(el) {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
    }

    function spawnDomFx(className, x, y, w, h, life) {
        const el = document.createElement('div');
        el.className = className;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        if (w !== undefined) el.style.width = `${w}px`;
        if (h !== undefined) el.style.height = `${h}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), life);
        return el;
    }

    // ============================================================
    // 1) Distruzione carta in battaglia — esplosione + frammenti
    // ============================================================
    function playBattleDestroyEffect(cardElement) {
        if (!cardElement) return;
        const { x, y, rect } = centerOf(cardElement);

        cardElement.classList.add('fx-destroy-flash');
        setTimeout(() => cardElement.classList.remove('fx-destroy-flash'), 500);

        spawnDomFx('fx-destroy-rays', x, y, undefined, undefined, 550);
        spawnDomFx('fx-explosion-burst', x, y, undefined, undefined, 650);

        const shardCount = 6;
        for (let i = 0; i < shardCount; i++) {
            const angle = (360 / shardCount) * i + (Math.random() * 20 - 10);
            const dist = 50 + Math.random() * 40;
            const shard = document.createElement('div');
            shard.className = 'fx-shard';
            shard.style.left = `${x}px`;
            shard.style.top = `${y}px`;
            shard.style.width = `${rect.width * 0.28}px`;
            shard.style.height = `${rect.height * 0.28}px`;
            shard.style.setProperty('--fx-angle', `${angle}deg`);
            shard.style.setProperty('--fx-dist', `${dist}px`);
            document.body.appendChild(shard);
            setTimeout(() => shard.remove(), 700);
        }

        spawnParticles(x, y, { count: 32, colors: ['#ffdf8c', '#e74c3c', '#ffffff'], speed: 6.5, life: 650 });
    }

    /** Distruzione Magia/Trappola: frattura olografica, mai esplosiva. */
    function playSpellTrapDestroyEffect(card, owner, index, zone) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const type = zone === 'fieldSpell' ? 'field-spell' : 'st';
        const indexSelector = zone === 'fieldSpell' ? '' : `[data-index="${index}"]`;
        const source = document.querySelector(`#${boardId} .field-slot[data-type="${type}"]${indexSelector} .card`);
        if (!source) return false;
        const rect = source.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const kind = card && card.type === 'trap' ? 'trap' : 'spell';
        const scena = document.createElement('div');
        scena.className = `fx-st-shatter fx-st-shatter--${kind}` + (zone === 'fieldSpell' ? ' fx-st-shatter--field' : '');
        assegnaStile(scena.style, {
            left: rect.left + 'px', top: rect.top + 'px',
            width: rect.width + 'px', height: rect.height + 'px'
        });
        scena.style.setProperty('--fx-st-color', kind === 'trap' ? '#ef75cb' : '#55f2cf');
        const fantasma = source.cloneNode(true);
        fantasma.classList.add('fx-st-shatter-card');
        scena.appendChild(fantasma);
        const scan = document.createElement('i');
        scan.className = 'fx-st-shatter-scan';
        scena.appendChild(scan);
        for (let i = 0; i < 10; i++) {
            const shard = document.createElement('b');
            shard.className = 'fx-st-energy-shard';
            shard.style.left = ((i % 2) * 50) + '%';
            shard.style.top = (Math.floor(i / 2) * 20) + '%';
            shard.style.width = '50%';
            shard.style.height = '20%';
            shard.style.setProperty('--fx-st-dx', (Math.random() * 70 - 35) + 'px');
            shard.style.setProperty('--fx-st-dy', (-24 - Math.random() * 80) + 'px');
            shard.style.setProperty('--fx-st-rot', (Math.random() * 70 - 35) + 'deg');
            shard.style.animationDelay = (80 + i * 24) + 'ms';
            scena.appendChild(shard);
        }
        document.body.appendChild(scena);
        source.classList.add('fx-st-source-vanish');
        setTimeout(() => scena.remove(), 900);
        return true;
    }

    // ============================================================
    // 2) Mostro posizionato in attacco — shockwave + glow
    // ============================================================
    function playSummonShockwave(monsterElement) {
        if (!monsterElement) return;
        const { x, y } = centerOf(monsterElement);

        spawnDomFx('fx-shockwave-ring', x, y, undefined, undefined, 700);

        monsterElement.classList.add('fx-summon-glow');
        setTimeout(() => monsterElement.classList.remove('fx-summon-glow'), 800);

        spawnParticles(x, y, { count: 16, colors: ['#f7d774', '#3498db', '#ffffff'], speed: 3, life: 500, gravity: -0.02 });
    }

    // ============================================================
    // 3) Evocazione mostro — cerchio magico + flare
    // ============================================================
    function playSummonCircle(monsterElement) {
        if (!monsterElement) return;
        const { x, y, rect } = centerOf(monsterElement);
        const size = Math.max(rect.width, rect.height) * 2.6;

        const circle = document.createElement('div');
        circle.className = 'fx-summon-circle';
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;
        circle.style.width = `${size}px`;
        circle.style.height = `${size}px`;
        circle.innerHTML = '<div class="fx-summon-circle-ring fx-ring-outer"></div><div class="fx-summon-circle-ring fx-ring-inner"></div>';
        document.body.appendChild(circle);
        setTimeout(() => circle.remove(), 900);

        spawnDomFx('fx-summon-flare', x, y, undefined, undefined, 600);
    }

    /**
     * Una carta appena SETTATA coperta si "posa" sul Terreno: un velo di
     * polvere alla base e qualche granello che salta.
     *
     * Prima di questa, piazzare una carta coperta non aveva alcun segnale
     * visivo — la carta compariva e basta, e dal lato del bot nemmeno il
     * volo dalla mano. E' l'azione piu' frequente di un duello dopo
     * l'Evocazione, quindi valeva la pena darle un peso.
     *
     * DELIBERATAMENTE SOBRIA, e nessuna animazione sulla CARTA: settare e'
     * un gesto nascosto, non un colpo di scena — e la carta viene comunque
     * ricostruita dal primo render successivo (renderFields rifa' tutto il
     * Terreno), quindi un tween scritto su di lei verrebbe buttato via a
     * meta'. Il "tonfo" vero e proprio lo da' gia' triggerFieldImpact
     * sulla CASELLA, che sopravvive al render grazie al suo ritentativo.
     */
    function playCardSet(slotEl) {
        if (!slotEl) return;
        const rect = slotEl.getBoundingClientRect();
        if (!rect.width) return;
        const x = rect.left + rect.width / 2;
        // Alla BASE della casella, non al centro: la polvere si alza da
        // dove la carta tocca il campo.
        const y = rect.bottom - rect.height * 0.08;

        spawnDomFx('fx-set-dust', x, y, rect.width * 1.5, rect.height * 0.42, 560);
        spawnParticles(x, y, {
            count: 7, colors: ['#d9cfae', '#b9ad8c', '#efe6cc'],
            speed: 2.2, life: 480, size: 2, spread: 150, baseAngle: -90, gravity: 0.08
        });
    }

    /**
     * Una Carta Equipaggiamento si e' appena agganciata: un'ondata di
     * luce corre da lei fino al mostro, che si accende all'arrivo.
     *
     * Prima l'equip compariva in campo e la linea tratteggiata appariva
     * dal nulla: di CHE COSA stesse potenziando cosa bisognava
     * accorgersi da soli. La direzione del movimento e' l'informazione:
     * parte dall'equip e finisce sul mostro, non viceversa.
     *
     * Riceve le due estremita' gia' calcolate da renderEquipLinks, che
     * le ha appena usate per disegnare la linea — cosi' il bagliore
     * corre ESATTAMENTE lungo di essa invece di ricalcolarsi due punti
     * che potrebbero non coincidere.
     */
    function playEquipAttach(x1, y1, x2, y2, targetEl) {
        const scintilla = document.createElement('div');
        scintilla.className = 'fx-equip-spark';
        scintilla.style.left = `${x1}px`;
        scintilla.style.top = `${y1}px`;
        // Il percorso come variabili CSS: la keyframe le usa per andare
        // da un capo all'altro senza che il JS debba animare nulla.
        scintilla.style.setProperty('--fx-dx', `${x2 - x1}px`);
        scintilla.style.setProperty('--fx-dy', `${y2 - y1}px`);
        document.body.appendChild(scintilla);
        setTimeout(() => scintilla.remove(), 560);

        // Il mostro si accende quando la luce ARRIVA, non subito.
        if (targetEl) {
            setTimeout(() => {
                targetEl.classList.add('fx-summon-glow');
                setTimeout(() => targetEl.classList.remove('fx-summon-glow'), 800);
            }, 380);
        }
    }

    // ============================================================
    // 3bis) Evocazione con "convergenza elementale" — sequenza dedicata
    // di ~4s (energia che converge, flash, cartiglio col nome) al posto
    // del cerchio magico generico, per QUALSIASI mostro di Livello 7+
    // (vedi ATTRIBUTE_SUMMON_THEMES/playMonsterSummonEffect più sotto):
    // generica per Attributo, non più cablata su un elenco fisso di id
    // carta. Un unico motore, `playElementalConvergence`, orchestrato a
    // orari fissi (uguali per ogni tema, così restano sempre
    // sincronizzati con le keyframe in effects.css); solo i COLORI
    // cambiano da un tema all'altro, impostati come custom property CSS
    // (--fx-conv-bright/mid/mid-soft/deep) sugli elementi appena creati
    // invece che duplicando l'intero blocco di classi/keyframe una
    // volta per Attributo (vedi fx-elemconv-* in effects.css, un solo
    // set condiviso).
    // ============================================================
    function playElementalConvergence(monsterElement, card, theme) {
        if (!monsterElement) return;
        const { x, y } = centerOf(monsterElement);

        const applyThemeVars = (el) => {
            el.style.setProperty('--fx-conv-bright', theme.bright);
            el.style.setProperty('--fx-conv-mid', theme.mid);
            el.style.setProperty('--fx-conv-mid-soft', theme.midSoft);
            el.style.setProperty('--fx-conv-deep', theme.deep);
        };

        const backdrop = document.createElement('div');
        backdrop.className = 'fx-elemconv-backdrop';
        backdrop.style.setProperty('--fx-bex', `${(x / window.innerWidth) * 100}%`);
        backdrop.style.setProperty('--fx-bey', `${(y / window.innerHeight) * 100}%`);
        applyThemeVars(backdrop);
        document.body.appendChild(backdrop);
        setTimeout(() => backdrop.remove(), 4000);

        applyThemeVars(monsterElement);
        monsterElement.classList.add('fx-elemconv-charge');
        setTimeout(() => monsterElement.classList.remove('fx-elemconv-charge'), 3600);

        // Raggi di energia che convergono da ogni direzione sul mostro,
        // scaglionati: ognuno è un fascio piatto, ruotato verso il
        // centro, "tirato" verso l'interno animando scaleX (transform-
        // origin sul lato esterno) invece che una vera animazione di
        // posizione — stesso trucco leggero già in uso altrove nel file
        // (vedi fx-sword-beam) invece di un canvas/libreria dedicata.
        const boltCount = 7;
        for (let i = 0; i < boltCount; i++) {
            const angle = (360 / boltCount) * i + (Math.random() * 24 - 12);
            const length = 260 + Math.random() * 140;
            const delay = 300 + i * 130;
            const bolt = document.createElement('div');
            bolt.className = 'fx-elemconv-bolt';
            applyThemeVars(bolt);
            assegnaStile(bolt.style, {
                left: `${x}px`,
                top: `${y}px`,
                width: `${length}px`,
                transform: `translateY(-50%) rotate(${angle}deg) scaleX(0)`
            });
            document.body.appendChild(bolt);
            setTimeout(() => { bolt.style.transform = `translateY(-50%) rotate(${angle}deg) scaleX(1)`; }, delay);
            setTimeout(() => bolt.remove(), delay + 550);
        }

        // Flash centrale + scossa schermo al culmine della carica.
        setTimeout(() => {
            const flash = document.createElement('div');
            flash.className = 'fx-elemconv-flash';
            applyThemeVars(flash);
            flash.style.left = `${x}px`;
            flash.style.top = `${y}px`;
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 500);
            const container = document.querySelector('.game-container') || document.body;
            container.classList.add('fx-shake');
            setTimeout(() => container.classList.remove('fx-shake'), 450);
            spawnParticles(x, y, { count: 40, colors: theme.particleColors, speed: 7, life: 650 });
        }, 2300);

        // Cartiglio col nome vero della carta.
        setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'fx-elemconv-banner';
            applyThemeVars(banner);
            banner.textContent = ((card && card.name) || 'Evocazione').toUpperCase();
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 1350);
        }, 2500);
    }

    /**
     * Un tema per Attributo (LUCE/OSCURITÀ/ACQUA/FUOCO/VENTO/TERRA, le
     * stringhe esatte usate da card.attribute in questo database),
     * usato da QUALSIASI mostro di Livello 7+ — non più legato a
     * specifiche carte. `bright`/`mid`/`midSoft`/`deep` sono le 4 tinte
     * lette da playElementalConvergence per popolare le custom property
     * CSS --fx-conv-* (vedi fx-elemconv-* in effects.css); `particleColors`
     * per la raffica di particelle del flash finale (FX.spawnParticles).
     * Nessuna voce per un Attributo assente da questo dataset (es. non
     * ce n'è uno "senza Attributo"): in quel caso playMonsterSummonEffect
     * ricade sul cerchio magico generico di sempre, come per i mostri
     * sotto Livello 7.
     */
    const ATTRIBUTE_SUMMON_THEMES = {
        'LUCE': {
            bright: '#ffffff',
            mid: 'rgba(247, 215, 116, 0.95)',
            midSoft: 'rgba(247, 215, 116, 0.55)',
            deep: 'rgba(243, 156, 18, 0.9)',
            particleColors: ['#ffffff', '#f7d774', '#fff4c2']
        },
        'OSCURITÀ': {
            bright: '#eadcf5',
            mid: 'rgba(142, 68, 173, 0.95)',
            midSoft: 'rgba(142, 68, 173, 0.55)',
            deep: 'rgba(44, 15, 66, 0.95)',
            particleColors: ['#0d0616', '#8e44ad', '#c39bd3']
        },
        'ACQUA': {
            bright: '#ffffff',
            mid: 'rgba(93, 173, 226, 0.95)',
            midSoft: 'rgba(93, 173, 226, 0.55)',
            deep: 'rgba(27, 111, 184, 0.9)',
            particleColors: ['#ffffff', '#5dade2', '#d6eaf8']
        },
        'FUOCO': {
            bright: '#fff0d9',
            mid: 'rgba(231, 76, 60, 0.95)',
            midSoft: 'rgba(231, 76, 60, 0.55)',
            deep: 'rgba(155, 34, 20, 0.9)',
            particleColors: ['#ffe0b2', '#e74c3c', '#ff6b35']
        },
        'VENTO': {
            bright: '#e8fff5',
            mid: 'rgba(46, 204, 113, 0.95)',
            midSoft: 'rgba(46, 204, 113, 0.55)',
            deep: 'rgba(14, 122, 95, 0.9)',
            particleColors: ['#e8fff5', '#2ecc71', '#48d1a0']
        },
        'TERRA': {
            bright: '#f5e6c8',
            mid: 'rgba(180, 130, 60, 0.95)',
            midSoft: 'rgba(180, 130, 60, 0.55)',
            deep: 'rgba(92, 58, 30, 0.9)',
            particleColors: ['#f5deb3', '#b4823c', '#5c3a1e']
        },
        // I 3 Dei Egizi (Obelisk id 30, Slifer id 31, Ra id 472) sono
        // tutti Attributo DIVINO, non LUCE/OSCURITÀ — senza questa voce
        // ricadrebbero sul cerchio magico generico come qualunque altro
        // mostro sotto Livello 7, perdendo la sequenza speciale. Tema
        // oro-radiante più intenso/caldo di LUCE apposta, per restare
        // visivamente distinto.
        'DIVINO': {
            bright: '#ffffff',
            mid: 'rgba(255, 215, 130, 0.98)',
            midSoft: 'rgba(255, 180, 80, 0.6)',
            deep: 'rgba(255, 140, 0, 0.92)',
            particleColors: ['#ffffff', '#ffe985', '#ff8c00']
        }
    };

    /**
     * Riproduce un video a schermo intero (usato quando esiste un
     * filmato dedicato per una carta, vedi VisualEffects.getVideoFor in
     * js/ui/visual-effects-library.js) — si rimuove da solo alla fine
     * della riproduzione, in errore, o dopo 12s come rete di sicurezza
     * (un video mal codificato non deve mai bloccare la UI per sempre).
     */
    let activeVideoOverlays = 0;
    const VIDEO_SUSPEND_REASON = 'video-fullscreen';

    function suspendBackgroundGraphics() {
        if (window.FieldAmbience && typeof FieldAmbience.sospendi === 'function') FieldAmbience.sospendi(VIDEO_SUSPEND_REASON);
        if (window.MonsterHolograms && typeof MonsterHolograms.sospendi === 'function') MonsterHolograms.sospendi();
    }

    function resumeBackgroundGraphics() {
        if (window.FieldAmbience && typeof FieldAmbience.riprendi === 'function') FieldAmbience.riprendi(VIDEO_SUSPEND_REASON);
        if (window.MonsterHolograms && typeof MonsterHolograms.riprendi === 'function') MonsterHolograms.riprendi();
    }
    function playVideoOverlay(path, onDone) {
    const videoTimer = (fn, ms) => (typeof PausaDuello !== 'undefined') ? PausaDuello.dopo(fn, ms) : setTimeout(fn, ms);
    const clearVideoTimer = (timer) => (typeof PausaDuello !== 'undefined') ? PausaDuello.annulla(timer) : clearTimeout(timer);
    const backdrop = document.createElement('div');
    backdrop.className = 'fx-video-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.tabIndex = -1;

    const video = document.createElement('video');
    video.src = path;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.className = 'fx-video-player';

    backdrop.appendChild(video);
    document.body.appendChild(backdrop);
    activeVideoOverlays++;
    if (activeVideoOverlays === 1) suspendBackgroundGraphics();
    document.documentElement.classList.add('fx-video-priority-active');
    window.DUEL_CINEMATIC_LOCK = true;
    backdrop.focus({ preventScroll: true });

    // --- FADE-IN ---
    // Il backdrop (sfondo nero) parte subito: dietro non c'è nulla di
    // brutto da nascondere, è solo un dissolvimento a nero.
    // Il VIDEO invece aspetta l'evento 'playing' (sta DAVVERO dipingendo
    // un fotogramma vero — a differenza di 'canplay'/'loadeddata', che
    // possono scattare un istante prima che qualcosa sia davvero
    // visibile) prima di diventare visibile: senza questo, la breve
    // finestra di caricamento (rete/decodifica) mostrava l'icona nativa
    // di play/caricamento del browser sopra lo sfondo nero già visibile —
    // segnalato dall'utente ("l'icona del video con il play... camuffa
    // questa cosa"). Stesso principio già usato per le immagini delle
    // carte (has-image/art-loaded in card-renderer.js): non rivelare un
    // elemento multimediale finché non è DAVVERO pronto, invece di
    // lasciare che si veda il suo stato di caricamento nativo.
    let videoRevealed = false;
    function revealVideo() {
        if (videoRevealed) return;
        videoRevealed = true;
        const mostra = () => requestAnimationFrame(() => requestAnimationFrame(() => {
            if (done) return;
            backdrop.classList.add('show');
            video.classList.add('show');
        }));
        // Sincronizza la comparsa col primo frame realmente dipinto. Nei
        // WebView senza questa API il doppio RAF evita comunque un cambio
        // di layer a meta' fotogramma.
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(mostra);
        else mostra();
    }
    video.addEventListener('playing', revealVideo);
    // Rete di sicurezza: se 'playing' non scattasse mai (video mal
    // codificato, connessione lentissima), il video non deve restare
    // invisibile per sempre — dopo un'attesa breve si rivela comunque
    // (al peggio si vede l'icona nativa con un ritardo, mai uno schermo
    // nero fisso per i 12s dell'intera rete di sicurezza qui sotto).
    const revealTimeout = videoTimer(() => {
        if (done) return;
        videoRevealed = true;
        backdrop.classList.add('show');
        video.classList.add('show');
    }, 1500);

    let done = false;

    // Se lo schermo si spegne durante il filmato, alcune WebView lasciano
    // il <video> in pausa senza emettere ended/error. Alla riapertura si
    // prova a ripartire; se la policy mobile lo vieta, si chiude il video
    // e si libera comunque il lock invece di immobilizzare il duello.
    const resumeAfterVisibility = () => {
        if (document.hidden || done || !video.paused
            || (typeof PausaDuello !== 'undefined' && PausaDuello.inPausa())) return;
        const resumed = video.play();
        if (resumed && typeof resumed.catch === 'function') resumed.catch(cleanup);
    };
    document.addEventListener('visibilitychange', resumeAfterVisibility);
    const smettiDiAscoltarePausa = (typeof PausaDuello !== 'undefined')
        ? PausaDuello.ascolta((inPausa) => {
            if (done) return;
            if (inPausa) video.pause();
            else resumeAfterVisibility();
        })
        : () => {};

    const cleanup = () => {
        if (done) return;
        done = true;
        document.removeEventListener('visibilitychange', resumeAfterVisibility);
        smettiDiAscoltarePausa();
        clearVideoTimer(safetyTimeout);
        clearVideoTimer(revealTimeout);

        // --- FADE-OUT ---
        backdrop.classList.remove('show');
        video.classList.remove('show');

        // aspetta la fine della transizione
        videoTimer(() => {
            video.pause();
            video.removeAttribute('src');
            video.load();
            backdrop.remove();
            activeVideoOverlays = Math.max(0, activeVideoOverlays - 1);
            if (activeVideoOverlays === 0) {
                document.documentElement.classList.remove('fx-video-priority-active');
                window.DUEL_CINEMATIC_LOCK = false;
                resumeBackgroundGraphics();
            }
            if (typeof onDone === 'function') onDone();
        }, 0);
    };

    video.addEventListener('ended', cleanup);
    video.addEventListener('error', cleanup);

    // Rete di sicurezza SOLO per un video che non arriva mai a 'ended'/
    // 'error' (bloccato, mal codificato, connessione interrotta) — MAI
    // per un video che sta semplicemente giocando più a lungo del tetto
    // fisso. BUG REALE trovato e corretto: questo tetto era fisso a 12s
    // indipendentemente dalla vera durata del video — segnalato
    // dall'utente come "il video parte e si blocca" (in realtà giocava
    // perfettamente, veniva solo TAGLIATO a metà da questo timeout prima
    // della fine, es. video/vittorie/exodiawin.mp4 dura 18.27s). Appena
    // 'loadedmetadata' rivela la durata VERA, il tetto si ricalibra su
    // quella (+5s di margine) invece di restare indovinato a caso.
    let safetyTimeout = videoTimer(cleanup, 12000);
    video.addEventListener('loadedmetadata', () => {
        if (done || !isFinite(video.duration) || video.duration <= 0) return;
        clearVideoTimer(safetyTimeout);
        safetyTimeout = videoTimer(cleanup, video.duration * 1000 + 5000);
    });
    video.load();
}

    /**
     * Punto di scelta unico dell'effetto visivo di Evocazione (Normale o
     * Speciale, entrambe le chiamano — vedi js/engine/actions.js e
     * js/engine/duel-engine.js/specialSummon), invece del solo
     * FX.playSummonCircle di sempre. Priorità, per QUALSIASI carta (non
     * più un elenco ristretto e cablato di id):
     *   1) Filmato dedicato (video/evocazioni/<id>.mp4, vedi
     *      VisualEffects.getVideoFor) — controllato per OGNI Evocazione,
     *      qualunque Livello/Attributo: se esiste, vince sempre su tutto
     *      il resto.
     *   2) Altrimenti, se il mostro è di Livello 7+ ed ha un Attributo
     *      con un tema in ATTRIBUTE_SUMMON_THEMES: la sequenza "a
     *      convergenza elementale" (playElementalConvergence), colorata
     *      in base all'Attributo.
     *   3) Altrimenti, il cerchio magico generico di sempre.
     */
    /**
     * Quante cinematiche di Evocazione "lunghe" sono in corso in questo
     * momento: un filmato dedicato, o la convergenza elementale di un
     * Livello 7+. Il cerchio magico generico NON conta — dura un attimo e
     * bloccare il duello per lui darebbe solo l'impressione di un gioco
     * lento.
     *
     * Serve perche' il duello ASPETTI: senza, la fase avanzava (e il bot
     * continuava a giocare) mentre il filmato era ancora a schermo, e la
     * partita andava avanti sotto a un'animazione che copriva tutto.
     * Chi aspetta lo legge da FX.isCinematicPlaying() — oggi
     * isBlockingModalOpen() in js/engine/game-flow.js, che governa ogni
     * transizione di fase, e il ciclo del bot in js/ai/bot.js.
     *
     * E' un CONTATORE e non un booleano perche' due Evocazioni ravvicinate
     * (es. un effetto che ne fa due di fila) devono sommarsi: con un
     * booleano la prima a finire sbloccherebbe tutto mentre la seconda sta
     * ancora girando. Il decremento passa sempre da endSummonCinematic,
     * mai da un `= false` sparso.
     */
    let summonCinematicCount = 0;
    /** Durata reale della convergenza elementale: il suo backdrop viene rimosso a 4000ms (vedi playElementalConvergence). */
    const ELEMENTAL_CONVERGENCE_MS = 4000;

    function beginSummonCinematic() { summonCinematicCount++; }
    function endSummonCinematic() { summonCinematicCount = Math.max(0, summonCinematicCount - 1); }
    function isCinematicPlaying() { return summonCinematicCount > 0; }

    const FUSION_MATERIAL_EFFECT_MS = 3000;
    const RITUAL_SUMMON_EFFECT_MS = 2900;

    /**
     * Evocazione Rituale: i materiali si dispongono attorno a un sigillo
     * visto in prospettiva, vengono convertiti in energia e assorbiti nel
     * centro. Il mostro NON viene mostrato qui: onDone lo inserisce davvero
     * sul Terreno e solo allora parte la normale animazione di Evocazione.
     */
    function playRitualSummon(materialCards, ritualCard, owner, onDone) {
        const materials = Array.isArray(materialCards) ? materialCards.filter(Boolean) : [];
        if (!materials.length || typeof window.createCardElement !== 'function') {
            if (typeof onDone === 'function') onDone();
            return 0;
        }

        beginSummonCinematic();
        if (window.SFX && typeof SFX.tribute === 'function') SFX.tribute();

        const scene = document.createElement('div');
        scene.className = 'fx-ritual-scene' + (owner === 'bot' ? ' fx-ritual-scene--bot' : '');
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = `
            <div class="fx-ritual-vignette"></div>
            <div class="fx-ritual-plane">
                <i class="fx-ritual-ring fx-ritual-ring--outer"></i>
                <i class="fx-ritual-ring fx-ritual-ring--inner"></i>
                <i class="fx-ritual-glyph"></i>
                <div class="fx-ritual-core"></div>
            </div>
            <div class="fx-ritual-title"><span>EVOCAZIONE RITUALE</span><small>${escapeHtml((ritualCard && ritualCard.name) || '')}</small></div>
        `;

        const orbit = document.createElement('div');
        orbit.className = 'fx-ritual-materials';
        materials.forEach((card, index) => {
            const shell = document.createElement('div');
            shell.className = 'fx-ritual-material';
            shell.style.setProperty('--ritual-i', index);
            shell.style.setProperty('--ritual-count', materials.length);
            shell.style.setProperty('--ritual-angle', `${index * (360 / materials.length)}deg`);
            const cardEl = createCardElement(card, false, 'attack');
            cardEl.classList.add('fx-ritual-card');
            shell.appendChild(cardEl);
            orbit.appendChild(shell);
        });
        scene.appendChild(orbit);
        document.body.appendChild(scene);

        let closed = false;
        const finish = () => {
            if (closed) return;
            closed = true;
            scene.remove();
            endSummonCinematic();
            if (typeof onDone === 'function') onDone();
        };
        setTimeout(finish, RITUAL_SUMMON_EFFECT_MS);
        return RITUAL_SUMMON_EFFECT_MS;
    }

    /** Vortice compatto che si stringe sulla singola Magia/Trappola. */
    function playDustTornado(owner, index, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="st"][data-index="${index}"]`);
        const rect = slot && slot.getBoundingClientRect();
        if (!rect || !rect.width) { if (typeof onImpact === 'function') onImpact(); return 0; }
        beginSummonCinematic();
        const vortex = document.createElement('div');
        vortex.className = 'fx-dust-tornado';
        assegnaStile(vortex.style, {
            left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px`,
            width: `${rect.width * 2.5}px`, height: `${rect.height * 2.15}px`
        });
        vortex.innerHTML = '<i></i><i></i><i></i><b></b>';
        document.body.appendChild(vortex);
        if (window.SFX && typeof SFX.wind === 'function') SFX.wind();
        let done = false;
        const impact = () => {
            if (done) return;
            done = true;
            if (typeof onImpact === 'function') onImpact();
            setTimeout(() => { vortex.remove(); endSummonCinematic(); }, 430);
        };
        setTimeout(impact, 900);
        return 1330;
    }

    /** Folata larga che attraversa l'intera fila Magie/Trappole. */
    function playHarpiesFeatherDuster(owner, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slots = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="st"]`));
        if (!slots.length) { if (typeof onImpact === 'function') onImpact(); return 0; }
        const rects = slots.map((slot) => slot.getBoundingClientRect()).filter((r) => r.width);
        if (!rects.length) { if (typeof onImpact === 'function') onImpact(); return 0; }
        beginSummonCinematic();
        const left = Math.min(...rects.map((r) => r.left));
        const right = Math.max(...rects.map((r) => r.right));
        const top = Math.min(...rects.map((r) => r.top));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        const gust = document.createElement('div');
        gust.className = 'fx-harpie-gust';
        assegnaStile(gust.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
        gust.innerHTML = '<div class="fx-harpie-wind"><i></i><i></i><i></i><i></i><i></i></div><div class="fx-harpie-feathers"><b></b><b></b><b></b><b></b><b></b><b></b></div>';
        document.body.appendChild(gust);
        if (window.SFX && typeof SFX.wind === 'function') SFX.wind();
        let done = false;
        const impact = () => {
            if (done) return;
            done = true;
            if (typeof onImpact === 'function') onImpact();
            gust.classList.add('fx-harpie-gust--impact');
            setTimeout(() => { gust.remove(); endSummonCinematic(); }, 520);
        };
        setTimeout(impact, 1050);
        return 1570;
    }

    /**
     * Forza dello Specchio: una lastra in prospettiva nasce davanti al
     * difensore e rimanda cinque raggi verso i mostri in Attacco. La
     * regola distrugge le carte subito: qui si usano solo rettangoli DOM
     * fotografati all'inizio, quindi il disegno non può alterare il duello.
     */
    function playMirrorForce(attackerOwner, attackIndices) {
        const boardId = attackerOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const allowed = Array.isArray(attackIndices) ? new Set(attackIndices.map(Number)) : null;
        const targets = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${attackerOwner}"][data-type="monster"]`))
            .filter((slot) => !allowed || allowed.has(Number(slot.dataset.index)))
            .map((slot) => slot.querySelector('.card')).filter(Boolean)
            .map((el) => el.getBoundingClientRect()).filter((rect) => rect.width);
        if (!targets.length) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-mirror-force' + (attackerOwner === 'player' ? ' fx-mirror-force--bottom' : '');
        scene.setAttribute('aria-hidden', 'true');
        scene.dataset.targetCount = String(targets.length);
        const mirrorX = window.innerWidth / 2;
        // Lo specchio nasce davanti al DIFENSORE e riflette verso la fila
        // attaccante. Prima, nel caso piu' comune, compariva quasi sul lato
        // dell'attaccante e i raggi CSS partivano da un'altra coordinata.
        const mirrorY = attackerOwner === 'player' ? window.innerHeight * 0.37 : window.innerHeight * 0.63;
        scene.style.setProperty('--mirror-x', `${mirrorX}px`);
        scene.style.setProperty('--mirror-y', `${mirrorY}px`);
        scene.innerHTML = '<div class="fx-mirror-force-shade"></div><div class="fx-mirror-aura"></div><div class="fx-mirror-disc"><i></i><b></b><em></em></div><div class="fx-mirror-flare"></div>';
        document.body.appendChild(scene);
        targets.forEach((rect, index) => {
            const ray = document.createElement('span');
            ray.className = 'fx-mirror-ray';
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const dx = x - mirrorX;
            const dy = y - mirrorY;
            assegnaStile(ray.style, { left: `${mirrorX}px`, top: `${mirrorY}px` });
            ray.style.setProperty('--ray-length', `${Math.hypot(dx, dy)}px`);
            ray.style.setProperty('--ray-angle', `${Math.atan2(dy, dx) * 180 / Math.PI}deg`);
            ray.style.setProperty('--ray-delay', `${360 + index * 55}ms`);
            scene.appendChild(ray);
            const impact = document.createElement('span');
            impact.className = 'fx-mirror-impact';
            impact.style.left = `${x}px`;
            impact.style.top = `${y}px`;
            impact.style.setProperty('--impact-delay', `${760 + index * 55}ms`);
            impact.innerHTML = '<i></i><b></b>';
            scene.appendChild(impact);
        });
        for (let i = 0; i < 22; i++) {
            const shard = document.createElement('em');
            shard.className = 'fx-mirror-shard';
            shard.style.setProperty('--shard-angle', `${i * (360 / 22)}deg`);
            shard.style.setProperty('--shard-distance', `${90 + (i % 6) * 24}px`);
            shard.style.setProperty('--shard-delay', `${520 + (i % 5) * 35}ms`);
            scene.appendChild(shard);
        }
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 2200);
        return 2200;
    }

    /** Cilindro Magico: due grandi portali deviano il colpo verso la mano dell'attaccante. */
    function playMagicCylinder(attackerOwner, attackerIndex, damagedOwner, damage) {
        const boardId = attackerOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const attacker = document.querySelector(`#${boardId} .field-slot[data-owner="${attackerOwner}"][data-type="monster"][data-index="${attackerIndex}"] .card`);
        // La destinazione visiva e' la MANO del duellante che subisce il
        // contraccolpo, non il suo avatar/riquadro LP. Oltre a rispettare la
        // regia richiesta, la traiettoria attraversa davvero il tavolo.
        const damageAnchor = document.querySelector(damagedOwner === 'player' ? '#playerHand' : '#botHand');
        if (!attacker || !damageAnchor) return 0;
        beginSummonCinematic();
        const from = centerOf(attacker);
        const to = centerOf(damageAnchor);
        const scene = document.createElement('div');
        scene.className = 'fx-magic-cylinder';
        scene.setAttribute('aria-hidden', 'true');
        scene.dataset.target = damagedOwner === 'player' ? 'playerHand' : 'botHand';
        scene.style.setProperty('--cylinder-target-x', `${to.x}px`);
        scene.style.setProperty('--cylinder-target-y', `${to.y}px`);
        scene.innerHTML = '<div class="fx-cylinder-vignette"></div><div class="fx-cylinder-sigil"></div><i class="fx-cylinder fx-cylinder--in"></i><i class="fx-cylinder fx-cylinder--out"></i><b class="fx-cylinder-beam fx-cylinder-beam--in"></b><b class="fx-cylinder-beam fx-cylinder-beam--bridge"></b><b class="fx-cylinder-beam fx-cylinder-beam--out"></b><div class="fx-cylinder-impact"><i></i><b></b></div><strong></strong>';
        const entrance = { x: from.x + (to.x - from.x) * 0.28, y: from.y + (to.y - from.y) * 0.24 };
        const exit = { x: from.x + (to.x - from.x) * 0.64, y: from.y + (to.y - from.y) * 0.62 };
        const placeBeam = (el, a, b) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            assegnaStile(el.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${Math.hypot(dx, dy)}px`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` });
        };
        const cylinders = scene.querySelectorAll('.fx-cylinder');
        Object.assign(cylinders[0].style, { left: `${entrance.x}px`, top: `${entrance.y}px` });
        Object.assign(cylinders[1].style, { left: `${exit.x}px`, top: `${exit.y}px` });
        placeBeam(scene.querySelector('.fx-cylinder-beam--in'), { x: from.x, y: from.y }, entrance);
        placeBeam(scene.querySelector('.fx-cylinder-beam--bridge'), entrance, exit);
        placeBeam(scene.querySelector('.fx-cylinder-beam--out'), exit, { x: to.x, y: to.y });
        const impact = scene.querySelector('.fx-cylinder-impact');
        assegnaStile(impact.style, { left: `${to.x}px`, top: `${to.y}px` });
        for (let i = 0; i < 18; i++) {
            const spark = document.createElement('em');
            spark.style.setProperty('--spark-angle', `${i * 20 + Math.random() * 10}deg`);
            spark.style.setProperty('--spark-distance', `${55 + Math.random() * 95}px`);
            spark.style.setProperty('--spark-delay', `${760 + Math.random() * 180}ms`);
            impact.appendChild(spark);
        }
        const label = scene.querySelector('strong');
        label.textContent = damage ? `-${damage} LP` : '';
        assegnaStile(label.style, { left: `${to.x}px`, top: `${to.y}px` });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.directHit === 'function') setTimeout(() => SFX.directHit(), 900);
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 2200);
        return 2200;
    }

    /**
     * Rinascita del Mostro è l'unica delle cinque che precede davvero la
     * mutazione: onImpact inserisce il mostro solo quando l'Ankh ha finito
     * di estrarlo dal Cimitero. La callback è idempotente e ha una rete di
     * sicurezza interna, così un errore decorativo non blocca l'Evocazione.
     */
    function playMonsterReborn(graveyardOwner, card, targetOwner, targetIndex, onImpact) {
        const targetBoard = targetOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const target = document.querySelector(`#${targetBoard} .field-slot[data-owner="${targetOwner}"][data-type="monster"][data-index="${targetIndex}"]`);
        if (!target || typeof window.createCardElement !== 'function') {
            if (typeof onImpact === 'function') onImpact();
            return 0;
        }
        beginSummonCinematic();
        const targetRect = target.getBoundingClientRect();
        const graveRect = zoneRect(graveyardOwner, 'graveyard');
        const startX = graveRect ? graveRect.left + graveRect.width / 2 : window.innerWidth / 2;
        const startY = graveRect ? graveRect.top + graveRect.height / 2 : window.innerHeight / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;
        const scene = document.createElement('div');
        scene.className = 'fx-monster-reborn';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-reborn-darkness"></div><div class="fx-reborn-ankh"><i></i><b></b></div><div class="fx-reborn-portal"></div>';
        const ankh = scene.querySelector('.fx-reborn-ankh');
        assegnaStile(ankh.style, { left: `${endX}px`, top: `${endY}px` });
        const portal = scene.querySelector('.fx-reborn-portal');
        assegnaStile(portal.style, { left: `${startX}px`, top: `${startY}px` });
        const ghost = createCardElement(card);
        ghost.classList.add('fx-reborn-card');
        assegnaStile(ghost.style, {
            '--reborn-x': `${startX}px`, '--reborn-y': `${startY}px`,
            '--reborn-end-x': `${endX}px`, '--reborn-end-y': `${endY}px`,
            width: `${Math.max(52, targetRect.width)}px`
        });
        scene.appendChild(ghost);
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.summon === 'function') SFX.summon('attack');
        let resolved = false;
        const impact = () => {
            if (resolved) return;
            resolved = true;
            if (typeof onImpact === 'function') onImpact();
        };
        setTimeout(impact, 1120);
        setTimeout(() => {
            impact();
            scene.remove();
            endSummonCinematic();
        }, 1900);
        return 1900;
    }

    /** Buco Trappola: lo slot si inclina e il mostro cade in una voragine. */
    function playTrapHole(owner, index, card) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
        const rect = slot && slot.getBoundingClientRect();
        if (!rect || !rect.width) return 0;
        beginSummonCinematic();
        const pit = document.createElement('div');
        pit.className = 'fx-trap-hole';
        assegnaStile(pit.style, { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height * 0.72}px`, width: `${rect.width * 1.65}px`, height: `${rect.height * 0.62}px` });
        pit.innerHTML = '<i></i><b></b>';
        document.body.appendChild(pit);
        if (card && typeof window.createCardElement === 'function') {
            const ghost = createCardElement(card);
            ghost.classList.add('fx-trap-hole-card');
            assegnaStile(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
            document.body.appendChild(ghost);
            setTimeout(() => ghost.remove(), 1350);
        }
        if (window.SFX && typeof SFX.destroy === 'function') setTimeout(() => SFX.destroy(), 570);
        setTimeout(() => {
            pit.remove();
            endSummonCinematic();
        }, 1450);
        return 1450;
    }

    /** Tributo Torrenziale: un fronte d'acqua attraversa entrambi i campi. */
    function playTorrentialTribute() {
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-torrential';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-torrential-dim"></div><div class="fx-torrential-wave fx-torrential-wave--back"></div><div class="fx-torrential-wave fx-torrential-wave--front"></div><div class="fx-torrential-foam"></div>';
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.destroy === 'function') setTimeout(() => SFX.destroy(), 720);
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 1800);
        return 1800;
    }

    /** Anello della Distruzione: collare esplosivo e doppia onda verso i LP. */
    function playRingOfDestruction(owner, index, damage) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const scene = document.createElement('div');
        scene.className = 'fx-destruction-ring';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-ring-dim"></div><div class="fx-ring-collar"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div><span class="fx-ring-damage fx-ring-damage--player"></span><span class="fx-ring-damage fx-ring-damage--bot"></span>';
        const collar = scene.querySelector('.fx-ring-collar');
        assegnaStile(collar.style, { left: `${point.x}px`, top: `${point.y}px`, width: `${point.rect.width * 1.65}px`, height: `${point.rect.width * 1.65}px` });
        scene.querySelectorAll('.fx-ring-damage').forEach((label) => { label.textContent = damage ? `-${damage} LP` : ''; });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.destroy === 'function') setTimeout(() => SFX.destroy(), 650);
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 1750);
        return 1750;
    }

    /** Tempesta Pesante investe entrambe le file M/T, poi risolve il lotto. */
    function playHeavyStorm(onImpact) {
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-heavy-storm';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-heavy-clouds"></div><div class="fx-heavy-gust fx-heavy-gust--a"></div><div class="fx-heavy-gust fx-heavy-gust--b"></div><div class="fx-heavy-debris"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.wind === 'function') SFX.wind();
        let resolved = false;
        const impact = () => {
            if (resolved) return;
            resolved = true;
            if (typeof onImpact === 'function') onImpact();
        };
        setTimeout(impact, 1050);
        setTimeout(() => {
            impact();
            scene.remove();
            endSummonCinematic();
        }, 1800);
        return 1800;
    }

    /**
     * Tifone dello Spazio Mistico: un vero imbuto di vento mistico si
     * avvita sulla carta, la solleva e la strappa dal Terreno. Non usa la
     * vecchia implosione circolare (troppo simile a Buco Nero).
     */
    function playMysticalSpaceTyphoon(owner, index, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="st"][data-index="${index}"]`);
        const rect = slot && slot.getBoundingClientRect();
        if (!rect || !rect.width) {
            if (typeof onImpact === 'function') onImpact();
            return 0;
        }
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-mst-scene';
        scene.setAttribute('aria-hidden', 'true');
        assegnaStile(scene.style, {
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top + rect.height / 2}px`,
            '--mst-size': `${Math.max(rect.width * 2.7, 150)}px`
        });
        scene.innerHTML = '<div class="fx-mst-funnel"><i></i><i></i><i></i><i></i><b></b></div><div class="fx-mst-ground"></div><div class="fx-mst-shards"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
        const cardEl = slot.querySelector('.card');
        if (cardEl && typeof window.createCardElement === 'function') {
            const cardSlot = (owner === 'player' ? gameState.playerSTField : gameState.botSTField)[index];
            if (cardSlot && cardSlot.card) {
                const ghost = window.createCardElement(cardSlot.card);
                ghost.classList.add('fx-mst-card');
                assegnaStile(ghost.style, {
                    width: `${rect.width}px`, height: `${rect.height}px`,
                    left: `${-rect.width / 2}px`, top: `${-rect.height / 2}px`
                });
                scene.appendChild(ghost);
            }
        }
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.wind === 'function') SFX.wind();
        let resolved = false;
        const impact = () => {
            if (resolved) return;
            resolved = true;
            if (typeof onImpact === 'function') onImpact();
        };
        setTimeout(impact, 820);
        setTimeout(() => {
            impact();
            scene.remove();
            endSummonCinematic();
        }, 1540);
        return 1540;
    }

    /** Occhio/mescolanza di cuori sul bersaglio prima del normale viaggio di controllo. */
    function playMindControl(card, owner, index, mode) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const mark = document.createElement('div');
        mark.className = `fx-control-mark fx-control-mark--${mode === 'heart' ? 'heart' : 'mind'}`;
        mark.setAttribute('aria-hidden', 'true');
        assegnaStile(mark.style, { left: `${point.x}px`, top: `${point.y}px`, width: `${point.rect.width * 1.65}px`, height: `${point.rect.height * 1.25}px` });
        mark.innerHTML = mode === 'heart'
            ? '<i class="fx-heart-half fx-heart-half--light"></i><i class="fx-heart-half fx-heart-half--dark"></i><b></b>'
            : '<i class="fx-control-eye"></i><i class="fx-control-orbit"></i><b></b>';
        document.body.appendChild(mark);
        if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => {
            mark.remove();
            endSummonCinematic();
        }, 1250);
        return 1250;
    }

    /**
     * Richiamo degli Infestati: il mostro resta fuori dal campo durante
     * l'emersione. La catena persistente viene invece ricreata dal renderer
     * leggendo il legame reale targetUid della Trappola Continua.
     */
    function playCallOfTheHaunted(owner, card, targetIndex, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const target = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${targetIndex}"]`);
        const grave = zoneRect(owner, 'graveyard');
        const targetRect = target && target.getBoundingClientRect();
        if (!targetRect || !targetRect.width || typeof window.createCardElement !== 'function') {
            if (typeof onImpact === 'function') onImpact();
            return 0;
        }
        beginSummonCinematic();
        const startX = grave ? grave.left + grave.width / 2 : window.innerWidth / 2;
        const startY = grave ? grave.top + grave.height / 2 : window.innerHeight / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;
        const scene = document.createElement('div');
        scene.className = 'fx-call-haunted';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-haunted-fog"></div><div class="fx-haunted-grave"></div><div class="fx-haunted-chain fx-haunted-chain--left"></div><div class="fx-haunted-chain fx-haunted-chain--right"></div>';
        const graveMark = scene.querySelector('.fx-haunted-grave');
        assegnaStile(graveMark.style, { left: `${startX}px`, top: `${startY}px` });
        const ghost = createCardElement(card);
        ghost.classList.add('fx-haunted-card');
        assegnaStile(ghost.style, { '--haunted-x': `${startX}px`, '--haunted-y': `${startY}px`, '--haunted-end-x': `${endX}px`, '--haunted-end-y': `${endY}px`, width: `${Math.max(52, targetRect.width)}px` });
        scene.appendChild(ghost);
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        let resolved = false;
        const impact = () => {
            if (resolved) return;
            resolved = true;
            if (typeof onImpact === 'function') onImpact();
        };
        setTimeout(impact, 1060);
        setTimeout(() => {
            impact();
            scene.remove();
            endSummonCinematic();
        }, 1750);
        return 1750;
    }

    /**
     * Buco Trappola senza Fondo non riusa la voragine marrone del normale
     * Buco Trappola: il mostro viene fotografato e trascinato in un portale
     * dimensionale viola, coerente con la successiva Zona Bandite.
     */
    function playBottomlessTrapHole(owner, index, card) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
        const rect = slot && slot.getBoundingClientRect();
        if (!rect || !rect.width) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-bottomless-hole';
        scene.setAttribute('aria-hidden', 'true');
        assegnaStile(scene.style, {
            left: `${rect.left + rect.width / 2}px`,
            top: `${rect.top + rect.height * 0.72}px`,
            width: `${rect.width * 2.15}px`,
            height: `${rect.height * 0.82}px`
        });
        scene.innerHTML = '<i></i><i></i><i></i><b></b><span></span>';
        document.body.appendChild(scene);
        if (card && typeof window.createCardElement === 'function') {
            const ghost = createCardElement(card);
            ghost.classList.add('fx-bottomless-card');
            assegnaStile(ghost.style, {
                left: `${rect.left}px`, top: `${rect.top}px`,
                width: `${rect.width}px`, height: `${rect.height}px`
            });
            document.body.appendChild(ghost);
            setTimeout(() => ghost.remove(), 1450);
        }
        if (window.SFX && typeof SFX.destroy === 'function') setTimeout(() => SFX.destroy(), 620);
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 1550);
        return 1550;
    }

    /** Armatura Sakuretsu: piastre in prospettiva serrano l'attaccante e collassano. */
    function playSakuretsuArmor(owner, index) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const armor = document.createElement('div');
        armor.className = 'fx-sakuretsu-armor';
        armor.setAttribute('aria-hidden', 'true');
        assegnaStile(armor.style, {
            left: `${point.x}px`, top: `${point.y}px`,
            width: `${point.rect.width * 2.05}px`, height: `${point.rect.height * 1.55}px`
        });
        armor.innerHTML = '<i></i><i></i><i></i><i></i><b></b><span></span>';
        document.body.appendChild(armor);
        if (window.SFX && typeof SFX.destroy === 'function') setTimeout(() => SFX.destroy(), 650);
        setTimeout(() => {
            armor.remove();
            endSummonCinematic();
        }, 1450);
        return 1450;
    }

    /** Giudizio Solenne: tribunale celeste e sigillo che tronca l'azione negata. */
    function playSolemnJudgment(owner, cost) {
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = `fx-solemn-judgment fx-solemn-judgment--${owner}`;
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-solemn-sky"></div><div class="fx-solemn-judge"><i></i><b></b></div><div class="fx-solemn-seal"><i></i><i></i><i></i></div><strong>ANNULLATO</strong><small></small>';
        scene.querySelector('small').textContent = cost ? `-${cost} LP` : '';
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 1750);
        return 1750;
    }

    /** Libro della Luna avvolge lo slot e ne accompagna il ribaltamento. */
    function playBookOfMoon(owner, index, card) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const moon = document.createElement('div');
        moon.className = 'fx-book-moon';
        moon.setAttribute('aria-hidden', 'true');
        assegnaStile(moon.style, {
            left: `${point.x}px`, top: `${point.y}px`,
            width: `${point.rect.width * 2.2}px`, height: `${point.rect.width * 2.2}px`
        });
        moon.innerHTML = '<i class="fx-book-moon-disc"></i><i class="fx-book-moon-shadow"></i><b></b><span></span>';
        document.body.appendChild(moon);
        if (card && typeof window.createCardElement === 'function') {
            const ghost = createCardElement(card);
            ghost.classList.add('fx-book-moon-card');
            assegnaStile(ghost.style, {
                left: `${point.rect.left}px`, top: `${point.rect.top}px`,
                width: `${point.rect.width}px`, height: `${point.rect.height}px`
            });
            document.body.appendChild(ghost);
            setTimeout(() => ghost.remove(), 1200);
        }
        if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => {
            moon.remove();
            endSummonCinematic();
        }, 1300);
        return 1300;
    }

    /** Virus Distruggi-Carte propaga una scansione infetta sugli slot colpiti. */
    function playCrushCardVirus(owner, targetIndices) {
        const victim = owner === 'player' ? 'bot' : 'player';
        const boardId = victim === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const allowed = new Set((targetIndices || []).map(Number));
        const targets = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${victim}"][data-type="monster"]`))
            .filter((slot) => allowed.has(Number(slot.dataset.index)))
            .map((slot) => slot.querySelector('.card')).filter(Boolean)
            .map((el) => centerOf(el));
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-crush-virus';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-virus-vignette"></div><div class="fx-virus-core"><i></i><i></i><i></i><b></b></div><strong>VIRUS DISTRUGGI-CARTE</strong>';
        targets.forEach((point, index) => {
            const mark = document.createElement('span');
            mark.className = 'fx-virus-target';
            assegnaStile(mark.style, {
                left: `${point.x}px`, top: `${point.y}px`,
                width: `${point.rect.width * 1.45}px`, height: `${point.rect.height * 1.15}px`,
                '--virus-delay': `${420 + index * 90}ms`
            });
            scene.appendChild(mark);
        });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => {
            scene.remove();
            endSummonCinematic();
        }, 1800);
        return 1800;
    }

    /** Nega Attacco: un varco assorbe il colpo e chiude visivamente la Battle Phase. */
    function playNegateAttack(attackerOwner, attackerIndex) {
        const boardId = attackerOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${attackerOwner}"][data-type="monster"][data-index="${attackerIndex}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const scene = document.createElement('div');
        scene.className = 'fx-negate-attack';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-negate-vignette"></div><div class="fx-negate-gate"><i></i><i></i><i></i><b></b></div><div class="fx-negate-beam"></div><strong>ATTACCO NEGATO</strong>';
        const gate = scene.querySelector('.fx-negate-gate');
        const gateX = window.innerWidth / 2;
        const gateY = window.innerHeight / 2;
        assegnaStile(gate.style, { left: `${gateX}px`, top: `${gateY}px` });
        const beam = scene.querySelector('.fx-negate-beam');
        const dx = gateX - point.x;
        const dy = gateY - point.y;
        assegnaStile(beam.style, {
            left: `${point.x}px`, top: `${point.y}px`,
            width: `${Math.hypot(dx, dy)}px`,
            transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`
        });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1550);
        return 1550;
    }

    /** Capro Espiatorio: quattro spiriti percorrono gli slot appena creati. */
    function playScapegoat(owner, tokenIndices) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const targets = (tokenIndices || []).map((index) => {
            const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
            const rect = slot && slot.getBoundingClientRect();
            return rect && rect.width ? { index, rect } : null;
        }).filter(Boolean);
        if (!targets.length) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = `fx-scapegoat fx-scapegoat--${owner}`;
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-scapegoat-mist"></div><strong>CAPRO ESPIATORIO</strong>';
        targets.forEach(({ rect }, index) => {
            const sheep = document.createElement('span');
            sheep.className = 'fx-sheep-spirit';
            assegnaStile(sheep.style, {
                left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px`,
                width: `${rect.width * 1.18}px`, height: `${rect.width * .9}px`,
                '--sheep-delay': `${index * 105}ms`
            });
            sheep.innerHTML = '<i></i><b></b>';
            scene.appendChild(sheep);
        });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1650);
        return 1650;
    }

    /** Scatola Mistica: due cabine in prospettiva, lama e passaggio di controllo. */
    function playMysticBox(destroyedTarget, offeredTarget) {
        if (!destroyedTarget || !offeredTarget) return 0;
        const slotRect = (target) => {
            const boardId = target.owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
            const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${target.owner}"][data-type="monster"][data-index="${target.index}"]`);
            return slot && slot.getBoundingClientRect();
        };
        const leftRect = slotRect(destroyedTarget);
        const rightRect = slotRect(offeredTarget);
        if (!leftRect || !rightRect || !leftRect.width || !rightRect.width) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-mystic-box';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-mystic-shade"></div><div class="fx-mystic-cabinet fx-mystic-cabinet--destroy"><i></i><b></b></div><div class="fx-mystic-cabinet fx-mystic-cabinet--offer"><i></i><b></b></div><div class="fx-mystic-arc"></div>';
        const cabinets = scene.querySelectorAll('.fx-mystic-cabinet');
        [[cabinets[0], leftRect], [cabinets[1], rightRect]].forEach(([el, rect]) => {
            assegnaStile(el.style, {
                left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px`,
                width: `${rect.width * 1.45}px`, height: `${rect.height * 1.2}px`
            });
        });
        if (destroyedTarget.card && typeof window.createCardElement === 'function') {
            const ghost = createCardElement(destroyedTarget.card);
            ghost.classList.add('fx-mystic-victim');
            assegnaStile(ghost.style, { left: `${leftRect.left}px`, top: `${leftRect.top}px`, width: `${leftRect.width}px`, height: `${leftRect.height}px` });
            scene.appendChild(ghost);
        }
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1750);
        return 1750;
    }

    /** Rimozione del Limitatore sovraccarica solo le Macchine coinvolte. */
    function playLimiterRemoval(owner, machineIndices) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const targets = (machineIndices || []).map((index) => {
            const el = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
            return el ? centerOf(el) : null;
        }).filter(Boolean);
        if (!targets.length) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div');
        scene.className = 'fx-limiter-removal';
        scene.setAttribute('aria-hidden', 'true');
        scene.innerHTML = '<div class="fx-limiter-vignette"></div><div class="fx-limiter-gauge"><i></i><b></b></div><strong>LIMITATORE RIMOSSO</strong>';
        targets.forEach((point, index) => {
            const surge = document.createElement('span');
            surge.className = 'fx-machine-surge';
            assegnaStile(surge.style, {
                left: `${point.x}px`, top: `${point.y}px`,
                width: `${point.rect.width * 1.5}px`, height: `${point.rect.height * 1.2}px`,
                '--surge-delay': `${index * 80}ms`
            });
            surge.innerHTML = '<i></i><i></i><i></i><b></b>';
            scene.appendChild(surge);
        });
        document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1600);
        return 1600;
    }

    /** Impatto iniziale di Incantesimo Ombra; le catene permanenti le deriva il renderer. */
    function playShadowSpell(owner, index) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic();
        const point = centerOf(cardEl);
        const bind = document.createElement('div');
        bind.className = 'fx-shadow-bind';
        bind.setAttribute('aria-hidden', 'true');
        assegnaStile(bind.style, {
            left: `${point.x}px`, top: `${point.y}px`,
            width: `${point.rect.width * 1.75}px`, height: `${point.rect.height * 1.35}px`
        });
        bind.innerHTML = '<i></i><i></i><i></i><b></b><span></span>';
        document.body.appendChild(bind);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => { bind.remove(); endSummonCinematic(); }, 1400);
        return 1400;
    }

    /** Cerchio Ammaliante: sigillo iniziale; la versione persistente vive nel renderer. */
    function playSpellbindingCircle(owner, index) {
        return playTargetSigil(owner, index, 'fx-spellbinding-burst', 'trap');
    }

    /** Cappelli Magici: tre cappelli si materializzano sopra gli slot coperti. */
    function playMagicalHats(owner, indices) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const scene = document.createElement('div');
        scene.className = 'fx-magical-hats'; scene.setAttribute('aria-hidden', 'true');
        (indices || []).forEach((index, order) => {
            const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
            const rect = slot && slot.getBoundingClientRect(); if (!rect || !rect.width) return;
            const hat = document.createElement('span'); hat.className = 'fx-magic-hat';
            assegnaStile(hat.style, { left:`${rect.left + rect.width/2}px`, top:`${rect.top + rect.height/2}px`, width:`${rect.width*1.35}px`, height:`${rect.height*1.12}px`, '--hat-delay':`${order*100}ms` });
            hat.innerHTML = '<i></i><b></b>'; scene.appendChild(hat);
        });
        if (!scene.children.length) return 0;
        beginSummonCinematic(); document.body.appendChild(scene);
        if (window.SFX && typeof SFX.activateTrap === 'function') SFX.activateTrap();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1650); return 1650;
    }

    /** Moltiplicazione: il Kuriboh centrale si divide verso i Token appena creati. */
    function playMultiply(owner, sourceIndex, tokenIndices) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const source = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${sourceIndex}"]`);
        const sourceRect = source && source.getBoundingClientRect();
        if (!sourceRect || !sourceRect.width) return 0;
        beginSummonCinematic();
        const scene = document.createElement('div'); scene.className = 'fx-multiply'; scene.setAttribute('aria-hidden', 'true');
        const sx = sourceRect.left + sourceRect.width/2, sy = sourceRect.top + sourceRect.height/2;
        (tokenIndices || []).forEach((index, order) => {
            const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
            const rect = slot && slot.getBoundingClientRect(); if (!rect || !rect.width) return;
            const orb = document.createElement('span'); orb.className = 'fx-kuriboh-orb';
            assegnaStile(orb.style, { '--mul-x':`${sx}px`, '--mul-y':`${sy}px`, '--mul-end-x':`${rect.left+rect.width/2}px`, '--mul-end-y':`${rect.top+rect.height/2}px`, '--mul-delay':`${order*80}ms`, width:`${rect.width*.72}px`, height:`${rect.width*.72}px` });
            orb.innerHTML = '<i></i><b></b>'; scene.appendChild(orb);
        });
        document.body.appendChild(scene); if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => { scene.remove(); endSummonCinematic(); }, 1550); return 1550;
    }

    /** Controllore del Nemico: pannello Kaiba e comando scelto. */
    function playEnemyController(owner, index, mode) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return 0;
        beginSummonCinematic(); const p = centerOf(cardEl);
        const panel = document.createElement('div'); panel.className = 'fx-enemy-controller'; panel.setAttribute('aria-hidden','true');
        assegnaStile(panel.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${p.rect.width*2.15}px`,height:`${p.rect.height*1.35}px`});
        panel.innerHTML = `<i></i><b></b><span>${mode === 'controllo' ? 'CONTROL' : 'POSITION'}</span><strong>↑ ↓ ← → A B</strong>`;
        document.body.appendChild(panel); if (window.SFX && typeof SFX.activateSpell === 'function') SFX.activateSpell();
        setTimeout(() => { panel.remove(); endSummonCinematic(); }, 1350); return 1350;
    }

    /** Buco Dimensionale: varco netto sul proprio slot prima del bando temporaneo. */
    function playDimensionHole(owner, index, card) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slot = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"]`);
        const rect = slot && slot.getBoundingClientRect(); if (!rect || !rect.width) return 0;
        beginSummonCinematic(); const hole = document.createElement('div'); hole.className = 'fx-dimension-hole';
        assegnaStile(hole.style,{left:`${rect.left+rect.width/2}px`,top:`${rect.top+rect.height/2}px`,width:`${rect.width*2}px`,height:`${rect.width*2}px`});
        hole.innerHTML='<i></i><i></i><b></b>'; document.body.appendChild(hole);
        if (card && typeof window.createCardElement === 'function') { const ghost=createCardElement(card); ghost.classList.add('fx-dimension-card'); assegnaStile(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`}); document.body.appendChild(ghost); setTimeout(()=>ghost.remove(),1350); }
        setTimeout(()=>{hole.remove();endSummonCinematic();},1450); return 1450;
    }

    function playTargetSigil(owner, index, className, soundKind) {
        const boardId=owner==='player'?'playerFieldBoard':'botFieldBoard'; const el=document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${index}"] .card`); if(!el)return 0;
        beginSummonCinematic(); const p=centerOf(el); const sigil=document.createElement('div'); sigil.className=className; assegnaStile(sigil.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${p.rect.width*1.8}px`,height:`${p.rect.width*1.8}px`}); sigil.innerHTML='<i></i><i></i><i></i><b></b>'; document.body.appendChild(sigil);
        if(window.SFX){const fn=soundKind==='trap'?SFX.activateTrap:SFX.activateSpell;if(typeof fn==='function')fn.call(SFX);} setTimeout(()=>{sigil.remove();endSummonCinematic();},1350); return 1350;
    }

    /**
     * Cinematica che precede una vera Evocazione Fusione. Usa copie DOM
     * dei materiali già scelti dal motore: orbitano in prospettiva,
     * vengono risucchiati nel vortice e collassano nel nucleo centrale.
     * Non legge né modifica gameState; la logica resta in duel-engine.js.
     */
    function playFusionMaterialEffect(materialCards, fusionCard, owner, onDone) {
        if (!Array.isArray(materialCards) || materialCards.length === 0) {
            if (typeof onDone === 'function') onDone();
            return 0;
        }
        beginSummonCinematic();
        // Punto unico per Fusione con Polimerizzazione e combinazioni
        // dall'Extra Deck X/Y/Z: SFX.fusion prova prima il file reale
        // audio/standard/fusion.mp3 e rispetta volume/mute degli effetti.
        if (window.SFX && typeof SFX.fusion === 'function') SFX.fusion();

        const scena = document.createElement('div');
        scena.className = 'fx-fusion-scene' + (owner === 'bot' ? ' fx-fusion-scene--bot' : '');
        scena.setAttribute('aria-hidden', 'true');

        const tunnel = document.createElement('div');
        tunnel.className = 'fx-fusion-tunnel';
        for (let i = 0; i < 4; i++) {
            const anello = document.createElement('i');
            anello.style.setProperty('--fx-ring-i', i);
            tunnel.appendChild(anello);
        }
        scena.appendChild(tunnel);

        const nucleo = document.createElement('div');
        nucleo.className = 'fx-fusion-core';
        scena.appendChild(nucleo);

        const orbita = document.createElement('div');
        orbita.className = 'fx-fusion-orbit';
        const quanti = materialCards.length;
        materialCards.forEach((card, index) => {
            const guscio = document.createElement('div');
            guscio.className = 'fx-fusion-material';
            const angolo = index * (360 / quanti);
            guscio.style.setProperty('--fx-material-angle', angolo + 'deg');
            guscio.style.setProperty('--fx-material-angle-inverse', (-angolo) + 'deg');
            guscio.style.setProperty('--fx-material-delay', (index * .1) + 's');
            const carta = typeof createCardElement === 'function'
                ? createCardElement(card, false, 'attack')
                : document.createElement('div');
            carta.classList.add('fx-fusion-card');
            guscio.appendChild(carta);
            orbita.appendChild(guscio);
        });
        scena.appendChild(orbita);

        const titolo = document.createElement('div');
        titolo.className = 'fx-fusion-title';
        titolo.innerHTML = '<span>FUSIONE</span><small>' + (fusionCard ? fusionCard.name : '') + '</small>';
        scena.appendChild(titolo);
        document.body.appendChild(scena);

        let chiusa = false;
        const chiudi = () => {
            if (chiusa) return;
            chiusa = true;
            scena.remove();
            endSummonCinematic();
            if (typeof onDone === 'function') onDone();
        };
        setTimeout(chiudi, FUSION_MATERIAL_EFFECT_MS);
        return FUSION_MATERIAL_EFFECT_MS;
    }

    /**
     * Le cinematiche di Evocazione vanno UNA ALLA VOLTA. Piu' mostri evocati
     * insieme o di seguito (due Evocazioni Speciali in una Catena, Fusione +
     * Evocazione...) facevano partire i filmati/convergenze nello stesso
     * istante, sovrapposti. Ogni richiesta si mette in coda e parte quando
     * la precedente ha finito (filmato concluso o durata della convergenza).
     * Il contatore di "cinematica in corso" (che il ciclo del bot interroga)
     * si alza SUBITO, alla richiesta, e scende solo a scena finita: nel
     * tempo d'attesa in coda il bot non deve credere che sia tutto libero.
     */
    const codaEvocazioni = [];
    let evocazioneInCorso = false;
    let generazioneCoda = 0;

    /**
     * Butta via la coda e la scena in corso (duello ricominciato, test): le scene
     * gia' partite finiscono da sole ma non toccano piu' il contatore ne' la coda.
     */
    function azzeraCodaEvocazioni() {
        const daChiudere = codaEvocazioni.length + (evocazioneInCorso ? 1 : 0);
        codaEvocazioni.length = 0;
        evocazioneInCorso = false;
        generazioneCoda++;
        for (let i = 0; i < daChiudere; i++) endSummonCinematic();
    }

    function playMonsterSummonEffect(card, monsterElement) {
        if (!card && !monsterElement) return;
        beginSummonCinematic();
        codaEvocazioni.push({ card: card, monsterElement: monsterElement });
        avviaProssimaEvocazione();
    }

    function avviaProssimaEvocazione() {
        if (evocazioneInCorso) return;
        const prossima = codaEvocazioni.shift();
        if (!prossima) return;
        evocazioneInCorso = true;
        let finita = false;
        const generazione = generazioneCoda;
        const fine = () => {
            if (finita) return;
            finita = true;
            if (generazione !== generazioneCoda) return; // la coda e' stata azzerata: il contatore e' gia' a posto
            endSummonCinematic();
            evocazioneInCorso = false;
            avviaProssimaEvocazione();
        };
        try {
            eseguiEvocazione(prossima.card, prossima.monsterElement, fine);
        } catch (e) {
            console.error('[FX] cinematica di Evocazione:', e);
            fine();
        }
    }

    function eseguiEvocazione(card, monsterElement, fineScena) {
        // Ancora sempre la cinematica alla carta REALE sul Terreno tramite
        // uid. Il nodo ricevuto dal chiamante puo' essere obsoleto dopo un
        // updateUI oppure, nei percorsi bot/multiplayer, risolvere una copia
        // non pertinente: la convergenza di un Livello 7+ finiva cosi'
        // centrata sul ritratto dell'avversario invece che sul mostro.
        // Qui (al turno in coda, non alla richiesta) cosi' il nodo e' quello di adesso.
        if (card && card.uid && typeof window.findFieldCardElementByUid === 'function') {
            monsterElement = window.findFieldCardElementByUid(card.uid) || monsterElement;
        }
        if (!monsterElement) { fineScena(); return; }

        // Il contatore e' gia' stato alzato alla richiesta (playMonsterSummonEffect):
        // la ricerca del filmato dedicato e' ASINCRONA (VisualEffects.getVideoFor)
        // e chi deve aspettare — il ciclo del bot — interroga il flag subito
        // dopo la chiamata. Se poi basta il cerchio generico, si chiude subito.
        const chiudi = fineScena;

        const fallback = () => {
            const theme = card && (card.level || 0) >= 7 ? ATTRIBUTE_SUMMON_THEMES[card.attribute] : null;
            if (theme) {
                // Solo il fallback senza filmato arriva qui. Un eventuale
                // audio dedicato della carta mantiene la priorita'; per
                // tutti gli altri Livelli 7+ SFX.evocation riproduce
                // audio/standard/evocation.mp3. I chiamanti non lanciano
                // piu' summon() per questi livelli, evitando sovrapposizioni.
                const hasDedicatedAudio = window.AudioLibrary
                    && AudioLibrary.tryPlayCardSound(card, 'evocazioni');
                if (!hasDedicatedAudio && window.SFX && typeof SFX.evocation === 'function') {
                    SFX.evocation();
                }
                // runElementalConvergence, non la funzione diretta: cosi'
                // anche questa sequenza passa dal backend attivo (vedi il
                // commento su quella costante).
                const durataVera = runElementalConvergence(monsterElement, card, theme);
                // La convergenza non ha un callback di completamento (ne'
                // quella CSS ne' quella GSAP): si sblocca a durata nota, ed
                // e' per questo che le versioni di base devono stare dentro
                // ELEMENTAL_CONVERGENCE_MS. Una versione piu' lunga (il
                // Risveglio in WebGL, js/ui/evocazione-epica-webgl.js) DICHIARA
                // la sua durata tornandola in millisecondi. Anche fosse
                // sbagliata, il duello ripartirebbe un po' prima o un po' dopo
                // — mai restando bloccato per sempre.
                const attesa = (typeof durataVera === 'number' && durataVera > 0 && durataVera < 12000) ? durataVera : ELEMENTAL_CONVERGENCE_MS;
                setTimeout(chiudi, attesa);
                return;
            }
            // Cerchio magico generico: dura un attimo, non blocca nulla.
            runSummonCircle(monsterElement);
            chiudi();
        };

        const filmatiEvocazioneAttivi = !window.SaveManager || SaveManager.getSetting('summonVideos') !== false;
        if (filmatiEvocazioneAttivi && card && window.VisualEffects && typeof VisualEffects.getVideoFor === 'function') {
            VisualEffects.getVideoFor(card.id, 'evocazioni').then((videoPath) => {
                // playVideoOverlay ha gia' il proprio tetto di sicurezza
                // interno (durata reale del filmato + 5s), quindi `chiudi`
                // arriva SEMPRE, anche se il filmato non raggiungesse mai
                // 'ended'.
                if (videoPath) playVideoOverlay(videoPath, chiudi);
                else fallback();
            }).catch(chiudi);
            return;
        }
        fallback();
    }

    /**
     * Effetto di vittoria per QUALUNQUE condizione di vittoria
     * ISTANTANEA/alternativa (Exodia, Destiny Board, Elefante Volante,
     * ecc. — vedi checkGameOver/game-flow.js, che orchestra tutte le
     * chiamate) — stessa priorità di playMonsterSummonEffect qui sopra:
     * 1) filmato dedicato (video/vittorie/<kind>.mp4, vedi
     * VisualEffects.getVideoFor) se esiste, altrimenti 2) una sequenza
     * CSS dedicata (bagliore dorato in successione sulle carte coinvolte,
     * poi un flash + banner col testo passato a schermo intero) — MAI il
     * cerchio di evocazione generico, questa non è un'Evocazione.
     * Generica per `kind`/`bannerText` invece di una funzione (e un set
     * di classi CSS) copiata per ogni singola carta — vedi
     * js/ui/effects.css per gli stessi nomi fx-instantwin-* condivisi da
     * ogni condizione.
     *
     * `kind`: usato SOLO per comporre il percorso del filmato
     * (`video/vittorie/<kind>.mp4`) — una stringa breve, senza estensione
     * (es. "exodiawin", "destinyboard").
     * `bannerText`: il testo mostrato nel banner finale (fallback CSS) —
     * ignorato se esiste un filmato dedicato.
     * `pieceElements`: i DOM element delle carte coinvolte da far
     * brillare in sequenza PRIMA del flash finale, se disponibili e
     * mostrate a schermo (es. i 5 pezzi in mano per Exodia, le 5 carte
     * in zona Magia/Trappola per Destiny Board) — array vuoto per
     * saltare dritti al flash finale (es. per il bot, la cui mano non è
     * mostrata a schermo, o per una condizione senza "pezzi" da
     * evidenziare).
     * `onDone` va chiamata SEMPRE, alla fine della sequenza scelta: il
     * chiamante dichiara la vittoria vera solo dopo, non prima.
     */
    function playInstantWinCinematic(kind, bannerText, pieceElements, onDone) {
        const finish = typeof onDone === 'function' ? onDone : function () {};

        const runCssFallback = () => {
            const elements = (pieceElements || []).filter(Boolean);
            elements.forEach((el, i) => {
                setTimeout(() => {
                    const { x, y } = centerOf(el);
                    el.classList.add('fx-instantwin-piece-glow');
                    spawnParticles(x, y, { count: 20, colors: ['#ffd700', '#fff4c2', '#ffffff'], speed: 4, life: 650, gravity: -0.08 });
                    setTimeout(() => el.classList.remove('fx-instantwin-piece-glow'), 700);
                }, i * 220);
            });

            const flashDelay = elements.length * 220 + 500;
            setTimeout(() => {
                const container = document.querySelector('.game-container') || document.body;
                container.classList.add('fx-shake');
                setTimeout(() => container.classList.remove('fx-shake'), 450);

                const backdrop = document.createElement('div');
                backdrop.className = 'fx-instantwin-flash-backdrop';
                document.body.appendChild(backdrop);
                requestAnimationFrame(() => backdrop.classList.add('show'));

                spawnParticles(window.innerWidth / 2, window.innerHeight / 2, { count: 60, colors: ['#ffd700', '#fff4c2', '#ffffff'], speed: 8, life: 900, gravity: -0.05, spread: 360 });

                const banner = document.createElement('div');
                banner.className = 'fx-instantwin-banner';
                banner.textContent = bannerText || '';
                document.body.appendChild(banner);

                setTimeout(() => {
                    backdrop.classList.remove('show');
                    setTimeout(() => {
                        backdrop.remove();
                        banner.remove();
                        finish();
                    }, 500);
                }, 1500);
            }, flashDelay);
        };

        if (window.VisualEffects && typeof VisualEffects.getVideoFor === 'function') {
            VisualEffects.getVideoFor(kind, 'vittorie').then((videoPath) => {
                if (videoPath) playVideoOverlay(videoPath, finish);
                else runCssFallback();
            });
            return;
        }
        runCssFallback();
    }

    // ============================================================
    // 4) Danno subito — screen shake + vignette rossa
    // ============================================================
    function playDamageEffect(amount, opts = {}) {
        const container = document.querySelector('.game-container') || document.body;
        // Su un dispositivo touch la game-container coincide praticamente con
        // l'intera scena (field, carte, ologrammi e livelli ambientali):
        // traslarla per ogni danno forza la GPU mobile a ricomporre milioni di
        // pixel. Il colpo resta leggibile grazie a vignetta, flash e numero,
        // ma la scossa dell'intero viewport rimane riservata al puntatore fine.
        const mobileTouch = window.matchMedia
            && window.matchMedia('(pointer: coarse)').matches;
        if (!mobileTouch) {
            container.classList.add('fx-shake');
            setTimeout(() => container.classList.remove('fx-shake'), 450);
        }

        spawnDomFx('fx-damage-vignette', 0, 0, undefined, undefined, 500);

        if (opts.anchorEl) {
            const { x, y } = centerOf(opts.anchorEl);
            spawnDomFx('fx-damage-impact-flash', x, y, undefined, undefined, 550);
            spawnDomFx('fx-damage-impact-rays', x, y, undefined, undefined, 600);
            spawnParticles(x, y, { count: 22, colors: ['#e74c3c', '#ff6b6b', '#ffffff'], speed: 5.5, life: 550, gravity: 0.12 });
        }
    }

    // ============================================================
    // 5) Pescata carta — scia luminosa + particelle veloci
    // ============================================================
    function playDrawEffect(cardElement) {
        if (!cardElement) return;
        cardElement.classList.add('fx-draw-trail');
        const { x, y } = centerOf(cardElement);
        spawnParticles(x, y, { count: 10, colors: ['#7dd3fc', '#ffffff'], speed: 2.2, life: 400, gravity: 0, spread: 50, baseAngle: 180 });
        setTimeout(() => cardElement.classList.remove('fx-draw-trail'), 500);
    }

    // ============================================================
    // 6) Attivazione effetto carta — glow pulsante + overlay
    // ============================================================
    /**
     * Illumina una carta per un secondo.
     *
     * A fare il lavoro è l'OVERLAY, non la classe sulla carta, e la
     * differenza conta: se la carta sta sul Terreno, il suo nodo viene
     * sostituito al primo render successivo (riconciliaBoard confronta
     * l'HTML, e una classe in più lo cambia — vedi il commento in
     * js/engine/game-flow.js) portandosi via l'animazione. Misurato: il
     * bagliore partiva e si spegneva dopo 250ms, mentre l'overlay, che
     * vive su <body> e non dentro il Terreno, restava per tutta la sua
     * durata.
     *
     * La classe resta lo stesso, per le carte che NON stanno sul Terreno
     * (dove nessuno le sostituisce) e perché finché vive aggiunge il
     * bagliore sui bordi veri della carta, che un rettangolo sopra non sa
     * dare. È un di più che può svanire, non il meccanismo.
     */
    function playCardActivateEffect(cardElement) {
        if (!cardElement) return;
        cardElement.classList.add('fx-activate-glow');
        const rect = cardElement.getBoundingClientRect();
        // 1000: un secondo, come chiesto — e deve combaciare con la durata
        // di fxOverlayFade/fxActivatePulse in effects.css, altrimenti
        // l'elemento sparisce mentre la sua animazione sta ancora girando.
        spawnDomFx('fx-activate-overlay', rect.left, rect.top, rect.width, rect.height, 1000);
        setTimeout(() => cardElement.classList.remove('fx-activate-glow'), 1000);
    }

    // ============================================================
    // 6bis) Attivazione carta a CENTRO SCHERMO — per OGNI Magia/Trappola o
    // effetto Mostro che scatta o si attiva (manuale, es. cliccando
    // "Attiva", o automatico, es. un onDestroy/onAttackDeclare/
    // onStandbyPhase che scatta da solo): la carta appare grande al
    // centro dello schermo (dimensione da "dettaglio carta", vedi
    // --info-card-w in duelMonstersCore.html), pulsa un paio di volte con un
    // effetto audio, poi sparisce con un fade. Durata totale ~2s — vedi
    // fxActivateCenterCard in effects.css. `card` è l'oggetto carta
    // (da cards-db.js); richiede che window.createCardElement esista
    // (card-renderer.js, caricato prima di questo file nelle pagine di
    // duello).
    // ============================================================
    // Durata totale dell'animazione "carta a centro schermo" qui sotto,
    // in ms — deve combaciare con `2s` di fxActivateCenterCard in
    // effects.css. Esposta come FX.ACTIVATE_CENTER_DURATION_MS così ogni
    // effetto successivo scatenato da un'attivazione (Buco Nero, Spade
    // Rivelatrici, futuri) può aspettare che questa sia DAVVERO finita
    // prima di iniziare, invece di sovrapporsi: vedi il commento sull'uso
    // di questa costante in js/engine/card-effects.js (id 7 e id 8).
    const ACTIVATE_CENTER_DURATION_MS = 2000;

    function playCardActivateCenterScreen(card) {
        if (!card || typeof window.createCardElement !== 'function') return;

        const backdrop = document.createElement('div');
        backdrop.className = 'fx-activate-center-backdrop';
        document.body.appendChild(backdrop);

        const wrapper = document.createElement('div');
        wrapper.className = 'fx-activate-center-card';
        const cardEl = window.createCardElement(card);
        // --card-h è una custom property GLOBALE (definita su :root nelle
        // pagine di duello, per dimensionare le carte del Terreno) che si
        // eredita già calcolata da un --card-w tutto suo: impostare qui
        // solo --card-w non basta, il figlio erediterebbe comunque
        // quell'altezza sbagliata (da cui la carta "schiacciata") — va
        // quindi sovrascritta esplicitamente anche lei, in proporzione.
        cardEl.style.setProperty('--card-w', 'clamp(160px, 22vw, 260px)');
        cardEl.style.setProperty('--card-h', 'calc(clamp(160px, 22vw, 260px) / var(--card-ratio))');
        wrapper.appendChild(cardEl);
        document.body.appendChild(wrapper);

        // Libreria di effetti visivi nominati (vedi
        // js/ui/visual-effects-library.js): se la carta dichiara
        // card.visualEffect e il preset esiste, aggiunge un tocco extra
        // (glow colorato, raffica di particelle) SOPRA il pulse standard
        // qui sotto — mai al posto suo, così ogni carta continua a
        // mostrare almeno il flourish di sempre anche senza preset.
        if (window.VisualEffects) VisualEffects.applyPreset(card, wrapper, cardEl);

        // Il suono accompagna il momento in cui la carta "atterra" al
        // centro e comincia il pulse (~15% dei 2s totali, vedi la
        // keyframe), non l'istante iniziale in cui è ancora minuscola e
        // trasparente.
        setTimeout(() => {
            // Effetto audio DEDICATO per questa carta (audio/trappole/<id>.mp3
            // o audio/magie/<id>.mp3 — vedi js/audio/audio-library.js), se esiste;
            // altrimenti il suono "standard" di sempre (SFX.activateTrap()/
            // activateSpell(), che a loro volta possono ricadere su
            // audio/standard/ — vedi js/audio/sfx.js).
            const kind = card.type === 'trap' ? 'trappole' : 'magie';
            if (window.AudioLibrary && AudioLibrary.tryPlayCardSound(card, kind)) return;
            if (!window.SFX) return;
            if (card.type === 'trap') SFX.activateTrap();
            else SFX.activateSpell();
        }, 260);

        setTimeout(() => {
            backdrop.remove();
            wrapper.remove();
        }, 2000);
    }

    // ============================================================
    // 6ter) Spade Rivelatrici — barrage di spade di luce in stile
    // Forbidden Memories che calano dal cielo sull'intera fila di mostri
    // di `owner` ('player'/'bot'), una per slot, scaglionate, seguite da
    // un flash orizzontale su tutta la fila. A differenza di un normale
    // effetto "spettacolo", queste spade NON svaniscono da sole: restano
    // ferme esattamente dove atterrano finché il chiamante non ha
    // sostituito ogni carta con il segno permanente sullo slot
    // (.field-sword-mark, generato da renderFields() in game-flow.js) —
    // per questo `onLanded(removeFlyingSwords)`, richiamata quando
    // l'ultima è atterrata, passa al chiamante la funzione che le rimuove:
    // il chiamante (card-effects.js, id 8) prima aggiorna lo stato e
    // ridisegna il campo (facendo comparire i segni fissi), POI le
    // rimuove — mai il contrario, altrimenti si vedrebbe un vuoto tra le
    // due.
    // ============================================================
    function playSwordsOfRevealingLight(owner, onLanded) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slots = document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"]`);
        if (!slots.length) { if (typeof onLanded === 'function') onLanded(() => {}); return; }
        const rects = Array.from(slots).map((s) => s.getBoundingClientRect());
        const rowTop = Math.min(...rects.map((r) => r.top));
        const rowBottom = Math.max(...rects.map((r) => r.bottom));
        const rowLeft = Math.min(...rects.map((r) => r.left));
        const rowRight = Math.max(...rects.map((r) => r.right));

        const swordEls = rects.map((rect, i) => {
            const cx = rect.left + rect.width / 2;
            const sword = document.createElement('div');
            sword.className = 'fx-sword-beam';
            sword.innerHTML = '<span class="fx-sword-blade"></span><span class="fx-sword-guard"></span><span class="fx-sword-hilt"></span><span class="fx-sword-gem"></span>';
            const distanzaDalCentro = Math.abs(i - (rects.length - 1) / 2);
            const ordine = Math.round(distanzaDalCentro * 2);
            assegnaStile(sword.style, {
                left: `${cx}px`,
                top: '-140px',
                height: '140px',
                transitionDelay: `${ordine * 55}ms`
            });
            document.body.appendChild(sword);
            return sword;
        });
        void document.body.offsetWidth; // forza il reflow prima di animare `top`
        swordEls.forEach((sword) => { sword.style.top = `${rowBottom - 140}px`; });

        if (window.SFX && typeof SFX.swordsOfRevealingLight === 'function') SFX.swordsOfRevealingLight();

        const lastLandedAt = 400 + (rects.length - 1) * 55 + 400;
        setTimeout(() => {
            const flash = document.createElement('div');
            flash.className = 'fx-swords-row-flash';
            assegnaStile(flash.style, {
                left: `${rowLeft}px`,
                top: `${rowTop}px`,
                width: `${rowRight - rowLeft}px`,
                height: `${rowBottom - rowTop}px`
            });
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 650);
        }, lastLandedAt);

        setTimeout(() => {
            if (typeof onLanded === 'function') {
                onLanded(() => swordEls.forEach((el) => el.remove()));
            } else {
                swordEls.forEach((el) => el.remove());
            }
        }, lastLandedAt + 60);
    }

    // ============================================================
    // 6quater) Buco Nero — vortice oscuro al centro del campo che si
    //    allarga e risucchia tutti i mostri presenti. `sucked` è l'elenco
    //    { card, rect } di ogni mostro che c'era sul campo (entrambi i
    //    lati), catturato dal chiamante PRIMA di distruggerli davvero —
    //    vedi il commento in js/engine/card-effects.js (id 7) sul perché.
    // ============================================================
    // Raigeki colpisce tutti e cinque gli slot Mostro. La callback cade
    // sul lampo finale, cosi' le carte vengono distrutte visivamente al
    // momento dell'impatto e non prima dell'animazione.
    function playRaigeki(owner, onImpact) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const slots = Array.from(document.querySelectorAll(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"]`));
        if (!slots.length) { if (typeof onImpact === 'function') onImpact(); return; }

        const rects = slots.map((slot) => slot.getBoundingClientRect());
        const storm = document.createElement('div');
        storm.className = 'fx-raigeki-storm';
        document.body.appendChild(storm);

        const center = (rects.length - 1) / 2;
        const order = rects.map((_, i) => i).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
        const bolts = [];
        order.forEach((slotIndex, sequence) => {
            const rect = rects[slotIndex];
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height * 0.52;
            const bolt = document.createElement('div');
            bolt.className = 'fx-raigeki-bolt';
            bolt.innerHTML = '<span class="fx-raigeki-core"></span><span class="fx-raigeki-branch fx-raigeki-branch-a"></span><span class="fx-raigeki-branch fx-raigeki-branch-b"></span>';
            assegnaStile(bolt.style, { left: `${x}px`, top: '0px', height: `${Math.max(120, y)}px`, animationDelay: `${sequence * 75}ms` });
            document.body.appendChild(bolt);
            bolts.push(bolt);

            setTimeout(() => {
                const hit = document.createElement('div');
                hit.className = 'fx-raigeki-impact';
                assegnaStile(hit.style, { left: `${x}px`, top: `${y}px`, width: `${rect.width * 1.55}px`, height: `${rect.height * 1.15}px` });
                document.body.appendChild(hit);
                setTimeout(() => hit.remove(), 560);
            }, 330 + sequence * 75);
        });

        if (window.SFX && typeof SFX.raigeki === 'function') SFX.raigeki();
        const impactAt = 330 + (rects.length - 1) * 75;
        setTimeout(() => {
            storm.classList.add('fx-raigeki-storm-impact');
            if (typeof onImpact === 'function') onImpact();
        }, impactAt);
        setTimeout(() => {
            bolts.forEach((el) => el.remove());
            storm.remove();
        }, impactAt + 720);
    }

    function playDarkHoleVortex(sucked) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const vortex = document.createElement('div');
        vortex.className = 'fx-darkhole-vortex';
        vortex.innerHTML = '<span class="fx-darkhole-lens"></span><span class="fx-darkhole-disc"></span><span class="fx-darkhole-core"></span><span class="fx-darkhole-ring fx-darkhole-ring-a"></span><span class="fx-darkhole-ring fx-darkhole-ring-b"></span>';
        vortex.style.left = `${cx}px`;
        vortex.style.top = `${cy}px`;
        document.body.appendChild(vortex);
        setTimeout(() => vortex.remove(), 2200);

        if (window.SFX) SFX.darkHole();

        if (!Array.isArray(sucked) || typeof window.createCardElement !== 'function') return;
        sucked.forEach(({ card, rect }, i) => {
            if (!card || !rect || rect.width === 0) return;
            const ghost = window.createCardElement(card);
            ghost.classList.add('fx-darkhole-sucked');
            assegnaStile(ghost.style, {
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                margin: '0',
                zIndex: '10052',
                pointerEvents: 'none',
                transitionDelay: `${230 + i * 35}ms`
            });
            document.body.appendChild(ghost);
            void ghost.offsetWidth; // forza il reflow prima di animare la "caduta" verso il centro
            ghost.style.left = `${cx}px`;
            ghost.style.top = `${cy}px`;
            ghost.style.width = '4px';
            ghost.style.height = '4px';
            ghost.style.opacity = '0';
            ghost.style.transform = `translate(-50%, -50%) rotate(${(i % 2 === 0 ? 1 : -1) * 540}deg)`;
            setTimeout(() => ghost.remove(), 1750 + i * 35);
        });
    }

    // ============================================================
    // 7) Scontro epico in battaglia — quando due mostri si scontrano.
    //    Stesso linguaggio visivo dell'annuncio "BATTLE PHASE" (flash
    //    bianco/oro/rosso + raggi rotanti + screen-shake), ma localizzato
    //    nel punto d'impatto tra le due carte e molto più breve.
    // ============================================================
    function playBattleClashEpic(attackerEl, targetEl) {
        const a = attackerEl ? centerOf(attackerEl) : null;
        const t = targetEl ? centerOf(targetEl) : null;
        const point = t || a;
        if (!point) return;
        const midX = a && t ? (a.x + t.x) / 2 : point.x;
        const midY = a && t ? (a.y + t.y) / 2 : point.y;

        spawnDomFx('fx-clash-flash', midX, midY, undefined, undefined, 550);
        spawnDomFx('fx-clash-rays', midX, midY, undefined, undefined, 600);

        const container = document.querySelector('.game-container') || document.body;
        container.classList.add('fx-clash-shake');
        setTimeout(() => container.classList.remove('fx-clash-shake'), 500);

        spawnParticles(midX, midY, { count: 30, colors: ['#ffffff', '#f7d774', '#e74c3c'], speed: 7, life: 500 });
    }

    // ============================================================
    // 8) Sacrificio per Evocazione Tributo — implosione + fascio di luce
    // ============================================================
    /**
     * L'attacco si infrange: il bersaglio ha retto. Versione di base, in
     * CSS/DOM come il resto di questo file — quella spettacolare la
     * fornisce il backend GSAP (js/ui/fx-gsap.js), che la rimpiazza.
     * Chiamata da triggerBlockedEffect (js/engine/actions.js) quando dopo
     * il calcolo della battaglia lo slot del bersaglio e' ancora occupato.
     */
    function playAttackBlocked(attackerEl, targetEl) {
        if (!targetEl) return;
        const t = centerOf(targetEl);

        targetEl.classList.add('fx-blocked-shake');
        setTimeout(() => targetEl.classList.remove('fx-blocked-shake'), 420);

        spawnDomFx('fx-block-shield', t.x, t.y, undefined, undefined, 700);

        // Le scintille rimbalzano INDIETRO, verso chi ha attaccato: e' il
        // dettaglio che distingue un colpo respinto da uno andato a segno.
        const a = attackerEl ? centerOf(attackerEl) : null;
        const baseAngle = a ? Math.atan2(a.y - t.y, a.x - t.x) * (180 / Math.PI) : -90;
        spawnParticles(t.x, t.y, {
            count: 22, colors: ['#bfe9ff', '#ffffff', '#7dd3fc'],
            speed: 6, life: 550, size: 3, spread: 90, baseAngle: baseAngle, gravity: 0.06
        });
    }

    /** Rettangolo a schermo di una casella del Terreno — condiviso da chi deve animare qualcosa da una casella all'altra. */
    function fieldSlotRect(owner, index, type) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const el = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="${type || 'monster'}"][data-index="${index}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width ? r : null;
    }

    /**
     * Rettangolo a schermo di una PILA (Cimitero, Deck, Extra Deck) di un
     * lato. Gemella di fieldSlotRect qui sopra per le zone che non hanno
     * un indice: il Cimitero è una casella sola, marcata `data-zone` da
     * createSlotElement (js/engine/game-flow.js).
     */
    /**
     * Come Object.assign(el.style, {...}), ma capisce anche le variabili CSS ('--x': ...): su uno stile
     * Object.assign scrive una proprieta' JavaScript qualunque e le variabili NON arrivano al CSS (le
     * animazioni partivano da un punto sbagliato, p. es. Mostro Resuscitato dal Cimitero errato).
     */
    function assegnaStile(stile, valori) {
        Object.keys(valori).forEach((chiave) => {
            if (chiave.indexOf('--') === 0) stile.setProperty(chiave, String(valori[chiave]));
            else stile[chiave] = valori[chiave];
        });
        return stile;
    }

    function zoneRect(owner, zone) {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const el = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-zone="${zone}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width ? r : null;
    }

    /** Trova una carta ancora disegnata, anche se il motore l'ha già tolta dallo stato. */
    function cardRect(card) {
        if (!card || !card.uid) return null;
        const safeUid = window.CSS && typeof CSS.escape === 'function' ? CSS.escape(String(card.uid)) : String(card.uid).replace(/["\\]/g, '\\$&');
        const el = document.querySelector(`.card[data-uid="${safeUid}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width ? r : null;
    }

    /** Rettangolo visivo di mano e zona bandite, che non sono caselle del tabellone. */
    function looseZoneRect(owner, zone) {
        const id = zone === 'hand'
            ? (owner === 'player' ? 'playerHand' : 'botHand')
            : (owner === 'player' ? 'playerBanishedBadge' : 'botBanishedBadge');
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width) return r;
        // Al primo bando la pillola è ancora display:none: il motore emette
        // l'evento PRIMA di aggiornare lo stato. Si mira quindi al riquadro
        // del giocatore che la contiene; dal render seguente la pillola
        // comparirà esattamente in quella zona.
        if (zone === 'banished') {
            const info = document.getElementById(owner === 'player' ? 'playerInfo' : 'botInfo');
            const fallback = info && info.getBoundingClientRect();
            if (fallback && fallback.width) return fallback;
        }
        return null;
    }

    function transitionRect(descriptor, card, source) {
        if (!descriptor) return source ? cardRect(card) : null;
        if (descriptor.kind === 'auto') return cardRect(card);
        if (descriptor.kind === 'field') return fieldSlotRect(descriptor.owner, descriptor.index, descriptor.type);
        if (descriptor.kind === 'hand' || descriptor.kind === 'banished') return looseZoneRect(descriptor.owner, descriptor.kind);
        if (descriptor.kind === 'deck' || descriptor.kind === 'graveyard' || descriptor.kind === 'fusion') return zoneRect(descriptor.owner, descriptor.kind);
        return null;
    }

    /**
     * Feedback condiviso per gli spostamenti che prima avvenivano di colpo:
     * scarto, ricerca, bando e ritorno in mano/Deck. Non blocca le regole:
     * il fantasma resta sopra il ridisegno e rende leggibile il movimento.
     */
    function playZoneTransition(movement) {
        if (!movement || !movement.carta) return false;
        const from = transitionRect(movement.da || { kind: 'auto' }, movement.carta, true);
        const rawTo = transitionRect(movement.a, movement.carta, false);
        if (!from || !rawTo) return false;
        const variant = movement.variante || 'move';
        const presets = {
            hand: { duration: 760, scaleTo: 0.72, spin: 7, glow: 'rgba(105, 210, 255, 0.9)' },
            discard: { duration: 720, scaleTo: 0.42, spin: -12, glow: 'rgba(165, 175, 205, 0.9)' },
            banish: { duration: 850, scaleTo: 0.32, spin: 22, glow: 'rgba(190, 105, 255, 0.95)' },
            deck: { duration: 780, scaleTo: 0.42, spin: 10, glow: 'rgba(245, 205, 95, 0.85)' },
            search: { duration: 820, scaleTo: 0.72, spin: -5, glow: 'rgba(105, 225, 255, 0.95)' }
        };
        const p = presets[variant] || presets.hand;
        // Le mani sono contenitori larghi: si mira al centro mantenendo la
        // dimensione finale della carta, non al loro angolo in alto a sinistra.
        const to = {
            left: rawTo.left + rawTo.width / 2 - from.width * p.scaleTo / 2,
            top: rawTo.top + rawTo.height / 2 - from.height * p.scaleTo / 2,
            width: from.width * p.scaleTo,
            height: from.height * p.scaleTo
        };
        playCardTravel(movement.carta, from, to, p);
        const color = variant === 'banish' ? ['#b66cff', '#f0d2ff', '#ffffff']
            : variant === 'discard' ? ['#78839a', '#ccd5e5', '#ffffff']
                : ['#66d9ff', '#f6d46b', '#ffffff'];
        spawnParticles(from.left + from.width / 2, from.top + from.height / 2, {
            count: variant === 'banish' ? 18 : 10, colors: color, speed: 3.2, life: 620, gravity: -0.01
        });
        return true;
    }

    /**
     * IL VIAGGIO DI UNA CARTA DA UN PUNTO A UN ALTRO — il pezzo condiviso
     * da ogni spostamento visibile (Terreno→Cimitero, Cimitero→Terreno,
     * passaggio di controllo e ritorno).
     *
     * Perché un helper solo invece di quattro animazioni separate: sono
     * tutte la stessa cosa — una copia della carta che vola da un
     * rettangolo a un altro — e cambiano solo colore, durata e verso. Le
     * differenze stanno nelle opzioni, non in quattro funzioni che
     * divergono alla prima modifica.
     *
     * La copia è un "fantasma" appeso a `document.body` e non la carta
     * vera: il Terreno viene riconciliato ad ogni render (vedi
     * riconciliaBoard in js/engine/game-flow.js) e un'animazione appesa a
     * una casella verrebbe interrotta al primo aggiornamento — il nodo
     * viene sostituito appena il suo HTML cambia, ed è esattamente quello
     * che succede quando una carta lascia il campo.
     *
     * `opts.scaleTo` sotto 1 fa "rimpicciolire" la carta mentre entra in
     * una pila (è quello che la fa leggere come "riposta via"), sopra 1 la
     * fa arrivare in primo piano. `opts.arc` alza il punto di mezzo: senza,
     * due caselle sulla stessa riga danno uno scivolamento piatto.
     */
    function playCardTravel(card, from, to, opts) {
        if (!card || !from || !to || typeof window.createCardElement !== 'function') return null;
        const o = opts || {};
        const durata = o.duration || 620;
        const ghost = window.createCardElement(card);
        ghost.classList.add('fx-card-travel');
        assegnaStile(ghost.style, {
            position: 'fixed',
            left: `${from.left}px`,
            top: `${from.top}px`,
            width: `${from.width}px`,
            height: `${from.height}px`,
            margin: '0',
            zIndex: '10045',
            pointerEvents: 'none',
            transformOrigin: 'center center',
            filter: o.glow ? `drop-shadow(0 0 18px ${o.glow})` : 'none'
        });
        document.body.appendChild(ghost);

        // L'arco si fa con le Web Animations invece che con una
        // transizione: servono tre fotogrammi (partenza, colmo, arrivo) e
        // una transizione CSS ne conosce solo due.
        const dx = to.left - from.left;
        const dy = to.top - from.top;
        const alzata = o.arc === 0 ? 0 : (o.arc || Math.min(90, Math.abs(dy) * 0.35 + 30));
        const scalaFinale = o.scaleTo == null ? 1 : o.scaleTo;
        const rotazione = o.spin ? `rotate(${o.spin}deg)` : '';
        const anim = ghost.animate([
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            {
                transform: `translate(${dx / 2}px, ${dy / 2 - alzata}px) scale(${(1 + scalaFinale) / 2 * 1.06}) ${rotazione}`,
                opacity: 1,
                offset: 0.55
            },
            {
                transform: `translate(${dx}px, ${dy}px) scale(${scalaFinale}) ${rotazione}`,
                opacity: o.fadeOut === false ? 1 : 0.15
            }
        ], { duration: durata, easing: o.easing || 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' });

        const chiudi = () => {
            ghost.remove();
            if (typeof o.onDone === 'function') o.onDone();
        };
        // Sia `finished` sia un timeout di sicurezza: se la scheda finisce
        // in secondo piano le animazioni vengono sospese e `finished` può
        // non risolversi mai, lasciando un fantasma appeso sopra il campo.
        if (anim && anim.finished) anim.finished.then(chiudi).catch(chiudi);
        setTimeout(() => { if (ghost.isConnected) chiudi(); }, durata + 400);
        return ghost;
    }

    /**
     * Una carta lascia il Terreno e finisce nel Cimitero. Va chiamata
     * PRIMA di svuotare la casella, finché la carta è ancora a schermo:
     * dopo, il rettangolo di partenza non esiste più.
     */
    function playCardToGraveyard(card, fieldOwner, fieldIndex, graveOwner, type) {
        const from = fieldSlotRect(fieldOwner, fieldIndex, type);
        const to = zoneRect(graveOwner == null ? fieldOwner : graveOwner, 'graveyard');
        if (!from || !to) return;
        playCardTravel(card, from, to, {
            duration: 560,
            scaleTo: 0.45,
            spin: -8,
            glow: 'rgba(160, 170, 200, 0.85)'
        });
        spawnParticles(from.left + from.width / 2, from.top + from.height / 2, {
            count: 14, colors: ['#8892a8', '#c9d2e4', '#5a6273'], speed: 3, life: 520, gravity: 0.12
        });
    }

    /**
     * Il contrario: una carta risale dal Cimitero al Terreno (Rinascita
     * del Mostro e tutte le altre rianimazioni). Arriva in primo piano e
     * NON svanisce — la carta vera comparirà lì sotto al render
     * successivo, quindi il fantasma deve consegnarle il posto già pieno
     * invece di lasciare un buco per un fotogramma.
     */
    function playCardFromGraveyard(card, graveOwner, toOwner, toIndex) {
        const from = zoneRect(graveOwner, 'graveyard');
        const to = fieldSlotRect(toOwner, toIndex);
        if (!from || !to) return;
        playCardTravel(card, from, to, {
            duration: 620,
            scaleTo: 1,
            fadeOut: false,
            glow: 'rgba(190, 120, 255, 0.9)',
            easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)'
        });
        spawnParticles(to.left + to.width / 2, to.top + to.height / 2, {
            count: 22, colors: ['#b478ff', '#e9c9ff', '#ffffff'], speed: 4, life: 700, gravity: -0.08
        });
    }

    /**
     * Passaggio di controllo (Cambio di Cuore, Controllo Mentale...): la
     * carta attraversa il campo dalla casella che lascia a quella dove
     * arriva. Versione di base; il backend GSAP la rimpiazza con una piu'
     * elaborata.
     * Chiamata da ACTIONS.takeControl (js/engine/duel-engine.js) PRIMA del
     * render successivo, quando entrambe le caselle sono ancora al loro
     * posto a schermo.
     *
     * `tornaIndietro`: lo stesso viaggio al contrario, quando il controllo
     * temporaneo scade e la carta torna dal suo proprietario originale
     * (processTemporaryControlReturns). Prima era animato solo l'ANDATA, e
     * il ritorno avveniva di colpo al render successivo — la carta
     * spariva da un lato e ricompariva dall'altro senza che si capisse
     * cos'era successo.
     */
    function playControlSwitch(card, fromOwner, fromIndex, toOwner, toIndex, tornaIndietro) {
        if (!card || typeof window.createCardElement !== 'function') return;
        const from = fieldSlotRect(fromOwner, fromIndex);
        const to = fieldSlotRect(toOwner, toIndex);
        if (!from || !to) return;

        // Il ritorno usa un colore più freddo dell'andata: sono due eventi
        // opposti e devono leggersi come tali senza doverci pensare.
        playCardTravel(card, from, to, {
            duration: 620,
            scaleTo: 1,
            fadeOut: false,
            glow: tornaIndietro ? 'rgba(120, 200, 255, 0.9)' : 'rgba(200, 120, 255, 0.9)'
        });

        spawnParticles(from.left + from.width / 2, from.top + from.height / 2, {
            count: 18,
            colors: tornaIndietro ? ['#78c8ff', '#c9e9ff', '#ffffff'] : ['#c87aff', '#e9c9ff', '#ffffff'],
            speed: 3.5, life: 600, gravity: -0.04
        });
    }

    function playTributeSacrifice(cardElement) {
        if (!cardElement) return;
        const { x, y, rect } = centerOf(cardElement);

        cardElement.classList.add('fx-tribute-vanish');
        setTimeout(() => cardElement.classList.remove('fx-tribute-vanish'), 700);

        spawnDomFx('fx-tribute-beam', x, y, rect.width * 0.7, rect.height * 1.8, 700);

        spawnParticles(x, y, { count: 26, colors: ['#8e44ad', '#f7d774', '#ffffff'], speed: 5, life: 650, gravity: -0.14, spread: 70, baseAngle: -90 });
    }

    /**
     * Lancio di moneta a schermo intero (Testa/Croce): usato da OGNI carta
     * con un lancio di moneta nel suo testo (Mago del Tempo id 28, Drago
     * Barile id 104, ecc. — vedi card-effects.js) invece che restare solo
     * un `Math.random()` con un log testuale, che il giocatore poteva
     * facilmente non notare (log di default chiuso). Puramente visivo e
     * "fire and forget", come playCardActivateCenterScreen sopra: NON
     * ritarda/blocca la risoluzione dell'effetto vero, che il chiamante
     * calcola comunque subito — la moneta si limita a mostrare a schermo
     * il risultato GIÀ deciso.
     */
    function playCoinFlip(heads) {
        const backdrop = document.createElement('div');
        backdrop.className = 'fx-randomizer-backdrop';
        const coin = document.createElement('div');
        coin.className = 'fx-coinflip-coin';
        coin.textContent = '🪙';
        const label = document.createElement('div');
        label.className = 'fx-coinflip-label';
        label.textContent = heads ? 'TESTA' : 'CROCE';
        backdrop.appendChild(coin);
        backdrop.appendChild(label);
        document.body.appendChild(backdrop);
        // Rivela il risultato sulla moneta proprio mentre la rotazione
        // CSS (fxCoinSpin, 1.1s) sta per fermarsi, invece che a rotazione
        // già ferma — dà la sensazione che sia la moneta STESSA a
        // "decidere" il risultato atterrando, non un testo scollegato.
        setTimeout(() => { coin.textContent = heads ? '☀️' : '🌑'; }, 1000);
        setTimeout(() => backdrop.remove(), 1700);
    }

    /**
     * Lancio di dado a sei facce a schermo intero — stesso schema di
     * playCoinFlip sopra (fire and forget, non ritarda la risoluzione
     * dell'effetto), usato da ogni carta con un vero lancio di dado nel
     * testo (Dado di Evocazione id 460, Dado Teschio id 445, Dado
     * Aggraziato id 273). `result` è il numero 1-6 già deciso da chi
     * chiama.
     */
    function playDiceRoll(result) {
        const backdrop = document.createElement('div');
        backdrop.className = 'fx-randomizer-backdrop';
        const die = document.createElement('div');
        die.className = 'fx-dice-cube';
        die.textContent = '🎲';
        const label = document.createElement('div');
        label.className = 'fx-dice-label';
        label.textContent = `RISULTATO: ${result}`;
        backdrop.appendChild(die);
        backdrop.appendChild(label);
        document.body.appendChild(backdrop);
        setTimeout(() => { die.textContent = String(result); }, 1000);
        setTimeout(() => backdrop.remove(), 1700);
    }

    // ============================================================
    // BACKEND DI ANIMAZIONE INTERCAMBIABILI
    // ============================================================
    // Tutte le animazioni qui sopra sono scritte a mano con CSS + DOM +
    // canvas 2D, e restano l'implementazione DI BASE: quella che c'e'
    // sempre, che non dipende da niente e che funziona ovunque.
    //
    // Un "backend" e' un pacchetto opzionale che ne RIMPIAZZA alcune con
    // una versione fatta con una libreria (es. js/ui/fx-gsap.js, che usa
    // GSAP per le timeline). Si registra da solo e dichiara di cosa ha
    // bisogno; se quella roba non c'e', semplicemente non si attiva.
    //
    // Il punto di tutto questo e' che `FX.playQualcosa(...)` resta l'unica
    // API che il resto del gioco conosce: il motore (actions.js,
    // game-flow.js, bot.js...) non sa nemmeno che i backend esistono e non
    // va toccato ne' per aggiungerne uno ne' per toglierlo.
    //
    // COME SI SPEGNE: cancellare il file del backend basta e avanza — con
    // nessuno registrato si torna esattamente al comportamento attuale.
    // Senza cancellare niente: window.FX_BACKEND = 'css' (o il nome di un
    // backend specifico per forzare proprio quello).
    //
    // Se un backend lancia un'eccezione, l'animazione di base parte
    // comunque al suo posto: un plugin decorativo non deve MAI poter
    // rompere un duello in corso — stesso principio di safeCallCardHandler
    // in js/engine/duel-engine.js.
    const fxBackends = [];
    let fxActiveBackend = null;

    function fxPrefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /** Rivaluta quale backend e' attivo: l'ultimo registrato le cui dipendenze sono tutte pronte. */
    function resolveFxBackend() {
        fxActiveBackend = null;
        if (window.FX_BACKEND === 'css') return;
        for (let i = fxBackends.length - 1; i >= 0; i--) {
            const b = fxBackends[i];
            if (window.FX_BACKEND && b.name !== window.FX_BACKEND) continue;
            if ((b.requires || []).every((global) => !!window[global])) { fxActiveBackend = b; return; }
        }
    }

    /**
     * Registra un backend. `def.requires` elenca i GLOBALI che devono
     * esistere perche' sia utilizzabile (es. ['gsap']) — controllati ad
     * ogni risoluzione, non solo alla registrazione, perche' le librerie
     * di js/vendor/ arrivano in modo pigro dopo l'evento 'load'.
     * `def.impls` e' una mappa PARZIALE nome-animazione -> funzione: le
     * animazioni non elencate restano quelle di base.
     */
    function registerBackend(name, def) {
        fxBackends.push({ name: name, requires: (def && def.requires) || [], impls: (def && def.impls) || {} });
        resolveFxBackend();
    }

    /**
     * Avvolge un'animazione di base in modo che passi dal backend attivo,
     * se ne esiste uno che la rimpiazza. Tre motivi per cui puo' ricadere
     * sulla base: nessun backend attivo, il backend non rimpiazza QUESTA
     * animazione, oppure chi ha chiesto meno movimento
     * (prefers-reduced-motion) — li' le versioni CSS sono gia' neutralizzate
     * dai @media dei fogli di stile, mentre una timeline JS continuerebbe
     * ad animare ignorando la preferenza.
     */
    function viaBackend(name, builtin) {
        return function () {
            // Il backend si sceglie PER EFFETTO: dall'ultimo registrato al primo, il primo pronto che
            // rimpiazza QUESTA animazione. Cosi' un backend specializzato (es. js/ui/fx-webgl.js, che
            // rifa' solo gli spettacoli piu' pesanti) convive con quello generale (fx-gsap.js) invece
            // di spegnerlo. Se uno fallisce si prova il precedente, e infine la base.
            if (!fxPrefersReducedMotion() && window.FX_BACKEND !== 'css') {
                for (let i = fxBackends.length - 1; i >= 0; i--) {
                    const backend = fxBackends[i];
                    if (window.FX_BACKEND && backend.name !== window.FX_BACKEND) continue;
                    if (typeof backend.impls[name] !== 'function') continue;
                    if (!(backend.requires || []).every((global) => !!window[global])) continue;
                    try {
                        return backend.impls[name].apply(null, arguments);
                    } catch (e) {
                        console.warn(`[FX] backend "${backend.name}" fallito su ${name}, provo il successivo:`, e);
                    }
                }
            }
            return builtin.apply(null, arguments);
        };
    }

    /**
     * La convergenza elementale e' chiamata SOLO da dentro questo file
     * (playMonsterSummonEffect), quindi avvolgerla solo sulla facciata non
     * servirebbe a nulla: le chiamate interne non passerebbero dal wrapper.
     * Per questo esiste questa versione instradata, che playMonsterSummonEffect
     * usa al posto di quella diretta — cosi' anche la sequenza di
     * Evocazione di Livello 7+ puo' essere rimpiazzata da un backend.
     */
    const runElementalConvergence = viaBackend('playElementalConvergence', playElementalConvergence);
    /** Idem per il cerchio di Evocazione, chiamato anche da playMonsterSummonEffect qui dentro. */
    const runSummonCircle = viaBackend('playSummonCircle', playSummonCircle);

    /**
     * Spade Rivelatrici via backend, ma con una RETE DI SICUREZZA: il
     * chiamante (card-effects.js, id 8) aspetta `onLanded` per ridisegnare
     * il campo e poi togliere le spade volanti. Se un backend si
     * dimenticasse di richiamarla, le spade resterebbero a schermo per
     * sempre sopra il campo — quindi qui `onLanded` viene comunque
     * invocata da un timer di scorta, ed e' resa IDEMPOTENTE (chi arriva
     * secondo non fa nulla), esattamente come il `chiudi()` di
     * playMonsterSummonEffect.
     *
     * Il tetto e' generoso di proposito: non deve mai scattare prima della
     * versione "buona", solo salvare il duello se quella non arriva mai.
     */
    const SWORDS_SAFETY_MS = 4000;
    const swordsViaBackend = viaBackend('playSwordsOfRevealingLight', playSwordsOfRevealingLight);
    function swordsWithSafetyNet(owner, onLanded) {
        let giaFatto = false;
        const unaVoltaSola = (removeFlyingSwords) => {
            if (giaFatto) return;
            giaFatto = true;
            const rimuovi = typeof removeFlyingSwords === 'function' ? removeFlyingSwords : function () {};
            if (typeof onLanded === 'function') onLanded(rimuovi);
            else rimuovi();
        };
        setTimeout(() => {
            if (giaFatto) return;
            console.warn('[FX] playSwordsOfRevealingLight: nessun onLanded dal backend, la rete di sicurezza prosegue il duello.');
            unaVoltaSola(() => {
                document.querySelectorAll('.fx-sword-beam').forEach((el) => el.remove());
            });
        }, SWORDS_SAFETY_MS);
        swordsViaBackend(owner, unaVoltaSola);
    }

    const RAIGEKI_SAFETY_MS = 2600;
    const raigekiViaBackend = viaBackend('playRaigeki', playRaigeki);
    function raigekiWithSafetyNet(owner, onImpact) {
        let resolved = false;
        const impactOnce = () => {
            if (resolved) return;
            resolved = true;
            if (typeof onImpact === 'function') onImpact();
        };
        setTimeout(() => {
            if (!resolved) console.warn('[FX] playRaigeki: callback di impatto mancante, risolvo comunque la carta.');
            impactOnce();
        }, RAIGEKI_SAFETY_MS);
        raigekiViaBackend(owner, impactOnce);
    }

    window.FX = {
        registerBackend: registerBackend,
        /** Nome del backend attivo, o null se si stanno usando le animazioni di base — utile in console per capire cosa sta girando davvero. */
        activeBackend: function () { return fxActiveBackend ? fxActiveBackend.name : null; },
        /** Nome del backend che eseguirebbe QUESTO effetto adesso (null = la versione di base). Serve a chi deve spegnere i propri strati DOM quando c'e' gia' la versione WebGL. */
        backendFor: function (name) {
            if (fxPrefersReducedMotion() || window.FX_BACKEND === 'css') return null;
            for (let i = fxBackends.length - 1; i >= 0; i--) {
                const b = fxBackends[i];
                if (window.FX_BACKEND && b.name !== window.FX_BACKEND) continue;
                if (typeof b.impls[name] !== 'function') continue;
                if (!(b.requires || []).every((g) => !!window[g])) continue;
                return b.name;
            }
            return null;
        },
        /** Da richiamare se le dipendenze di un backend arrivano DOPO la sua registrazione (caricamento pigro). */
        refreshBackend: resolveFxBackend,

        playBattleDestroyEffect: viaBackend('playBattleDestroyEffect', playBattleDestroyEffect),
        playSpellTrapDestroyEffect,
        playSummonShockwave: viaBackend('playSummonShockwave', playSummonShockwave),
        playCardSet: viaBackend('playCardSet', playCardSet),
        playEquipAttach: viaBackend('playEquipAttach', playEquipAttach),
        playDamageEffect: viaBackend('playDamageEffect', playDamageEffect),
        playTributeSacrifice: viaBackend('playTributeSacrifice', playTributeSacrifice),
        playBattleClashEpic: viaBackend('playBattleClashEpic', playBattleClashEpic),
        playAttackBlocked: viaBackend('playAttackBlocked', playAttackBlocked),
        // Posizione scelta per un mostro (barriera in Difesa, carica in Attacco): solo WebGL, senza base (chi chiama
        // controlla backendFor e, se manca, usa le icone di sempre).
        playActivationAura: viaBackend('playActivationAura', function () {}),
        playChainLink: viaBackend('playChainLink', function () {}),
        playPositionDefense: viaBackend('playPositionDefense', function () {}),
        playPositionAttack: viaBackend('playPositionAttack', function () {}),
        playControlSwitch: viaBackend('playControlSwitch', playControlSwitch),
        // Spostamenti di carta fra zone. `playCardTravel` è il mattone
        // condiviso ed è esposto apposta: una zona nuova (bando, Extra
        // Deck, mano) si anima passando due rettangoli, senza aggiungere
        // una funzione per ogni coppia di zone.
        playCardTravel: viaBackend('playCardTravel', playCardTravel),
        playZoneTransition,
        playCardToGraveyard: viaBackend('playCardToGraveyard', playCardToGraveyard),
        playCardFromGraveyard: viaBackend('playCardFromGraveyard', playCardFromGraveyard),
        fieldSlotRect: fieldSlotRect,
        zoneRect: zoneRect,
        playDrawEffect: viaBackend('playDrawEffect', playDrawEffect),
        // Rimescolamento del Mazzo: solo WebGL, senza versione di base (senza WebGL non succede niente, come per le aure).
        playDeckShuffle: viaBackend('playDeckShuffle', function () {}),
        playRaigeki: raigekiWithSafetyNet,
        playDarkHoleVortex: viaBackend('playDarkHoleVortex', playDarkHoleVortex),
        playMirrorForce: viaBackend('playMirrorForce', playMirrorForce),
        playMagicCylinder: viaBackend('playMagicCylinder', playMagicCylinder),
        playMonsterReborn: viaBackend('playMonsterReborn', playMonsterReborn),
        playTrapHole: viaBackend('playTrapHole', playTrapHole),
        playTorrentialTribute: viaBackend('playTorrentialTribute', playTorrentialTribute),
        playRingOfDestruction: viaBackend('playRingOfDestruction', playRingOfDestruction),
        playHeavyStorm: viaBackend('playHeavyStorm', playHeavyStorm),
        playMysticalSpaceTyphoon: viaBackend('playMysticalSpaceTyphoon', playMysticalSpaceTyphoon),
        playMindControl: viaBackend('playMindControl', playMindControl),
        playCallOfTheHaunted: viaBackend('playCallOfTheHaunted', playCallOfTheHaunted),
        playBottomlessTrapHole: viaBackend('playBottomlessTrapHole', playBottomlessTrapHole),
        playSakuretsuArmor: viaBackend('playSakuretsuArmor', playSakuretsuArmor),
        playSolemnJudgment: viaBackend('playSolemnJudgment', playSolemnJudgment),
        playBookOfMoon: viaBackend('playBookOfMoon', playBookOfMoon),
        playCrushCardVirus: viaBackend('playCrushCardVirus', playCrushCardVirus),
        playNegateAttack: viaBackend('playNegateAttack', playNegateAttack),
        playScapegoat: viaBackend('playScapegoat', playScapegoat),
        playMysticBox: viaBackend('playMysticBox', playMysticBox),
        playLimiterRemoval: viaBackend('playLimiterRemoval', playLimiterRemoval),
        playShadowSpell: viaBackend('playShadowSpell', playShadowSpell),
        playSpellbindingCircle: viaBackend('playSpellbindingCircle', playSpellbindingCircle),
        playMagicalHats: viaBackend('playMagicalHats', playMagicalHats),
        playMultiply: viaBackend('playMultiply', playMultiply),
        playEnemyController: viaBackend('playEnemyController', playEnemyController),
        playDimensionHole: viaBackend('playDimensionHole', playDimensionHole),
        playCoinFlip: viaBackend('playCoinFlip', playCoinFlip),
        playDiceRoll: viaBackend('playDiceRoll', playDiceRoll),
        // ATTENZIONE per chi scrivera' un backend per questa: i chiamanti
        // non aspettano una callback, aspettano ACTIVATE_CENTER_DURATION_MS
        // e tirano dritto. Una versione che sfora lascia una carta a
        // schermo mentre il gioco e' gia' andato avanti.
        // La comparsa a centro schermo, PIÙ l'illuminazione della carta
        // dove sta sul Terreno, se ci sta.
        //
        // L'illuminazione è avvolta QUI sulla facciata e non dentro
        // playCardActivateCenterScreen, perché quella passa dai backend
        // (js/ui/fx-gsap.js ne ha una versione tutta sua) e finirebbe
        // scavalcata — misurato: con il backend attivo non succedeva più
        // nulla. Qui invece vale per entrambi.
        //
        // E sta su questo unico punto e non nei chiamanti perché di
        // chiamanti ce ne sono tredici in js/engine/duel-engine.js:
        // l'attivazione manuale, la risposta in Chain, e ognuno dei trigger
        // reattivi (onFlip, onDestroy, onSummon, onPositionChange...).
        // Questo è il passaggio obbligato di tutti, quindi il bagliore
        // resta per costruzione insieme al suono di attivazione.
        playCardActivateCenterScreen: (function () {
            const alCentro = viaBackend('playCardActivateCenterScreen', playCardActivateCenterScreen);
            return function (card) {
                alCentro(card);
                // Aura WebGL dietro la carta (solo se c'e' il backend: altrimenti la funzione e' vuota).
                if (card && window.FX && typeof FX.playActivationAura === 'function') FX.playActivationAura(card);
                if (!card || !card.uid) return;
                // Il ritardo serve: una Trappola coperta o una Magia
                // attivata da un Set si SCOPRONO in questo stesso istante,
                // e il Terreno viene ridisegnato subito dopo — illuminando
                // adesso si accenderebbe il nodo vecchio, che sparisce un
                // momento più tardi. La ricerca è per UID e non per
                // posizione perché nel frattempo la carta può essersi
                // spostata (una Continua giocata dalla mano finisce su uno
                // slot libero qualunque), mentre l'uid no.
                setTimeout(() => {
                    if (typeof window.findFieldCardElementByUid !== 'function') return;
                    const inCampo = window.findFieldCardElementByUid(card.uid);
                    // Niente elemento: la carta non è sul Terreno (attivata
                    // dalla mano, o una Magia Normale già al Cimitero). La
                    // comparsa a centro schermo resta, e basta così.
                    if (inCampo) playCardActivateEffect(inCampo);
                }, 60);
            };
        })(),

        // Spade Rivelatrici: passa dal backend, ma con una RETE DI
        // SICUREZZA sulla callback (vedi swordsWithSafetyNet qui sotto) —
        // il gioco dipende da onLanded per ridisegnare il campo, e un
        // backend che se ne dimenticasse bloccherebbe il duello.
        playSwordsOfRevealingLight: swordsWithSafetyNet,

        // Le restanti NON passano dai backend, per due motivi diversi:
        //
        // - playSummonCircle / playCardActivateEffect sono chiamate solo da
        //   qui dentro (da playMonsterSummonEffect e affini), quindi
        //   avvolgerle sulla facciata non avrebbe alcun effetto: le chiamate
        //   interne non ci passano. playElementalConvergence era nello
        //   stesso caso, risolto instradando la chiamata INTERNA attraverso
        //   il backend (vedi runElementalConvergence piu' sopra).
        // - playVideoOverlay / playInstantWinCinematic hanno una CALLBACK di
        //   completamento da cui dipende il gioco (il filmato che finisce,
        //   endDuel): un backend che se ne dimenticasse bloccherebbe il
        //   duello. Restano deliberatamente fuori finche' non serviranno.
        /** true finche' un filmato di Evocazione o una convergenza di Livello 7+ e' a schermo — vedi il commento su summonCinematicCount. */
        isCinematicPlaying: isCinematicPlaying,
        /** Per chi mostra una scena di Evocazione propria (js/ui/grido-evocazione.js): il bot aspetta finché il contatore non torna a zero. */
        beginSummonCinematic,
        endSummonCinematic,
        playSummonCircle: runSummonCircle,
        playElementalConvergence: runElementalConvergence,
        playVideoOverlay,
        playMonsterSummonEffect,
        azzeraCodaEvocazioni,
        playFusionMaterialEffect: viaBackend('playFusionMaterialEffect', playFusionMaterialEffect),
        /** I temi per Attributo delle Evocazioni di Livello 7+ (colori): li riusa anche la Fusione in WebGL. */
        summonThemes: ATTRIBUTE_SUMMON_THEMES,
        playRitualSummon,
        playDustTornado: viaBackend('playDustTornado', playDustTornado),
        playHarpiesFeatherDuster: viaBackend('playHarpiesFeatherDuster', playHarpiesFeatherDuster),
        FUSION_MATERIAL_EFFECT_MS,
        playInstantWinCinematic,
        playCardActivateEffect,
        ACTIVATE_CENTER_DURATION_MS,
        spawnParticles
    };
})();
