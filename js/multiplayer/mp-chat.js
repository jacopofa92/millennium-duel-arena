/**
 * mp-chat.js — la CHAT delle stanze Multiplayer (sala d'attesa, duello, Raid, Tag Team).
 * =====================================================================================
 * Un pulsante tondo che apre un piccolo pannello: il registro dei messaggi, le FRASI RAPIDE (un tocco, le migliori durante il
 * duello) e una riga per scrivere. Nessuna cronologia: la chat vive in memoria e sparisce con la pagina.
 *
 * PROTOCOLLO: nessun tipo di messaggio nuovo. Il relay in produzione conosce solo i tipi che aveva all'ultimo rilascio e scarta gli
 * altri, quindi la chat viaggia come campo `chat` dentro un 'ready' (stesso trucco del Raid, vedi controlloRaid in protocollo-mp.js):
 *     { kind: 'ready', pronto: true, chat: { testo?: string, frase?: id, nome: string } }
 * Chi riceve lo smista PRIMA di leggerlo come "sono pronto" (mp-lobby.js, game-action). Una frase rapida viaggia come ID e ognuno la
 * mostra nel proprio testo: niente da ripulire. Il testo libero si ripulisce SEMPRE (via controlli, via < e >, spazi, lunghezza) e
 * finisce solo in textContent, mai in HTML.
 *
 * LIMITI E MODERAZIONE: un messaggio al massimo ogni 1,2 s in uscita; in entrata si scarta chi ne manda piu' di uno ogni 0,6 s;
 * "Silenzia" (ricordato sul dispositivo) ignora tutto cio' che arriva. In duello il messaggio ricevuto compare anche come fumetto
 * accanto al nome dell'avversario (DuelDialogues), cosi' non serve tenere aperto il pannello.
 */
