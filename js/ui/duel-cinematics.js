/**
 * duel-cinematics.js — La regia delle due sequenze che incorniciano il duello.
 * =====================================================================
 * Nessuna regola di gioco qui dentro: solo "cosa si vede e quando".
 * L'aspetto sta in js/ui/duel-cinematics.css, l'identità dei duellanti in
 * js/duel-session.js (che è anche l'unico file che chiama queste funzioni).
 *
 *   playIntro(session, onCurtainUp)
 *       ┌ 0.0s  buio, raggi e griglia entrano in scena
 *       ├ 0.3s  i due duellanti scivolano dai lati, "VS" piomba al centro
 *       ├ 0.4s  la barra "Preparazione del Duello" si riempie (1.75s)
 *       ├ 2.0s  i duellanti si scostano, flash bianco, la scritta "DUEL!"
 *       └ 2.9s  il sipario si apre: chiamiamo onCurtainUp() (= la partita
 *               inizia davvero) mentre l'arena entra con uno zoom.
 *       Un click in qualunque momento salta direttamente al sipario.
 *
 *   showOutcome({ playerWon, session, record, onContinue })
 *       Schermata VITTORIA/SCONFITTA con ritratto dell'avversario, record
 *       aggiornato e il pulsante "Continua" che riporta alla schermata da
 *       cui il duello era partito.
 */
