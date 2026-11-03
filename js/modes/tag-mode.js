// @ts-check
/**
 * tag-mode.js — Il duello Tag Team (2 contro 1 e 2 contro 2, contro l'IA).
 * =====================================================================
 * duelMonstersCore.html?mode=tag&character=<avversario>&difficulty=<livello>&partner=<compagno>&lp=membro|lato
 *   [&character2=<secondo avversario>]  con il secondo avversario è un 2 contro 2
 *   [&boss=1]                           Boss a squadre: l'avversario ha tagDatabase.lpBoss Life Point
 *   [&scambio=libero]                   D2 su richiesta: puoi chiedere al compagno di invertire il prossimo turno
 *
 * Fuori dal motore, come le altre modalità: le regole della squadra stanno
 * in js/modes/tag.js (senza interfaccia), qui solo ciò che sta intorno:
 *  - PREPARAZIONE (avvolge preparaManiIniziali): il tuo lato diventa una
 *    squadra con il compagno scelto, che porta il suo mazzo; con un secondo
 *    avversario anche il lato dell'avversario è una squadra;
 *  - CHI GIOCA: nome e ritratto nei riquadri dei Life Point seguono il membro
 *    davanti di ciascun lato;
 *  - IL COMPAGNO IA: durante il suo turno un velo blocca i click sul campo e
 *    sulla mano (le guardie dell'interfaccia guardano il NOME del posto,
 *    'player', non chi lo controlla, quindi senza velo potresti muovere al
 *    suo posto);
 *  - LE SQUADRE: un riquadro per lato con i due membri, Life Point, carte in
 *    mano e nel Mazzo, chi è davanti e chi è fuori.
 * La scelta di chi affrontare a inizio turno (D12) la chiede tag.js con
 * Decisioni, quindi la mostra l'interfaccia di sempre (actions.js).
 * Premi e record: quelli di un duello normale contro il primo avversario.
 */
