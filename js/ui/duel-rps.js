// js/ui/duel-rps.js
// =====================================================================
// Morra cinese (sasso/carta/forbice) prima di ogni duello, per decidere
// CHI GIOCA PER PRIMO — come al tavolo vero, dove si tira a sorte e chi
// vince sceglie se partire o lasciare partire l'avversario.
//
// QUANDO: DuelSession.start() la mostra dentro il callback che la
// cinematica VS chiama al momento di alzare il sipario, e restituisce la
// Promise di questo modulo — quindi la morra si gioca SOPRA la schermata
// VS, con il sipario ancora abbassato, e solo dopo parte la partita.
// Non è un dettaglio estetico: js/ui/duel-cinematics.js documenta che il
// lavoro pesante (initGame) deve avvenire con lo schermo fermo e coperto,
// altrimenti la transizione di zoom-out scatta invece di scorrere.
//
// COME: tutte le fasi (scelta -> conto alla rovescia -> esito) vivono
// nella STESSA cella di una griglia, sovrapposte, e si alternano solo in
// opacità. Così il pannello non cambia mai altezza e non c'è un solo
// riflusso di layout fra una fase e l'altra — il difetto principale
// della prima versione, che riscriveva innerHTML ad ogni passaggio e
// faceva "saltare" il riquadro. Tutto ciò che si muove usa solo
// transform/opacity.
//
// window.DUEL_RPS_SKIP = true salta tutto e risolve con 'player' (il
// comportamento storico: iniziava sempre il giocatore) — lo imposta la
// suite di test in tests/helpers/harness.js, come già fa con
// AUTH_GATE_SKIP.
// =====================================================================
(function () {
    'use strict';

    // `beats`: cosa batte questa scelta. Tre voci, nessun tabellone di
    // confronto da mantenere: chi vince si deduce da qui.
    const CHOICES = [
        { id: 'sasso', label: 'Sasso', icon: '✊', beats: 'forbice' },
        { id: 'carta', label: 'Carta', icon: '✋', beats: 'sasso' },
        { id: 'forbice', label: 'Forbice', icon: '✌️', beats: 'carta' }
    ];
    // Le tre battute scandite mentre le mani oscillano, prima della
    // rivelazione: è il ritmo con cui si gioca davvero.
    const CHANT = ['Sasso…', 'Carta…', 'Forbice!'];
    const CHANT_STEP_MS = 300;
    // Multiplayer: quanto aspettare la scelta del vincitore ("comincio io /
    // comincia lui") prima di far cominciare lui comunque — un avversario con
    // la versione precedente del gioco non la manda.
    const ATTESA_SCELTA_INIZIO_MS = 20000;

    function choiceById(id) {
        return CHOICES.find((c) => c.id === id);
    }

    /** 'win' | 'lose' | 'draw' dal punto di vista del giocatore. */
    function outcome(playerId, botId) {
        if (playerId === botId) return 'draw';
        return choiceById(playerId).beats === botId ? 'win' : 'lose';
    }

    function escapeText(text) {
        return String(text).replace(/[&<>"']/g, (ch) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    // Ritratto scontornato delle pedine (images/characters/pedine/<file>.png,
    // stesso nome del FILE del ritratto, vedi js/duel-session.js): se manca
    // si ripiega sul ritratto normale, se manca anche quello resta vuoto.
    function ritrattoMarkup(duellante) {
        const img = duellante && duellante.image;
        if (!img) return '';
        const nome = String(img).split(/[\\/]/).pop().replace(/\.[a-z0-9]+(\?.*)?$/i, '');
        const pedina = 'images/characters/pedine/' + nome + '.png';
        return `<img class="rps-ritratto" alt="" src="${escapeText(pedina)}" `
            + `onerror="if(this.dataset.r){this.remove();}else{this.dataset.r=1;this.classList.add('is-ritratto');this.src='${escapeText(img)}';}">`;
    }

    /**
     * @param opponent  { name } — chi si ha di fronte
     * @param opts      solo per il MULTIPLAYER, dove l'avversario è una
     *                  persona e non un sorteggio locale:
     *   - inviaScelta(id)      trasmette la propria mossa all'altro
     *   - attendiScelta()      Promise con la mossa dell'altro
     *   - inviaInizio(starter) trasmette chi comincia, scelto dal vincitore
     *   - attendiInizio()      Promise con quella scelta, già dal nostro
     *                          punto di vista ('player' | 'bot')
     *   Con queste presenti cambiano tre cose, tutte per la stessa ragione
     *   — i due schermi devono raccontare la STESSA morra: la mossa
     *   avversaria non si sorteggia ma si aspetta; chi vince sceglie e la
     *   scelta viaggia, così il pannello si chiude su entrambi nello stesso
     *   momento (chi ha perso legge che l'altro sta scegliendo); e un
     *   pareggio si rigioca DA SÉ, senza un pulsante che i due premerebbero
     *   in momenti diversi.
     */
    function play(opponent, opts) {
        const remoto = !!(opts && typeof opts.attendiScelta === 'function');
        return new Promise((resolve) => {
            if (window.DUEL_RPS_SKIP) { resolve('player'); return; }

            const opponentName = (opponent && opponent.name) ? opponent.name : 'Avversario';
            // Chi sei tu, se la sessione del duello lo sa (in Multiplayer e
            // nella sandbox può non esserci: resta "Tu").
            const io = (window.DuelSession && window.DuelSession.player) || null;
            const playerName = (io && io.name) ? io.name : 'Tu';
            const overlay = document.createElement('div');
            overlay.id = 'duelRpsOverlay';
            overlay.className = 'rps-overlay';
            // Costruito UNA volta sola: da qui in poi si cambiano solo
            // classi e testi, mai la struttura.
            overlay.innerHTML = `
                <div class="rps-panel" role="dialog" aria-modal="true" aria-label="Morra cinese: chi comincia?">
                    <div class="rps-eyebrow">Chi comincia?</div>
                    <div class="rps-arena">
                        <div class="rps-hand rps-hand--player">
                            <div class="rps-chi">${ritrattoMarkup(io)}<div class="rps-hand-name">${escapeText(playerName)}</div></div>
                            <div class="rps-hand-icon" data-role="playerIcon">✊</div>
                        </div>
                        <div class="rps-chant" data-role="chant">VS</div>
                        <div class="rps-hand rps-hand--bot">
                            <div class="rps-chi">${ritrattoMarkup(opponent)}<div class="rps-hand-name">${escapeText(opponentName)}</div></div>
                            <div class="rps-hand-icon" data-role="botIcon">✊</div>
                        </div>
                    </div>
                    <div class="rps-phases">
                        <div class="rps-phase is-on" data-phase="pick">
                            <p class="rps-sub">Scegli la tua mossa.</p>
                            <div class="rps-choices">
                                ${CHOICES.map((c, i) => `
                                    <button type="button" class="rps-choice" data-choice="${c.id}" style="--i:${i}" aria-keyshortcuts="${i + 1}">
                                        <span class="rps-choice-tasto" aria-hidden="true">${i + 1}</span>
                                        <span class="rps-choice-icon">${c.icon}</span>
                                        <span class="rps-choice-label">${c.label}</span>
                                        <span class="rps-choice-batte">batte ${choiceById(c.beats).label}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="rps-phase" data-phase="shoot">
                            <p class="rps-sub">…</p>
                        </div>
                        <!-- I due pulsanti dell'esito esistono fin da
                             ORA, anche se una parte degli esiti ne usa
                             uno solo: la cella della griglia prende
                             l'altezza della fase più alta, e se i
                             pulsanti comparissero solo al momento
                             dell'esito la cella crescerebbe allora,
                             spostando tutto (misurato: succedeva su
                             mobile, dove i pulsanti vanno a capo). Quello
                             che non serve viene reso invisibile ma
                             continua a occupare il suo spazio. -->
                        <div class="rps-phase" data-phase="result">
                            <div class="rps-verdict" data-role="verdict">&nbsp;</div>
                            <p class="rps-sub" data-role="resultSub">&nbsp;</p>
                            <div class="rps-actions">
                                <button type="button" class="rps-btn primary" data-role="actPrimary">&nbsp;</button>
                                <button type="button" class="rps-btn" data-role="actSecondary">&nbsp;</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const el = (role) => overlay.querySelector(`[data-role="${role}"]`);
            const phase = (name) => overlay.querySelector(`[data-phase="${name}"]`);
            const playerIcon = el('playerIcon');
            const botIcon = el('botIcon');
            const chant = el('chant');
            const arena = overlay.querySelector('.rps-arena');

            function showPhase(name) {
                overlay.querySelectorAll('.rps-phase').forEach((p) => {
                    p.classList.toggle('is-on', p.dataset.phase === name);
                });
            }

            function finish(starter) {
                generazione++; // annulla un eventuale passo automatico ancora in attesa
                overlay.classList.remove('is-in');
                overlay.classList.add('is-out');
                // Si aspetta la fine della dissolvenza prima di restituire
                // il controllo: subito dopo parte il lavoro pesante di
                // inizio partita, che non deve sovrapporsi a un'animazione
                // ancora in corso.
                let chiuso = false;
                const completa = () => {
                    if (chiuso) return;
                    chiuso = true;
                    overlay.remove();
                    resolve(starter);
                };
                // La durata CSS puo' cambiare per responsive o accessibilita':
                // transitionend garantisce che il layer blur/opacity sia
                // davvero finito prima di costruire l'arena. Il timeout e'
                // soltanto una rete di sicurezza per browser che non emettono
                // l'evento quando una transizione viene soppressa.
                const aTransizioneFinita = (evento) => {
                    if (evento.target !== overlay || evento.propertyName !== 'opacity') return;
                    overlay.removeEventListener('transitionend', aTransizioneFinita);
                    completa();
                };
                overlay.addEventListener('transitionend', aTransizioneFinita);
                setTimeout(completa, prefersReducedMotion() ? 40 : 380);
            }

            function resetForNewRound() {
                generazione++;
                arena.classList.remove('is-revealed', 'is-win', 'is-lose', 'is-draw');
                overlay.querySelectorAll('.rps-choice').forEach((b) => b.classList.remove('is-picked'));
                playerIcon.textContent = '✊';
                botIcon.textContent = '✊';
                chant.textContent = 'VS';
                showPhase('pick');
            }

            function reveal(playerId, botId) {
                const result = outcome(playerId, botId);
                playerIcon.textContent = choiceById(playerId).icon;
                botIcon.textContent = choiceById(botId).icon;
                chant.textContent = result === 'draw' ? '=' : 'VS';
                arena.classList.remove('is-shooting');
                arena.classList.add('is-revealed', 'is-' + result);

                const verdict = el('verdict');
                verdict.textContent = result === 'draw'
                    ? 'Pareggio!'
                    : result === 'win' ? 'Hai vinto!' : `${opponentName} ha vinto.`;
                verdict.className = 'rps-verdict rps-verdict--' + result;

                const sub = el('resultSub');
                const primary = el('actPrimary');
                const secondary = el('actSecondary');
                // Il secondo pulsante resta nel layout anche quando non
                // serve (visibility, non display): vedi il commento sul
                // markup: è ciò che tiene l'altezza costante.
                const useSecondary = (label, onClick) => {
                    secondary.textContent = label;
                    secondary.style.visibility = label ? 'visible' : 'hidden';
                    secondary.onclick = onClick || null;
                };
                if (result === 'draw' && remoto) {
                    // Nessun pulsante: i due lo premerebbero in momenti
                    // diversi e le due morre andrebbero fuori passo. Si
                    // riparte da soli, allo stesso modo su entrambi.
                    sub.textContent = 'Stessa mossa: si rigioca.';
                    primary.style.visibility = 'hidden';
                    useSecondary('', null);
                    setTimeout(() => {
                        primary.style.visibility = '';
                        resetForNewRound();
                    }, 1600);
                } else if (result === 'draw') {
                    sub.textContent = 'Stessa mossa: si rigioca.';
                    primary.textContent = 'Rigioca ↻';
                    primary.onclick = resetForNewRound;
                    useSecondary('', null);
                    // UX fluida: un pareggio non chiede niente, quindi si riparte da soli (il pulsante accelera).
                    avanzaDaSolo(resetForNewRound, 1300);
                } else if (remoto && typeof opts.inviaInizio === 'function' && typeof opts.attendiInizio === 'function') {
                    // Contro una persona chi vince SCEGLIE, come contro l'IA,
                    // e la scelta VIAGGIA: appena il vincitore decide, il
                    // pannello si chiude su entrambi gli schermi. Prima ognuno
                    // doveva premere il proprio "Inizia il duello", e chi non
                    // l'aveva ancora premuto restava fermo davanti alla morra
                    // mentre l'altro era già in partita (segnalato
                    // dall'utente giocando su due dispositivi).
                    if (result === 'win') {
                        sub.textContent = 'Hai vinto la morra: scegli chi gioca per primo.';
                        const scegli = (starter) => {
                            primary.onclick = null;
                            secondary.onclick = null;
                            opts.inviaInizio(starter);
                            finish(starter);
                        };
                        primary.textContent = '⚔️ Comincio io';
                        primary.onclick = () => scegli('player');
                        useSecondary('🛡️ Comincia lui', () => scegli('bot'));
                    } else {
                        sub.textContent = `${opponentName} ha vinto la morra e sta scegliendo chi comincia…`;
                        primary.style.visibility = 'hidden';
                        useSecondary('', null);
                        // `starter` arriva già dal NOSTRO punto di vista (vedi
                        // attendiInizio in mp-lobby.js). Un avversario con la
                        // versione precedente del gioco non manda la scelta:
                        // dopo il tetto comincia lui, com'era allora.
                        let chiuso = false;
                        const chiudi = (starter) => {
                            if (chiuso) return;
                            chiuso = true;
                            primary.style.visibility = '';
                            finish(starter);
                        };
                        opts.attendiInizio().then(chiudi);
                        setTimeout(() => chiudi('bot'), ATTESA_SCELTA_INIZIO_MS);
                    }
                } else if (remoto) {
                    // Senza il canale per la scelta (chiamante più vecchio):
                    // chi vince comincia, e ognuno preme il proprio pulsante.
                    const hoVinto = result === 'win';
                    sub.textContent = hoVinto
                        ? 'Hai vinto la morra: cominci tu.'
                        : `${opponentName} ha vinto la morra: comincia lui.`;
                    primary.textContent = 'Inizia il duello ›';
                    primary.onclick = () => finish(hoVinto ? 'player' : 'bot');
                    useSecondary('', null);
                } else if (result === 'win') {
                    // Chi vince SCEGLIE, non parte d'ufficio: è la regola
                    // vera, ed è anche la parte interessante (a volte
                    // conviene lasciare il primo turno all'avversario).
                    sub.textContent = 'Scegli chi gioca per primo:';
                    primary.textContent = '⚔️ Comincio io';
                    primary.onclick = () => finish('player');
                    useSecondary('🛡️ Comincia lui', () => finish('bot'));
                } else {
                    sub.textContent = `${opponentName} sceglie di cominciare.`;
                    primary.textContent = 'Inizia il duello ›';
                    primary.onclick = () => finish('bot');
                    useSecondary('', null);
                    // UX fluida: perdendo la morra contro l'IA non c'e' nessuna scelta da fare, quindi si prosegue
                    // da soli dopo il tempo di leggere l'esito (il pulsante resta per chi ha fretta).
                    avanzaDaSolo(() => finish('bot'), 1700);
                }
                showPhase('result');
            }

            // Passo automatico dopo l'esito. Si annulla se il giocatore ha gia' toccato il pulsante (il pannello
            // e' stato chiuso o il round ricominciato: `generazione` cambia) e non scatta mai con movimento ridotto.
            let generazione = 0;
            function avanzaDaSolo(azione, ms) {
                if (prefersReducedMotion()) return;
                const mia = ++generazione;
                setTimeout(() => { if (mia === generazione && overlay.isConnected) azione(); }, ms);
            }

            function shoot(playerId) {
                showPhase('shoot');
                if (opts && typeof opts.inviaScelta === 'function') opts.inviaScelta(playerId);

                // Contro una persona la mossa avversaria non si sorteggia:
                // si aspetta. L'attesa può durare quanto ci mette l'altro a
                // decidere, quindi il coro continua a girare invece di
                // fermarsi su una parola.
                const mossaAvversaria = remoto
                    ? opts.attendiScelta()
                    : Promise.resolve(CHOICES[Math.floor(Math.random() * CHOICES.length)].id);

                if (prefersReducedMotion()) {
                    mossaAvversaria.then((botId) => reveal(playerId, botId));
                    return;
                }
                arena.classList.add('is-shooting');
                let passo = 0;
                const coro = setInterval(() => {
                    chant.textContent = CHANT[passo % CHANT.length];
                    passo++;
                }, CHANT_STEP_MS);

                // Il coro dura almeno un giro intero anche se la risposta
                // arriva subito: senza, chi sceglie per ultimo vedrebbe
                // l'esito comparire nello stesso istante del tocco.
                const minimo = new Promise((r) => setTimeout(r, CHANT.length * CHANT_STEP_MS));
                Promise.all([mossaAvversaria, minimo]).then(([botId]) => {
                    clearInterval(coro);
                    reveal(playerId, botId);
                });
            }

            overlay.querySelectorAll('.rps-choice').forEach((btn) => {
                btn.onclick = () => {
                    // Una sola mossa per mano: il pulsante resta cliccabile
                    // durante la dissolvenza della fase, e un secondo tocco
                    // lanciava una seconda mano sopra la prima.
                    if (phase('pick').classList.contains('is-on') === false) return;
                    if (window.NativeHaptics) NativeHaptics.light();
                    overlay.querySelectorAll('.rps-choice').forEach((b) => b.classList.toggle('is-picked', b === btn));
                    shoot(btn.dataset.choice);
                };
            });
            // Tasti 1/2/3 sulla tastiera (desktop): stessi pulsanti, stesso
            // percorso del click. Tolto il listener quando la morra finisce.
            const tasti = (ev) => {
                if (!document.body.contains(overlay)) { document.removeEventListener('keydown', tasti); return; }
                const i = ['1', '2', '3'].indexOf(ev.key);
                if (i === -1 || !phase('pick').classList.contains('is-on')) return;
                const btn = overlay.querySelectorAll('.rps-choice')[i];
                if (btn) btn.click();
            };
            document.addEventListener('keydown', tasti);

            // Un frame di ritardo perché la transizione d'entrata parta
            // davvero (un elemento appena inserito non anima).
            requestAnimationFrame(() => overlay.classList.add('is-in'));
        });
    }

    window.DuelRPS = { play: play, CHOICES: CHOICES, outcome: outcome };
})();