(function () {
    'use strict';

    // Durata della parte "spettacolo" dell'intro, prima dell'apertura del
    // sipario. Deve restare allineata alle animazioni da 2900ms in
    // js/ui/duel-cinematics.css (diSlideFromLeft, diVsSlam, diDuelWord...).
    const INTRO_SHOW_MS = 2900;
    const CURTAIN_MS = 620;

    function avatarFor(duelist) {
        if (window.DuelSession && typeof DuelSession.buildAvatar === 'function') {
            return DuelSession.buildAvatar(duelist);
        }
        const span = document.createElement('span');
        span.className = 'duelist-avatar';
        span.textContent = duelist.icon || '🂠';
        return span;
    }

    /**
     * La pedina scontornata del duellante (niente cerchio): sugli schermi
     * larghi l'originale grande di avatarTrasparenza, altrove la pedina da
     * 320px; se un file manca si prova il successivo e, in ultimo, si
     * ricade sull'avatar tondo di sempre. Non si aspetta nulla: l'intro
     * parte comunque, l'immagine compare quando e' pronta.
     */
    function figureFor(duelist) {
        const nome = String(duelist.image || '').split(/[\\/]/).pop().replace(/\.[a-z0-9]+(?:\?.*)?$/i, '');
        if (!nome) return avatarFor(duelist);
        const cerca = [];
        if (window.innerWidth > 900) cerca.push('images/characters/avatarTrasparenza/' + nome + '.png');
        cerca.push('images/characters/pedine/' + nome + '.png');
        const box = document.createElement('div');
        box.className = 'di-figura';
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        let i = 0;
        img.onerror = () => {
            i += 1;
            if (i < cerca.length) { img.src = cerca[i]; return; }
            box.replaceWith(avatarFor(duelist));
        };
        img.src = cerca[0];
        box.appendChild(img);
        return box;
    }

    function buildDuelistBlock(duelist, role, roleLabel) {
        const block = document.createElement('div');
        block.className = 'di-duelist di-duelist--' + role;

        block.appendChild(figureFor(duelist));

        const name = document.createElement('div');
        name.className = 'di-duelist-name';
        name.textContent = duelist.name;
        block.appendChild(name);

        if (duelist.title) {
            const title = document.createElement('div');
            title.className = 'di-duelist-title';
            title.textContent = duelist.title;
            block.appendChild(title);
        }

        const badge = document.createElement('div');
        badge.className = 'di-duelist-role';
        badge.textContent = roleLabel;
        block.appendChild(badge);

        return block;
    }

    function playIntro(session, onCurtainUp) {
        const existing = document.getElementById('duelIntroOverlay');
        if (existing) existing.remove();

        // Gli effetti del field non devono animarsi dietro due overlay
        // fullscreen durante presentazione e morra. Oltre al lavoro GPU
        // sprecato, su WebView mobile questo promuoveva/espelleva superfici
        // proprio durante il passaggio all'arena, causando artefatti.
        if (window.FieldAmbience && typeof FieldAmbience.sospendi === 'function') {
            FieldAmbience.sospendi('apertura-duello');
        }

        const overlay = document.createElement('div');
        overlay.id = 'duelIntroOverlay';

        const grid = document.createElement('div');
        grid.className = 'di-grid';
        overlay.append(grid);

        const stage = document.createElement('div');
        stage.className = 'di-stage';
        stage.appendChild(buildDuelistBlock(session.player, 'player', 'Tu'));

        const vs = document.createElement('div');
        vs.className = 'di-vs';
        vs.textContent = 'VS';
        stage.appendChild(vs);

        const opponentRole = session.isMultiplayer ? 'Online' : (session.difficultyLabel || session.difficulty || 'Sfidante');
        stage.appendChild(buildDuelistBlock(session.opponent, 'opponent', opponentRole));
        overlay.appendChild(stage);

        const loading = document.createElement('div');
        loading.className = 'di-loading';
        loading.innerHTML = `
            <div class="di-loading-label">Preparazione del Duello</div>
            <div class="di-bar"><div class="di-bar-fill"></div></div>
        `;
        overlay.appendChild(loading);

        const flash = document.createElement('div');
        flash.className = 'di-flash';
        const duelWord = document.createElement('div');
        duelWord.className = 'di-duel-word';
        duelWord.textContent = "It's time to duel!";
        const skip = document.createElement('div');
        skip.className = 'di-skip';
        skip.textContent = 'Clicca per saltare';
        overlay.append(flash, duelWord, skip);

        document.body.appendChild(overlay);
        // Al posto dei raggi che giravano: due fiumi di energia che convergono sul VS, con onda d'urto su "DUEL!" (WebGL).
        if (window.DuelFxWebgl) DuelFxWebgl.monta(overlay, 'intro', { impattoMs: INTRO_SHOW_MS - 640 });
        void overlay.offsetWidth;
        overlay.classList.add('is-in');

        // Botto di particelle in corrispondenza dell'impatto di "DUEL!".
        const impactTimeout = setTimeout(() => {
            if (window.FX) {
                FX.spawnParticles(window.innerWidth / 2, window.innerHeight * 0.42, {
                    count: 60, speed: 9, life: 900, size: 4, spread: 360, gravity: 0.02
                });
            }
        }, INTRO_SHOW_MS - 640);

        let curtainRaised = false;
        let showTimeout = null;
        function raiseCurtain() {
            if (curtainRaised) return;
            curtainRaised = true;
            clearTimeout(impactTimeout);
            clearTimeout(showTimeout);

            // onCurtainUp() (initGame() + il primo render completo del
            // Terreno) PRIMA di avviare la transizione di zoom-out
            // (.is-out sotto), MAI durante — segnalato dall'utente su
            // mobile: "la scritta si sposta in basso a destra per una
            // frazione". Misurato con CPU throttling in questa sessione
            // (Playwright, throttle 6x, un caso pessimistico ma reale
            // per un telefono più debole sotto carico): il lavoro
            // sincrono di onCurtainUp() poteva bloccare il thread
            // principale per centinaia di ms — se questo capita MENTRE
            // la transizione CSS di zoom (transform/opacity, 620ms) è
            // già in corso, il browser continua a calcolare la
            // transizione "sulla carta" (basata sul tempo reale
            // trascorso) ma senza poter dipingere nessun fotogramma
            // intermedio finché il thread non si libera — risultato: un
            // salto visibile invece di un movimento fluido appena
            // riprende a disegnare. Un tentativo con un doppio
            // requestAnimationFrame (rimandare onCurtainUp() di un paio
            // di fotogrammi dopo aver già avviato .is-out) NON bastava,
            // verificato con lo stesso test sotto throttling: bloccava
            // comunque un pezzo della transizione già in corso, solo
            // qualche fotogramma più tardi. L'unica sequenza che elimina
            // il problema alla radice è questa: fare TUTTO il lavoro
            // pesante PRIMA, con l'overlay ancora completamente statico
            // (.is-in, tutte le sue animazioni d'ingresso già finite da
            // tempo a questo punto — un blocco durante un fotogramma
            // fermo è invisibile, non c'è nulla che dovrebbe muoversi in
            // quel momento comunque), e avviare .is-out SOLO dopo, su un
            // thread di nuovo libero: la transizione da 620ms può quindi
            // animare per intero senza interruzioni. Il commento
            // originale ("il campo è già popolato quando diventa
            // visibile") resta vero, anzi rispettato con più margine.
            // onCurtainUp può restituire una Promise (oggi lo fa
            // js/duel-session.js, che prima della partita mostra la morra
            // cinese SOPRA questo overlay): in quel caso il sipario
            // aspetta. Serve a preservare l'ordine descritto qui sopra —
            // finché la Promise non si risolve non parte alcuna
            // transizione, quindi il lavoro pesante avviene sempre e solo
            // con lo schermo fermo, esattamente come nel caso sincrono.
            const pending = (typeof onCurtainUp === 'function') ? onCurtainUp() : null;
            if (pending && typeof pending.then === 'function') {
                pending.then(finishRaise, () => finishRaise(null));
            } else {
                finishRaise(pending);
            }
        }

        function finishRaise(avviaIngresso) {
            overlay.classList.add('is-out');

            // Una sola animazione trasforma il campo: camera-intro. La
            // vecchia duel-arena-enter interveniva sullo stesso transform,
            // opacity e filter; per specificita' perdeva quasi sempre, ma
            // costringeva comunque il compositore a preparare un secondo
            // percorso. Due frame separano la distruzione del layer della
            // morra dalla promozione GPU dell'arena.
            if (typeof avviaIngresso === 'function') {
                requestAnimationFrame(() => requestAnimationFrame(avviaIngresso));
            }

            setTimeout(() => overlay.remove(), CURTAIN_MS + 120);
        }

        // Sipario a tempo fisso, sempre — MAI legato allo stato della
        // musica (richiesta esplicita dell'utente: il caricamento del
        // duello non deve mai aspettare l'audio, in nessuna forma). La
        // musica ha una propria vita indipendente in audio-manager.js e
        // parte da sola non appena può, senza che questa cinematica se ne
        // occupi.
        showTimeout = setTimeout(raiseCurtain, INTRO_SHOW_MS);
        overlay.addEventListener('click', raiseCurtain);
    }

    function showOutcome(options) {
        // Seconda barriera, nel momento esatto in cui montiamo l'esito:
        // endDuel l'ha già eseguita, ma nei 900 ms di attesa un gestore
        // asincrono può avere tentato di riaprire un modale sottostante.
        if (typeof window.sealDuelModalsForOutcome === 'function') {
            window.sealDuelModalsForOutcome();
        } else {
            if (document.body) document.body.classList.add('duel-outcome-active');
            document.querySelectorAll('.modal-backdrop').forEach((modal) => {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
                modal.inert = true;
            });
        }
        // 'draw' (Ultimo Turno, id 341: nessun giocatore resta con un
        // mostro da solo sul Terreno) — terzo stato oltre a Vittoria/
        // Sconfitta, mai passato dal resto del gioco (ogni altro punto
        // chiama sempre con true/false, invariati).
        const isDraw = options.playerWon === 'draw';
        const playerWon = !isDraw && !!options.playerWon;
        const session = options.session || {};
        const opponent = session.opponent || { name: 'Avversario', icon: '🤖' };

        // Stacchetto di fine duello (una volta sola, non in loop): ferma la
        // colonna sonora del duello e lascia il posto al jingle di
        // Vittoria/Game Over — vedi DuelMusic.playOneShot in audio-manager.js.
        // Un Pareggio riusa il jingle di sconfitta (nessun terzo jingle
        // dedicato nella libreria audio di questo gioco).
        if (window.DuelMusic) {
            const jingle = playerWon ? 'audio/soundtracks/46. Victory.mp3' : 'audio/soundtracks/49. Game Over.mp3';
            DuelMusic.playOneShot(jingle);
        }

        const existing = document.getElementById('duelOutcomeOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'duelOutcomeOverlay';
        overlay.className = isDraw ? 'draw' : (playerWon ? 'won' : 'lost');

        // Sfondo animato in WebGL (al posto dei raggi che ruotavano): oro che sale, cenere che cade, pulviscolo.
        if (window.DuelFxWebgl) DuelFxWebgl.monta(overlay, isDraw ? 'draw' : (playerWon ? 'won' : 'lost'));

        const content = document.createElement('div');
        content.className = 'do-content';

        // Ritratto, titolo, sottotitolo e record stanno insieme in un
        // contenitore invece di essere quattro figli sciolti. Su desktop
        // non cambia nulla (è una colonna dentro una colonna), ma su un
        // telefono GIRATO diventano la colonna di sinistra di una griglia
        // a due colonne — e lì devono essere UNA cella sola.
        // Il perché, misurato: in una griglia un elemento alto allarga le
        // righe che attraversa, quindi con il riquadro dei premi (513px)
        // a fianco di quattro figli sciolti su quattro righe, il titolo
        // finiva spinto a 435px in una finestra alta 393 — fuori schermo,
        // e non c'era modo di risalirci perché sopra non c'era niente da
        // scorrere.
        const intestazione = document.createElement('div');
        intestazione.className = 'do-header';
        content.appendChild(intestazione);

        const portrait = document.createElement('div');
        portrait.className = 'do-portrait';
        portrait.appendChild(avatarFor(opponent));
        intestazione.appendChild(portrait);

        const title = document.createElement('div');
        title.className = 'do-title';
        title.textContent = isDraw ? 'Pareggio' : (playerWon ? 'Vittoria' : 'Sconfitta');
        intestazione.appendChild(title);

        const sub = document.createElement('div');
        sub.className = 'do-sub';
        sub.textContent = isDraw
            ? `Il duello con ${opponent.name} finisce in pareggio.`
            : playerWon
                ? `Hai sconfitto ${opponent.name}!`
                : `${opponent.name} ti ha sconfitto.`;
        intestazione.appendChild(sub);

        // Il record esiste solo contro un personaggio vero (non contro il
        // Bot della demo o un avversario online).
        if (options.record) {
            const recordEl = document.createElement('div');
            recordEl.className = 'do-record';
            recordEl.innerHTML = `
                <span>Record contro ${opponent.name}</span>
                <span class="sep">·</span>
                <span class="wins">${options.record.wins}V</span>
                <span class="losses">${options.record.losses}S</span>
            `;
            intestazione.appendChild(recordEl);
        }

        // Riepilogo premi (js/economy/rewards.js, che li ha GIÀ accreditati
        // al salvataggio: qui si mostrano soltanto). Ogni voce porta con sé
        // la PROPRIA spiegazione — richiesta esplicita dell'utente: un
        // giocatore che vede arrivare una Carta del Millennio deve leggere
        // subito PERCHÉ gli è arrivata, invece di credere che il gioco
        // distribuisca cose a caso. Una modalità che non paga
        // (Demo/Multiplayer) manda un elenco vuoto e qui non compare nulla.
        const rewards = options.rewards || [];
        if (rewards.length > 0) {
            const box = document.createElement('div');
            box.className = 'do-rewards';
            // Una voce `nota` non è un premio ma la SPIEGAZIONE di un premio
            // mancato (es. un duello abbandonato): stessa riga, senza
            // l'importo — scrivere "+undefined" o "+0" sarebbe peggio del
            // non dire nulla. Se l'elenco contiene SOLO note, il titolo lo
            // dice, altrimenti si leggerebbe "Ricompense" sopra un elenco
            // che spiega perché non ce ne sono.
            const soloNote = rewards.every((r) => r.nota);
            // L'avviso "scorri" NON è decorazione: con molti premi su uno
            // schermo basso se ne vedono due o tre e le altre righe
            // sfumano sotto il pulsante, quindi la schermata sembra finita
            // lì e il giocatore non sa di star perdendo metà dell'elenco.
            // Compare solo se c'è davvero altro da vedere (vedi
            // aggiornaIndicatoreScorrimento più sotto): un invito a
            // scorrere dove non c'è niente da scorrere è peggio del nulla.
            box.innerHTML = `<div class="do-rewards-title">${soloNote ? 'Nessuna ricompensa' : 'Ricompense'}`
                + `<span class="do-scroll-hint">↓ scorri</span></div>` + rewards.map((r) => `
                <div class="do-reward-row${r.nota ? ' do-reward-row--nota' : ''}">
                    <span class="do-reward-icon">${r.icon}</span>
                    <span class="do-reward-text">
                        ${r.nota ? '' : `<span class="do-reward-amount">+${r.amount} ${r.nome}</span>`}
                        <span class="do-reward-rule">${r.rule}</span>
                    </span>
                </div>`).join('');
            content.appendChild(box);
        }

        const continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'do-continue';
        continueBtn.textContent = 'Continua ›';
        continueBtn.onclick = () => {
            continueBtn.disabled = true;
            if (typeof options.onContinue === 'function') options.onContinue();
        };
        content.appendChild(continueBtn);

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        void overlay.offsetWidth;
        overlay.classList.add('is-in');

        // "C'è altro sotto": nessuna regola CSS sa dire se un elemento
        // sta traboccando, quindi lo si misura qui e lo si segna con una
        // classe. Si ricontrolla ad ogni scorrimento (per farlo sparire
        // una volta arrivati in fondo) e al ridimensionamento della
        // finestra — girare il telefono cambia di colpo quante righe ci
        // stanno. L'ascoltatore si toglie da sé quando l'overlay non c'è
        // più, così non resta appeso dopo il "Continua".
        function aggiornaIndicatoreScorrimento() {
            if (!overlay.isConnected) {
                window.removeEventListener('resize', aggiornaIndicatoreScorrimento);
                return;
            }
            const restaDaVedere = content.scrollHeight - content.clientHeight - content.scrollTop;
            overlay.classList.toggle('do-has-more', restaDaVedere > 8);
        }
        content.addEventListener('scroll', aggiornaIndicatoreScorrimento, { passive: true });
        window.addEventListener('resize', aggiornaIndicatoreScorrimento);

        // Il titolo deve stare sempre nel suo riquadro, QUALUNQUE font usi
        // il dispositivo. La dimensione in CSS è tarata su Arial: dove Arial
        // non c'è (Linux, alcuni Android) il browser ripiega su un carattere
        // più largo e "SCONFITTA" usciva dai bordi a 360px — è così che la
        // suite di test su GitHub, che gira su Linux, ha cominciato a
        // fallire. Nessuna regola CSS sa rimpicciolire un testo finché non
        // entra, quindi lo si misura qui: se trabocca, si riduce in
        // proporzione. La trasformazione d'entrata (scale) non conta: la
        // larghezza misurata è quella del layout, non quella disegnata.
        function adattaTitolo() {
            if (!overlay.isConnected) {
                window.removeEventListener('resize', adattaTitolo);
                return;
            }
            title.style.fontSize = '';
            const disponibile = title.clientWidth;
            const necessario = title.scrollWidth;
            if (disponibile > 0 && necessario > disponibile) {
                const attuale = parseFloat(getComputedStyle(title).fontSize);
                title.style.fontSize = Math.floor(attuale * (disponibile / necessario) * 0.97) + 'px';
            }
        }
        adattaTitolo();
        window.addEventListener('resize', adattaTitolo);
        // Dopo il primo layout, non prima: appena inserito nel documento
        // scrollHeight e clientHeight non sono ancora quelli definitivi.
        requestAnimationFrame(aggiornaIndicatoreScorrimento);

        if (playerWon && window.FX) {
            setTimeout(() => {
                FX.spawnParticles(window.innerWidth / 2, window.innerHeight * 0.5, {
                    count: 14, speed: 6, life: 1100, size: 3, spread: 360, gravity: 0.08,
                    colors: ['#ffdf8c', '#f39c12', '#ffffff', '#fff6dc']
                });
            }, 300);
        }
    }

    window.DuelCinematics = { playIntro, showOutcome };
})();