(function () {
    'use strict';

    /** @type {any} */
    const g = window;
    const params = new URLSearchParams(window.location.search);
    // TAG TEAM IN RETE: multiplayer.html carica l'arena dopo che la sala
    // (js/multiplayer/mp-tag-sala.js) ha scritto la disposizione in
    // window.MP_TAG. Lì l'URL non ha `mode=tag`: il duello è 'multiplayer'.
    const inRete = !!(g.MULTIPLAYER_MODE && g.MP_TAG);
    // TAG NELLA STORIA: un nodo con `tag: { compagno, avversario2?, boss? }` (js/data/story-campaigns.js) lancia il duello con
    // mode=story&tag=1&partner=...&character2=...|boss=1 (StoryProgress.urlDuello). Il duello resta un duello della Storia
    // (avanzamento, premi, ritorno alla mappa: li gestisce duel-session.js come sempre); qui cambia solo la preparazione.
    const modoUrl = (params.get('mode') || '').toLowerCase();
    const inStoria = !inRete && modoUrl === 'story' && params.get('tag') === '1';
    // LEZIONE GUIDATA DEL TUTORIAL: mode=tutorial&lezione=tag&partner=<compagno>. Il duello lo guida js/tutorial/tutorial-duel.js
    // (riflettore, passi, uscita); qui cambia solo la preparazione, che TutorialDuel chiede con TagTutorial.avvia() dopo aver
    // scelto le mani della lezione. Niente di cio' che c'e' sotto (premi, record) vale per una lezione.
    const inTutorial = !inRete && modoUrl === 'tutorial' && params.get('lezione') === 'tag';
    if (!inRete && modoUrl !== 'tag' && !inStoria && !inTutorial) return;

    const idCompagno = params.get('partner') || '';
    const idAvversario = params.get('character') || '';
    // Boss a squadre: 2 contro 1 contro un Boss con i Life Point di tagDatabase.lpBoss (un Boss non ha compagni).
    const boss = params.get('boss') === '1';
    const idAvversario2 = boss ? '' : (params.get('character2') || '');
    const regolaLpUrl = params.get('lp') === 'lato' ? 'lato' : (params.get('lp') === 'membro' ? 'membro' : tagDatabase.regolaLpPredefinita);
    const regolaLp = inRete ? (g.MP_TAG.regolaLp === 'lato' ? 'lato' : 'membro') : regolaLpUrl;
    const scambioUrl = params.get('scambio') === 'libero' ? 'libero' : tagDatabase.scambioPredefinito;
    const scambio = inRete ? (g.MP_TAG.scambio === 'libero' ? 'libero' : 'obbligato') : scambioUrl;

    /** @type {Record<string, HTMLElement | null>} un riquadro della squadra per lato */
    const pannelli = { player: null, bot: null };
    /**
     * Identità dei lati con UN solo membro nel Tag in rete. Serve anche
     * all'annuncio del turno: un Boss 2 contro 1 non entra in TagTeam e,
     * senza questa memoria, la cinematica ripiegava su
     * DuelSession.opponent, cioè sulla pedina del giocatore remoto rimasta
     * dalla lobby invece che sulla figura del Boss.
     * @type {Record<string, any>}
     */
    const identitaSingolaPerPosto = {};
    /** @type {HTMLElement | null} */
    let avviso = null;
    /** @type {HTMLElement | null} la risposta del compagno a una richiesta di scambio, per qualche secondo */
    let avvisoRisposta = null;
    let timerRisposta = 0;

    function personaggio(id) {
        return (typeof characterDatabase !== 'undefined' ? characterDatabase : []).find((c) => c.id === id) || null;
    }

    /** Identità mostrabile di un personaggio del roster (come in duel-session.js). */
    function identitaDi(id, icona) {
        const c = personaggio(id);
        if (!c) return null;
        return { id: c.id, name: c.name, title: c.title || '', image: c.image || null, icon: icona };
    }

    function escape(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    /**
     * Nome e ritratto del riquadro dei Life Point di un lato = il membro
     * davanti. Per il giocatore si aggiorna anche DuelSession.player (lo
     * leggono annuncio del turno e messaggi); l'avversario di DuelSession resta
     * il primo, perché record, Sfide e sblocchi si contano su di lui.
     * @param {string} posto
     */
    function mostraChiGioca(posto) {
        const m = g.TagTeam.membroAttivo(posto);
        if (!m || !m.identita) return;
        scriviIdentita(posto, m.identita);
    }

    /** Nome e ritratto nel riquadro dei Life Point di un lato. @param {string} posto @param {any} identita */
    function scriviIdentita(posto, identita) {
        if (posto === 'player' && g.DuelSession && g.DuelSession.player) Object.assign(g.DuelSession.player, identita);
        const box = document.getElementById(posto === 'player' ? 'playerInfo' : 'botInfo');
        if (!box) return;
        const nome = box.querySelector('.name-text');
        if (nome) nome.textContent = identita.name;
        const h3 = box.querySelector('h3');
        if (h3) h3.title = identita.name;
        const img = /** @type {HTMLImageElement | null} */ (box.querySelector('.duelist-avatar img'));
        if (img && identita.image) {
            const pedina = typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(identita.image) : null;
            img.onerror = () => { if (img.src.indexOf(identita.image) === -1) img.src = identita.image; };
            img.src = pedina || identita.image;
            img.alt = identita.name;
        }
    }

    /** Velo e avviso durante il turno del compagno IA. */
    function aggiornaVelo() {
        if (typeof gameState === 'undefined' || !gameState) return;
        const m = g.TagTeam.membroAttivo('player');
        // Il compagno può essere l'IA o, in rete, una persona su un altro client: in entrambi i casi qui non si tocca nulla.
        const turnoCompagno = !!m && !gameState.gameOver && gameState.currentPlayer === 'player' && m.controllore !== 'persona';
        document.body.classList.toggle('tag-turno-compagno', turnoCompagno);
        if (avviso) {
            avviso.hidden = !turnoCompagno;
            if (turnoCompagno) avviso.textContent = `🤝 Turno di ${m.nome}: gioca il tuo compagno`;
        }
    }

    function riga(m, posto) {
        const stato = !m.vivo
            ? `<span class="tag-stato tag-stato--fuori">${m.motivo === 'mazzo' ? 'Mazzo vuoto' : 'Eliminato'}</span>`
            : (m.davanti ? '<span class="tag-stato tag-stato--davanti">In campo</span>' : '<span class="tag-stato">In panchina</span>');
        const lp = regolaLp === 'membro' ? `<span class="tag-lp" title="Life Point">❤ ${m.lp}</span>` : '';
        const chi = posto === 'bot' ? 'Avversario' : (m.controllore === 'persona' ? 'Tu' : (m.natura === 'persona' ? 'Compagno' : 'IA'));
        return `<div class="tag-membro${m.davanti ? ' is-davanti' : ''}${m.vivo ? '' : ' is-fuori'}" data-membro="${escape(m.id)}">`
            + `<div class="tag-membro-testa"><span class="tag-nome">${escape(m.nome)}</span><span class="tag-chi">${chi}</span></div>`
            + `<div class="tag-membro-dati">${lp}<span title="Carte in mano">✋ ${m.mano}</span><span title="Carte nel Mazzo">🂠 ${m.mazzo}</span>`
            + (m.davanti ? '' : `<span title="Mostri e Magie/Trappole sul suo campo">⚔ ${m.mostri} · ✦ ${m.magieTrappole}</span>`)
            + `</div>${stato}</div>`;
    }

    /**
     * Due forme dello stesso riquadro, scelte dal CSS: sul desktop il dettaglio
     * dei due membri; sul telefono una pillola col solo membro che NON è
     * davanti (quello davanti è già nel riquadro dei Life Point), che si apre
     * al tocco. Il riquadro intero sul telefono copriva la mano e la pila
     * dell'avversario (misurato).
     * @param {string} posto
     */
    function aggiornaPannello(posto) {
        const pannello = pannelli[posto];
        if (!pannello) return;
        const r = g.TagTeam.riassunto(posto);
        if (!r) return;
        const nomeLato = posto === 'player' ? 'La tua squadra' : 'Squadra avversaria';
        const titolo = `<div class="tag-titolo">${nomeLato}${regolaLp === 'lato' ? ' · Life Point condivisi' : ''}</div>`;
        const altro = r.membri.find((m) => !m.davanti) || r.membri[0];
        const dati = [
            regolaLp === 'membro' && altro.vivo ? `❤ ${altro.lp}` : '',
            altro.vivo ? `✋ ${altro.mano}` : (altro.motivo === 'mazzo' ? 'Mazzo vuoto' : 'eliminato')
        ].filter(Boolean).join(' · ');
        const aperto = pannello.classList.contains('is-aperta');
        // Nella pillola solo il primo nome: con nome e cognome non stava fra le carte su un telefono stretto.
        const breve = String(altro.nome || '').split(' ')[0];
        const icona = posto === 'player' ? '🤝' : '⚔️';
        const segnoRichiesta = r.richiesta != null ? ' · 🔄' : '';
        pannello.innerHTML = `<button type="button" class="tag-compatto" aria-expanded="${aperto}" title="${escape(altro.nome)}">${icona} ${escape(breve)}<span>${escape(dati + segnoRichiesta)}</span><span aria-hidden="true">${aperto ? '▴' : '▾'}</span></button>`
            + `<div class="tag-dettagli">${titolo}${r.membri.map((m) => riga(m, posto)).join('')}${posto === 'player' ? richiestaScambio(r) : ''}</div>`;
        posizionaPillole();
    }

    /**
     * D2 su richiesta: il pulsante per chiedere al compagno di invertire il
     * prossimo turno della squadra (o per ritirare la richiesta). Il compagno
     * risponde all'inizio di quel turno. Niente pulsante con la regola "a
     * turno", a duello finito o con un membro eliminato.
     * @param {any} r riassunto della tua squadra
     */
    function richiestaScambio(r) {
        if (r.scambio !== 'libero' || typeof gameState === 'undefined' || gameState.gameOver) return '';
        if (!r.membri.every((m) => m.vivo) || r.prossimo === -1) return '';
        const io = r.membri.find((m) => m.controllore === 'persona');
        const compagno = r.membri.find((m) => m.controllore !== 'persona');
        if (!io || !compagno) return '';
        if (r.richiesta != null) {
            const chi = r.membri[r.richiesta];
            return `<div class="tag-richiesta"><span>Hai chiesto: il prossimo turno lo gioca ${escape(chi.controllore === 'persona' ? 'tu' : chi.nome)}.</span>`
                + `<button type="button" data-azione="scambio">↩ Ritira la richiesta</button></div>`;
        }
        const toccaATe = r.membri[r.prossimo].controllore === 'persona';
        const testo = toccaATe ? `🔄 Chiedi a ${compagno.nome.split(' ')[0]} di giocare il prossimo turno` : '🔄 Chiedi di giocare tu il prossimo turno';
        return `<div class="tag-richiesta"><button type="button" data-azione="scambio">${escape(testo)}</button></div>`;
    }

    /** La risposta del compagno, al centro per qualche secondo (il registro è chiuso di solito). */
    function mostraRisposta() {
        const r = g.TagTeam.riassunto('player');
        if (!r || !r.ultimaRisposta || !avvisoRisposta) return;
        const x = r.ultimaRisposta;
        const chiGioca = r.membri[x.gioca];
        const giochiTu = chiGioca.controllore === 'persona';
        avvisoRisposta.textContent = x.accetta
            ? `🔄 ${x.da} accetta: questo turno ${giochiTu ? 'giochi tu' : 'gioca lui'}`
            : `🔄 ${x.da} preferisce andare a turno: ${giochiTu ? 'giochi tu' : 'gioca lui'}`;
        avvisoRisposta.hidden = false;
        clearTimeout(timerRisposta);
        timerRisposta = window.setTimeout(() => { if (avvisoRisposta) avvisoRisposta.hidden = true; }, 4000);
    }

    /**
     * Sul telefono le pillole vanno subito sotto la mano dell'avversario (la
     * tua a sinistra, quella della squadra avversaria a destra), se lì non
     * toccano nessuna casella del campo; altrimenti (schermi molto piccoli)
     * restano in alto, sopra i dorsi della mano avversaria: è la
     * sovrapposizione meno dannosa, perché sono carte coperte. Misurato su
     * 360x640, 393x852 e 430x932. Sul desktop decide il CSS.
     */
    function posizionaPillole() {
        const telefono = window.matchMedia('(max-width: 900px)').matches;
        const manoAvv = document.getElementById('botHand');
        const infoAvv = document.getElementById('botInfo');
        // Desktop: il riquadro della squadra avversaria parte SOTTO il riquadro dei Life Point
        // dell'avversario (che cresce con lo schermo: a 1920x1080 finisce a 146px e il valore
        // fisso di 132px lo copriva), e il tuo sta alla stessa distanza dal bordo in basso, per
        // simmetria. Senza il riquadro dei Life Point restano i valori del CSS.
        const margine = !telefono && infoAvv ? Math.max(132, Math.round(infoAvv.getBoundingClientRect().bottom) + 12) : null;
        Object.keys(pannelli).forEach((posto) => {
            const pannello = pannelli[posto];
            if (!pannello) return;
            if (!telefono || !manoAvv) {
                pannello.style.top = posto === 'bot' && margine ? margine + 'px' : '';
                pannello.style.bottom = posto === 'player' && margine ? margine + 'px' : '';
                return;
            }
            pannello.style.bottom = '';
            const pillola = pannello.querySelector('.tag-compatto');
            if (!pillola) return;
            const sotto = Math.max(manoAvv.getBoundingClientRect().bottom, infoAvv ? infoAvv.getBoundingClientRect().bottom : 0) + 4;
            const p = pillola.getBoundingClientRect();
            // La pillola dell'avversario è allineata a destra (vedi .tag-panchina--avv nel CSS).
            const sinistra = posto === 'player' ? 6 : window.innerWidth - 6 - p.width;
            const libera = ![...document.querySelectorAll('.field-slot')].some((s) => {
                const x = s.getBoundingClientRect();
                return x.width && !(x.right <= sinistra || x.left >= sinistra + p.width || x.bottom <= sotto || x.top >= sotto + p.height);
            });
            pannello.style.top = (libera ? sotto : 64) + 'px';
        });
    }

    /**
     * Allo scambio i Life Point del posto diventano quelli di chi entra: il
     * numero mostrato si allinea SUBITO, senza il conteggio animato con cui
     * animateLifePoints (game-flow.js) racconta un danno o una cura. Altrimenti
     * passare da 6300 a 8000 sembrerebbe una cura di 1700 punti.
     * @param {string} posto
     */
    function allineaLp(posto) {
        const el = document.getElementById(posto === 'player' ? 'playerLP' : 'botLP');
        if (!el || typeof gameState === 'undefined') return;
        const lp = gameState[posto + 'LP'];
        el.dataset.lpValue = String(lp);
        el.textContent = String(Math.max(lp, 0));
    }

    function aggiornaTutto() {
        ['player', 'bot'].forEach((posto) => {
            if (!g.TagTeam.eSquadra(posto)) return;
            mostraChiGioca(posto);
            aggiornaPannello(posto);
        });
        aggiornaVelo();
        aggiornaAmico();
    }

    function creaPannello(posto) {
        const pannello = document.createElement('aside');
        pannello.id = posto === 'player' ? 'tagPanchina' : 'tagPanchinaAvv';
        pannello.className = 'tag-panchina' + (posto === 'bot' ? ' tag-panchina--avv' : '');
        pannello.setAttribute('aria-label', posto === 'player' ? 'La tua squadra' : 'La squadra avversaria');
        document.body.appendChild(pannello);
        // La pillola del telefono apre e chiude il dettaglio (il riquadro viene riscritto a ogni aggiornamento, quindi l'ascolto sta qui).
        pannello.addEventListener('click', (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (t.closest('[data-azione="scambio"]')) {
                if (window.NativeHaptics) g.NativeHaptics.light();
                g.TagTeam.chiediScambio(posto);
                return;
            }
            if (!t.closest('.tag-compatto')) return;
            pannello.classList.toggle('is-aperta');
            aggiornaPannello(posto);
        });
        pannelli[posto] = pannello;
    }

    // ------------------------------------------------------------------ la scena del cambio turno
    /** @type {Record<string, any>} posto -> dati dell'ultimo scambio, in attesa dell'annuncio del turno che lo racconta */
    const scambioInAttesa = {};

    /**
     * L'annuncio del cambio turno nel Tag Team (aggancio in game-flow.js: 'annuncio-turno'): una sola scena da 3 secondi, come il
     * cambio turno di un duello normale, che racconta anche lo scambio avvenuto in quell'istante e dice il nome del membro che
     * gioca DAVVERO. L'annuncio standard legge DuelSession.opponent, che resta il primo avversario (record e Sfide si contano su
     * di lui): nel 2 contro 2 diceva "TURNO Seto Kaiba" con Pegasus davanti. Torna false (parte l'annuncio standard) se la scena
     * e' spenta.
     * @param {string} parolaSinistra @param {string} parolaDestra @param {string} sottotitolo
     */
    function gestisciAnnuncioTurno(parolaSinistra, parolaDestra, sottotitolo) {
        if (!g.TagScambio || g.TagScambio.spenta() || typeof gameState === 'undefined' || !gameState || !g.TagTeam.eSquadra('player')) return false;
        const posto = gameState.currentPlayer;
        const m = g.TagTeam.eSquadra(posto) ? g.TagTeam.membroAttivo(posto) : null;
        const sessione = g.DuelSession || {};
        const altroLato = identitaSingolaPerPosto[posto]
            || (posto === 'player' ? sessione.player : sessione.opponent) || {};
        const nome = (m && m.nome) || altroLato.name || parolaDestra || '';
        const image = (m && m.identita && m.identita.image) || altroLato.image || '';
        const scambio = scambioInAttesa[posto];
        delete scambioInAttesa[posto];
        g.TagScambio.mostra(posto, {
            turno: gameState.turn, sottotitolo, nome, image,
            esce: scambio ? scambio.esce : null, entra: scambio ? scambio.entra : null
        });
        return true;
    }
    g.AnnuncioTurnoModalita = { gestisci: gestisciAnnuncioTurno };

    // ------------------------------------------------------------------ il campo del compagno in panchina
    // Stesso visore dell'Assalto al Boss (js/multiplayer/mp-raid-campo.js): un tasto col ritratto del compagno che NON è
    // davanti, e un pannello di SOLA LETTURA col suo campo (mostri, Magie/Trappole anche coperte perché è un alleato, mano,
    // Life Point). Il suo stato è già in memoria su ogni client (ogni membro in panchina tiene il proprio in `stato`), quindi
    // non viaggia niente: si legge e basta. Lo stesso vale per il membro in panchina della squadra AVVERSARIA (se ne ha una),
    // ma con le sole informazioni che si vedrebbero a tavolo: le sue carte coperte restano dorsi senza nome, della mano si
    // vede solo quante sono.
    let panchineFirma = '';
    let panchineIds = '';

    /**
     * Il membro in panchina di un lato, nella forma del visore, o null (lato senza squadra, membro eliminato).
     * @param {string} posto
     * @returns {{ id: string, nome: string, image: string, pedina: string, campo: any } | null}
     */
    function panchinaDi(posto) {
        const r = g.TagTeam.riassunto(posto);
        if (!r) return null;
        const i = r.membri.findIndex((m) => !m.davanti);
        if (i === -1 || !r.membri[i].vivo) return null;
        const m = g.TagTeam.membro(posto, i);
        const s = m && m.stato;
        const R = g.MpRaidCampo;
        if (!s || !R) return null;
        const alleato = posto === 'player';
        const riga = (a) => Array.from({ length: 5 }, (_, k) => R.fotoSlot(a && a[k], alleato));
        const campo = {
            lp: r.membri[i].lp,
            mano: (s.Hand || []).length,
            mazzo: Array.isArray(s.Deck) ? s.Deck.length : (s.DeckCount || 0),
            cimitero: (gameState[posto + 'Graveyard'] || []).length,
            mostri: riga(s.MonsterField),
            mt: riga(s.STField)
        };
        const image = (m.identita && m.identita.image) || '';
        // L'icona del tasto e' la PEDINA del personaggio dentro un cerchio (il ritratto resta come ripiego).
        const pedina = image && typeof g.getCharacterPawnImage === 'function' ? (g.getCharacterPawnImage(image) || '') : '';
        return { id: 'tag-' + m.id, nome: alleato ? m.nome : m.nome + ' (avversario)', image, pedina, campo };
    }

    function aggiornaAmico() {
        if (typeof gameState === 'undefined' || !gameState || !g.MpRaidCampo || !g.TagTeam.eSquadra('player')) return;
        const lista = [panchinaDi('player'), panchinaDi('bot')].filter(Boolean);
        const firma = JSON.stringify(lista);
        if (firma === panchineFirma) return;
        panchineFirma = firma;
        // Cambia chi è in panchina (scambio, eliminazione): tasti nuovi; altrimenti si aggiornano solo i campi.
        const ids = lista.map((a) => a.id).join(',');
        if (ids !== panchineIds) {
            panchineIds = ids;
            g.MpRaidCampo.avvia(lista.map((a) => ({ id: a.id, nome: a.nome, image: a.image, pedina: a.pedina })), '', true);
        }
        lista.forEach((a) => g.MpRaidCampo.ricevi(a.id, a.campo));
    }

    function costruisciInterfaccia() {
        ['player', 'bot'].forEach((posto) => { if (g.TagTeam.eSquadra(posto)) creaPannello(posto); });
        avviso = document.createElement('div');
        avviso.id = 'tagAvvisoCompagno';
        avviso.className = 'tag-avviso';
        avviso.hidden = true;
        document.body.appendChild(avviso);
        avvisoRisposta = document.createElement('div');
        avvisoRisposta.id = 'tagRispostaCompagno';
        avvisoRisposta.className = 'tag-avviso tag-avviso--risposta';
        avvisoRisposta.hidden = true;
        document.body.appendChild(avvisoRisposta);
        g.TagTeam.ascolta((evento, posto, dati) => {
            if (evento === 'scambio' || evento === 'pronta') allineaLp(posto);
            // La scena dello scambio (solo grafica, js/ui/tag-scambio.js): parte dopo che la regola e' gia' avvenuta. Lo scambio di
            // inizio turno avviene PRIMA dell'annuncio del turno, nella stessa chiamata: se l'annuncio arriva subito dopo
            // (TagTurno.gestisci) la scena e' una sola; altrimenti (uno scambio fuori da un cambio turno) parte da sola.
            if (evento === 'scambio' && dati && g.TagScambio && !gameState.gameOver) {
                scambioInAttesa[posto] = dati;
                setTimeout(() => {
                    if (scambioInAttesa[posto] !== dati) return;
                    delete scambioInAttesa[posto];
                    if (!gameState.gameOver) g.TagScambio.mostra(posto, dati);
                }, 0);
            }
            // Un membro e' appena caduto: il KO si vede subito, il compagno entrera' al proprio turno (altra scena, TAG!).
            if (evento === 'ko' && dati && g.TagScambio && !gameState.gameOver) g.TagScambio.mostra(posto, { esce: dati, entra: null, eliminato: true, esceKO: true });
            if (evento === 'risposta' && posto === 'player') mostraRisposta();
            aggiornaTutto();
        });
        // Life Point, mano e Mazzo cambiano a ogni mossa: i riquadri si
        // aggiornano con il resto del duello. 'orologio' arriva a ogni cambio turno.
        const ridisegna = () => { aggiornaPannello('player'); aggiornaPannello('bot'); aggiornaAmico(); };
        g.EventiDuello.ascolta('ridisegna', () => { ridisegna(); aggiornaVelo(); });
        g.EventiDuello.ascolta('life-points', ridisegna);
        g.EventiDuello.ascolta('orologio', aggiornaVelo);
        window.addEventListener('resize', posizionaPillole);
        aggiornaTutto();
    }

    function avvia() {
        const compagno = identitaDi(idCompagno, '🤝');
        const mazzo = compagno && typeof getCharacterDeck === 'function' ? getCharacterDeck(idCompagno, tagDatabase.compagno.mazzo) : null;
        // Un link senza compagno valido (o con un compagno senza mazzo): si torna alla pagina di scelta.
        if (!compagno || !mazzo) {
            window.location.replace('tag.html');
            return;
        }
        // Il secondo avversario è facoltativo: se l'indirizzo ne nomina uno che non esiste o non ha un mazzo, si torna alla scelta.
        const avversario = identitaDi(idAvversario, '⚔️');
        const avversario2 = idAvversario2 ? identitaDi(idAvversario2, '⚔️') : null;
        // Il compagno non può essere anche un avversario (la pagina di scelta non lo permette; qui per un indirizzo scritto a mano).
        if (idAvversario === idCompagno || idAvversario2 === idCompagno
            || (idAvversario2 && (!avversario || !avversario2 || idAvversario2 === idAvversario || typeof getCharacterDeck !== 'function'))) {
            window.location.replace('tag.html');
            return;
        }
        const io = Object.assign({}, (g.DuelSession && g.DuelSession.player) || { name: 'Giocatore' });
        const originale = window.preparaManiIniziali;
        window.preparaManiIniziali = function () {
            originale();
            g.TagTeam.preparaSquadra('player', {
                primo: { nome: io.name, personaggio: null, controllore: 'persona', identita: io },
                secondo: { nome: compagno.name, personaggio: compagno.id, controllore: 'ia', livelloIA: tagDatabase.compagno.ia, identita: compagno },
                mazzoSecondo: mazzo,
                regolaLp: regolaLp,
                // D19: nel 2 contro 1 la coppia ha 4000 a testa (vedi tagDatabase.lpSquadra).
                lp: tagDatabase.lpSquadra(!avversario2),
                limiteBersaglio: tagDatabase.limiteBersaglio,
                scambio: scambio
            });
            if (boss) {
                // Il Boss rinforzato: solo i Life Point, la pescata è quella di sempre (decisione dell'autore).
                gameState.botLP = tagDatabase.lpBoss;
                allineaLp('bot');
            }
            if (avversario2) {
                // Entrambi gli avversari giocano al livello scelto: mazzo e IA.
                const livello = gameState.botDifficulty || 'medium';
                g.TagTeam.preparaSquadra('bot', {
                    primo: { nome: avversario.name, personaggio: avversario.id, controllore: 'ia', livelloIA: livello, identita: avversario },
                    secondo: { nome: avversario2.name, personaggio: avversario2.id, controllore: 'ia', livelloIA: livello, identita: avversario2 },
                    mazzoSecondo: getCharacterDeck(idAvversario2, livello),
                    regolaLp: regolaLp,
                    lp: tagDatabase.lpSquadra(false),
                    limiteBersaglio: tagDatabase.limiteBersaglio
                });
            }
        };
        initGame();
        costruisciInterfaccia();
    }

    /**
     * Sfide del Tag Team (js/data/challenges-db.js, gruppo "Tag Team"): una vittoria, col suo formato e livello, e se
     * nessuno della tua squadra e' stato eliminato. Vale anche per i duelli Tag della Storia (passano da chiudi).
     */
    function registraSfide() {
        if (!g.ChallengeTracker) return;
        const sessione = g.DuelSession || {};
        const dati = { formato: boss ? 'boss' : (idAvversario2 ? '2v2' : '2v1'), livello: sessione.difficulty || '' };
        g.ChallengeTracker.recordProgress('tagWin', dati);
        const r = g.TagTeam && g.TagTeam.riassunto('player');
        if (r && r.membri.every((/** @type {any} */ m) => m.vivo)) g.ChallengeTracker.recordProgress('tagWinSenzaKo', dati);
    }

    /**
     * @param {boolean} vinto @param {boolean} abbandono
     * @returns {VoceEsito[]}
     */
    function chiudi(vinto, abbandono) {
        document.body.classList.remove('tag-turno-compagno');
        if (vinto && !abbandono) registraSfide();
        const compagno = identitaDi(idCompagno, '🤝');
        const nome = compagno ? compagno.name : 'il tuo compagno';
        if (abbandono) return [{ nota: true, icon: '🤝', rule: `Duello Tag Team abbandonato insieme a ${nome}.` }];
        return [{ nota: true, icon: '🤝', rule: vinto ? `Vittoria in Tag Team insieme a ${nome}.` : `Sconfitta in Tag Team insieme a ${nome}.` }];
    }

    /**
     * Fine di un duello Tag della STORIA. record, Sfide, sblocco e premi generici di duel-session.js contano solo il PRIMO
     * avversario (session.opponent): se i due avversari erano due Duellanti veri (Lumis e Umbra), anche il secondo si conta come
     * battuto — record, Sfida "sconfiggi X" e sblocco in Duello Libero — altrimenti la Sfida di Umbra non avanzerebbe piu'.
     * @param {boolean} vinto @param {boolean} abbandono
     * @returns {VoceEsito[]}
     */
    function chiudiStoria(vinto, abbandono) {
        const voci = chiudi(vinto, abbandono);
        if (!vinto || abbandono || !idAvversario2 || boss) return voci;
        const sessione = g.DuelSession || {};
        const difficolta = sessione.difficulty;
        if (typeof g.recordCharacterResult === 'function') g.recordCharacterResult(idAvversario2, true, difficolta);
        if (g.ChallengeTracker && typeof gameState !== 'undefined' && gameState) {
            const lp = gameState.playerLP || 0;
            g.ChallengeTracker.recordProgress('defeatCharacter', { characterId: idAvversario2, difficulty: difficolta, playerLP: lp, lpLost: Math.max(0, 8000 - lp) });
        }
        const secondo = identitaDi(idAvversario2, '⚔️');
        if (g.CharacterUnlocks && g.CharacterUnlocks.modalitaSblocca('story') && g.CharacterUnlocks.sblocca(idAvversario2)) {
            voci.push({ nota: true, icon: '🔓', rule: 'Nuovo Duellante in Duello Libero: ' + (secondo ? secondo.name : idAvversario2) + ' — si sblocca battendolo in un Torneo o nella Storia.' });
        }
        return voci;
    }

    // ------------------------------------------------------------------
    // TAG TEAM IN RETE
    // ------------------------------------------------------------------

    /**
     * L'identità di un posto della disposizione (window.MP_TAG.posti): il
     * personaggio per un posto IA, nome e pedina della persona altrimenti.
     * @param {any} s
     */
    function identitaDelPosto(s) {
        if (s.tipo === 'ia') return identitaDi(s.personaggio, '🤖') || { id: s.personaggio, name: s.personaggio, title: '', image: null, icon: '🤖' };
        const p = g.MpPedina ? g.MpPedina.risolvi(s.pedina) : { id: 'player', image: 'images/characters/mirror.jpg' };
        return { id: p.id, name: s.nome || 'Giocatore', title: '', image: p.image, icon: '🧑' };
    }

    /**
     * Gira su TUTTI i client subito dopo PassoComune.preparaDuello (vedi
     * MpPassoComune.allaPreparazione), con la stessa disposizione: ogni lato
     * con due posti diventa una squadra, nello stesso ordine ovunque (A per
     * prima), con i posti assoluti e il prefisso degli uid del secondo mazzo.
     * `controllo(posto)` dice chi gioca quel posto visto da QUI ('persona',
     * 'ia' sull'host, 'remoto').
     * @param {any} partita @param {(posto: string) => string} controllo
     */
    function preparaInRete(partita, controllo) {
        const cfg = partita.config;
        const t = g.MP_TAG;
        Object.keys(identitaSingolaPerPosto).forEach((posto) => { delete identitaSingolaPerPosto[posto]; });
        /** @type {Record<string, any>} */
        const singoli = {};
        ['A', 'B'].forEach((sq) => {
            const altra = sq === 'A' ? 'B' : 'A';
            const posto = g.PassoComune.postoDelMotore(sq);
            const membro = (/** @type {string} */ k) => {
                const s = cfg.posti[k];
                const id = identitaDelPosto(s);
                return {
                    nome: id.name, personaggio: s.tipo === 'ia' ? s.personaggio : null,
                    controllore: controllo(k), natura: s.tipo === 'ia' ? 'ia' : 'persona',
                    livelloIA: s.tipo === 'ia' ? s.ia : undefined, identita: id
                };
            };
            if (!cfg.posti[sq + '1']) {
                singoli[posto] = identitaDelPosto(cfg.posti[sq + '0']);
                identitaSingolaPerPosto[posto] = singoli[posto];
                return;
            }
            g.TagTeam.preparaSquadra(posto, {
                primo: membro(sq + '0'),
                secondo: membro(sq + '1'),
                mazzoSecondo: partita.specPerPosto[sq + '1'],
                regolaLp: regolaLp,
                // D19: la coppia contro un duellante solo ha i Life Point del 2 contro 1.
                lp: tagDatabase.lpSquadra(!cfg.posti[altra + '1']),
                limiteBersaglio: tagDatabase.limiteBersaglio,
                scambio: scambio,
                posti: [sq + '0', sq + '1'],
                prefissoUid: sq + '1'
            });
        });
        // Boss a squadre: i Life Point del Boss, uguali su tutti i client (è stato di regola).
        if (t.boss) gameState[g.PassoComune.postoDelMotore('B') + 'LP'] = tagDatabase.lpBoss;
        costruisciInterfaccia();
        Object.keys(singoli).forEach((posto) => { scriviIdentita(posto, singoli[posto]); allineaLp(posto); });
    }

    /** @param {boolean} vinto @param {boolean} abbandono @returns {VoceEsito[]} */
    function chiudiInRete(vinto, abbandono) {
        document.body.classList.remove('tag-turno-compagno');
        if (abbandono) return [{ nota: true, icon: '🤝', rule: 'Duello Tag Team in rete abbandonato.' }];
        return [{ nota: true, icon: '🤝', rule: vinto ? 'Vittoria della tua squadra in Tag Team.' : 'Sconfitta della tua squadra in Tag Team.' }];
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    if (inRete) {
        if (g.MpPassoComune) g.MpPassoComune.allaPreparazione(preparaInRete);
        // Il duello in rete è la modalità 'multiplayer' di duel-session.js: initGame fa lo scambio dei mazzi e la preparazione.
        window.ModalitaDuello.multiplayer = { avvia: () => { initGame(); }, chiudi: chiudiInRete };
        return;
    }
    if (inTutorial) {
        g.TagTutorial = { avvia: avvia };
        return;
    }
    if (inStoria) {
        // Nessun urlRitorno: in Storia la pagina a cui tornare la decide duel-session.js (la mappa della campagna).
        window.ModalitaDuello.story = { avvia: avvia, chiudi: chiudiStoria };
        return;
    }
    window.ModalitaDuello.tag = {
        urlRitorno: 'tag.html',
        avvia: avvia,
        chiudi: chiudi
    };
})();