(function () {
    'use strict';

    const MAX_TESTO = 140;
    const MAX_NOME = 24;
    const INTERVALLO_INVIO_MS = 1200;
    const INTERVALLO_RICEZIONE_MS = 600;
    const MAX_RIGHE = 60;
    const CHIAVE_SILENZIO = 'ygoMpChatSilenzio';

    /** Le frasi rapide: l'id viaggia, il testo e' di chi legge. */
    const FRASI = [
        { id: 'gg', testo: 'Buona partita!' },
        { id: 'fortuna', testo: 'Buona fortuna!' },
        { id: 'bella', testo: 'Bella mossa!' },
        { id: 'penso', testo: 'Un attimo, ci penso…' },
        { id: 'ops', testo: 'Ops!' },
        { id: 'grazie', testo: 'Grazie!' },
        { id: 'wow', testo: 'Wow!' },
        { id: 'rivincita', testo: 'Rivincita?' }
    ];

    /** @type {any} */
    let net = null;
    let montato = false;
    let attiva = false;
    let aperto = false;
    let nonLetti = 0;
    let ultimoInvio = 0;
    const ultimaRicezione = {};
    let silenziato = false;
    try { silenziato = localStorage.getItem(CHIAVE_SILENZIO) === '1'; } catch (e) { /* localStorage negato: non silenziato */ }
    /** @type {{ btn: HTMLElement, badge: HTMLElement, pannello: HTMLElement, log: HTMLElement, input: HTMLInputElement, toast: HTMLElement, silenzia: HTMLElement } | null} */
    let el = null;
    let timerToast = null;

    function pulisci(valore, max) {
        return String(valore == null ? '' : valore).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
    }
    function nomeMio() {
        try { if (window.SaveManager && SaveManager.hasSave && SaveManager.hasSave()) return pulisci(SaveManager.getPlayerName(), MAX_NOME) || 'Giocatore'; } catch (e) { /* ripiego */ }
        return 'Giocatore';
    }
    function inDuello() { return document.body && document.body.classList.contains('mp-in-duello'); }

    // ---------------------------------------------------------------- interfaccia
    function monta() {
        if (montato) return;
        montato = true;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'mpChatBtn';
        btn.className = 'mpchat-btn';
        btn.hidden = true;
        btn.setAttribute('aria-label', 'Apri la chat');
        btn.innerHTML = '<span class="mpchat-ico" aria-hidden="true">💬</span><span class="mpchat-badge" hidden>0</span>';

        const pannello = document.createElement('div');
        pannello.id = 'mpChatPanel';
        pannello.className = 'mpchat-pannello';
        pannello.hidden = true;
        pannello.setAttribute('role', 'dialog');
        pannello.setAttribute('aria-label', 'Chat della stanza');
        pannello.innerHTML = '<div class="mpchat-testa"><strong>Chat</strong>'
            + '<button type="button" class="mpchat-silenzia" aria-pressed="false"></button>'
            + '<button type="button" class="mpchat-chiudi" aria-label="Chiudi la chat">×</button></div>'
            + '<div class="mpchat-log" role="log" aria-live="polite"></div>'
            + '<div class="mpchat-frasi"></div>'
            + '<form class="mpchat-riga" autocomplete="off"><input class="mpchat-input" type="text" maxlength="' + MAX_TESTO + '" placeholder="Scrivi un messaggio…" aria-label="Messaggio">'
            + '<button type="submit" class="mpchat-invia">Invia</button></form>';

        const toast = document.createElement('div');
        toast.className = 'mpchat-toast';
        toast.hidden = true;
        toast.setAttribute('role', 'status');

        document.body.append(btn, pannello, toast);
        const frasi = /** @type {HTMLElement} */ (pannello.querySelector('.mpchat-frasi'));
        FRASI.forEach((f) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mpchat-frase';
            b.textContent = f.testo;
            b.addEventListener('click', () => invia({ frase: f.id }));
            frasi.appendChild(b);
        });
        el = {
            btn: btn, badge: /** @type {HTMLElement} */ (btn.querySelector('.mpchat-badge')), pannello: pannello,
            log: /** @type {HTMLElement} */ (pannello.querySelector('.mpchat-log')),
            input: /** @type {HTMLInputElement} */ (pannello.querySelector('.mpchat-input')),
            toast: toast, silenzia: /** @type {HTMLElement} */ (pannello.querySelector('.mpchat-silenzia'))
        };
        btn.addEventListener('click', () => (aperto ? chiudi() : apri()));
        // La tastiera compare e scompare: il pannello si rimette a posto ogni volta (vedi sistemaTastiera).
        el.input.addEventListener('focus', () => { sistemaTastiera(); setTimeout(sistemaTastiera, 300); });
        el.input.addEventListener('blur', () => setTimeout(sistemaTastiera, 50));
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', sistemaTastiera);
            window.visualViewport.addEventListener('scroll', sistemaTastiera);
        }
        /** @type {HTMLElement} */ (pannello.querySelector('.mpchat-chiudi')).addEventListener('click', chiudi);
        el.silenzia.addEventListener('click', () => {
            silenziato = !silenziato;
            try { localStorage.setItem(CHIAVE_SILENZIO, silenziato ? '1' : '0'); } catch (e) { /* solo per questa sessione */ }
            aggiornaSilenzio();
            riga(null, silenziato ? 'Chat silenziata: non vedrai più i messaggi degli altri.' : 'Chat riattivata.', 'nota');
        });
        /** @type {HTMLFormElement} */ (pannello.querySelector('.mpchat-riga')).addEventListener('submit', (e) => {
            e.preventDefault();
            const t = pulisci(el.input.value, MAX_TESTO);
            if (!t) return;
            if (invia({ testo: t })) el.input.value = '';
        });
        aggiornaSilenzio();
        if (attiva) btn.hidden = false;
    }

    function aggiornaSilenzio() {
        if (!el) return;
        el.silenzia.textContent = silenziato ? '🔕 Silenziata' : '🔔 Silenzia';
        el.silenzia.setAttribute('aria-pressed', String(silenziato));
    }

    /**
     * TASTIERA DEL TELEFONO. Quando si scrive, la tastiera copre la meta' bassa dello schermo e, con un pannello ancorato in basso (sala) o
     * a meta' altezza (duello), copriva proprio la riga dove si scrive. Finche' il campo ha il fuoco il pannello si ancora al FONDO
     * dell'area davvero visibile (visualViewport: tolta la tastiera) e non e' mai piu' alto di quella: la riga di scrittura resta sopra la
     * tastiera. Per fare spazio le frasi rapide si nascondono (si usano a tastiera chiusa). Se la tastiera ridimensiona gia' la pagina
     * (WebView con adjustResize) la parte coperta e' 0 e il pannello sta semplicemente sul fondo.
     */
    function sistemaTastiera() {
        if (!el || !aperto) return;
        const scrive = document.activeElement === el.input;
        const vv = window.visualViewport;
        const p = el.pannello;
        if (!scrive || !vv) {
            p.classList.remove('mpchat-tastiera');
            p.style.removeProperty('top');
            p.style.removeProperty('bottom');
            p.style.removeProperty('max-height');
            return;
        }
        const coperto = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        p.classList.add('mpchat-tastiera');
        p.style.top = 'auto';
        p.style.bottom = (coperto + 8) + 'px';
        p.style.maxHeight = Math.max(170, vv.height - 16) + 'px';
        el.log.scrollTop = el.log.scrollHeight;
    }

    function apri() {
        if (!el) return;
        aperto = true;
        nonLetti = 0;
        aggiornaBadge();
        el.pannello.hidden = false;
        el.toast.hidden = true;
        el.log.scrollTop = el.log.scrollHeight;
        document.body.classList.add('mpchat-aperta');
        if (window.NativeHaptics) NativeHaptics.light();
    }
    function chiudi() {
        if (!el) return;
        aperto = false;
        el.pannello.hidden = true;
        el.pannello.classList.remove('mpchat-tastiera');
        ['top', 'bottom', 'max-height'].forEach((k) => el.pannello.style.removeProperty(k));
        document.body.classList.remove('mpchat-aperta');
    }
    function aggiornaBadge() {
        if (!el) return;
        el.badge.hidden = nonLetti === 0;
        el.badge.textContent = nonLetti > 9 ? '9+' : String(nonLetti);
    }

    /** Aggiunge una riga al registro. `chi` null = nota di sistema; 'io' = mio. Tutto con textContent. */
    function riga(nome, testo, tipo) {
        if (!el) return;
        const r = document.createElement('div');
        r.className = 'mpchat-riga-msg' + (tipo ? ' mpchat-' + tipo : '');
        if (nome) {
            const n = document.createElement('span');
            n.className = 'mpchat-nome';
            n.textContent = nome + ': ';
            r.appendChild(n);
        }
        r.appendChild(document.createTextNode(testo));
        el.log.appendChild(r);
        while (el.log.children.length > MAX_RIGHE) el.log.removeChild(el.log.firstChild);
        el.log.scrollTop = el.log.scrollHeight;
    }

    function mostraToast(testo) {
        if (!el) return;
        el.toast.textContent = testo;
        el.toast.hidden = false;
        clearTimeout(timerToast);
        timerToast = setTimeout(() => { if (el) el.toast.hidden = true; }, 4200);
    }

    // ---------------------------------------------------------------- invio e ricezione
    /** @returns {boolean} vero se e' partito. */
    function invia(contenuto) {
        const ora = Date.now();
        if (ora - ultimoInvio < INTERVALLO_INVIO_MS) return false;
        const frase = contenuto.frase ? FRASI.find((f) => f.id === contenuto.frase) : null;
        const testo = frase ? frase.testo : pulisci(contenuto.testo, MAX_TESTO);
        if (!testo) return false;
        if (!net || typeof net.sendAction !== 'function') return false;
        const chat = { nome: nomeMio() };
        if (frase) chat.frase = frase.id; else chat.testo = testo;
        try { net.sendAction({ kind: 'ready', pronto: true, chat: chat }); } catch (e) { return false; }
        ultimoInvio = ora;
        riga('Tu', testo, 'mio');
        if (inDuello() && window.DuelDialogues && DuelDialogues.say) DuelDialogues.say('player', 'chat', { force: true, text: testo });
        return true;
    }

    /** Un messaggio arrivato dagli altri (smistato da mp-lobby.js). `da` e' l'id pubblico del mittente, se il relay lo da'. */
    function ricevi(chat, da) {
        if (!chat || typeof chat !== 'object') return;
        const frase = chat.frase ? FRASI.find((f) => f.id === chat.frase) : null;
        const testo = frase ? frase.testo : pulisci(chat.testo, MAX_TESTO);
        if (!testo) return;
        if (silenziato) return;
        const chi = String(da || 'altro');
        const ora = Date.now();
        if (ora - (ultimaRicezione[chi] || 0) < INTERVALLO_RICEZIONE_MS) return;   // raffica: si scarta
        ultimaRicezione[chi] = ora;
        monta();
        const nome = pulisci(chat.nome, MAX_NOME) || 'Avversario';
        riga(nome, testo);
        attivaChat(true);
        if (inDuello() && window.DuelDialogues && DuelDialogues.say) DuelDialogues.say('bot', 'chat', { force: true, special: true, text: testo });
        if (!aperto) {
            nonLetti++;
            aggiornaBadge();
            if (!inDuello() || !window.DuelDialogues) mostraToast(nome + ': ' + testo);
        }
    }

    function attivaChat(si) {
        attiva = !!si;
        if (el) el.btn.hidden = !attiva;
        if (!attiva) chiudi();
    }

    /** Aggancia la rete: da chiamare quando la pagina ha DuelNetwork (multiplayer.html). */
    function avvia(rete) {
        net = rete || window.DuelNetwork;
        monta();
        if (!net || typeof net.on !== 'function') return;
        // La chat compare appena si e' in una stanza; sparisce solo con la pagina.
        ['room-created', 'room-ready', 'room-update'].forEach((evento) => net.on(evento, () => attivaChat(true)));
    }

    window.MpChat = { avvia: avvia, ricevi: ricevi, attiva: attivaChat, FRASI: FRASI, _pulisci: pulisci, _sistemaTastiera: sistemaTastiera };
    // Si aggancia da sola alla rete della pagina (multiplayer.html): nessuna chiamata da fare altrove.
    if (window.DuelNetwork) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => avvia(window.DuelNetwork));
        else avvia(window.DuelNetwork);
    }
})();
