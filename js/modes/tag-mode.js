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

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'tag') return;

    /** @type {any} */
    const g = window;
    const idCompagno = params.get('partner') || '';
    const idAvversario = params.get('character') || '';
    // Boss a squadre: 2 contro 1 contro un Boss con i Life Point di tagDatabase.lpBoss (un Boss non ha compagni).
    const boss = params.get('boss') === '1';
    const idAvversario2 = boss ? '' : (params.get('character2') || '');
    const regolaLp = params.get('lp') === 'lato' ? 'lato' : (params.get('lp') === 'membro' ? 'membro' : tagDatabase.regolaLpPredefinita);
    const scambio = params.get('scambio') === 'libero' ? 'libero' : tagDatabase.scambioPredefinito;

    /** @type {Record<string, HTMLElement | null>} un riquadro della squadra per lato */
    const pannelli = { player: null, bot: null };
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
        if (posto === 'player' && g.DuelSession && g.DuelSession.player) Object.assign(g.DuelSession.player, m.identita);
        const box = document.getElementById(posto === 'player' ? 'playerInfo' : 'botInfo');
        if (!box) return;
        const nome = box.querySelector('.name-text');
        if (nome) nome.textContent = m.identita.name;
        const h3 = box.querySelector('h3');
        if (h3) h3.title = m.identita.name;
        const img = /** @type {HTMLImageElement | null} */ (box.querySelector('.duelist-avatar img'));
        if (img && m.identita.image) {
            const pedina = typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(m.identita.image) : null;
            img.onerror = () => { if (img.src.indexOf(m.identita.image) === -1) img.src = m.identita.image; };
            img.src = pedina || m.identita.image;
            img.alt = m.identita.name;
        }
    }

    /** Velo e avviso durante il turno del compagno IA. */
    function aggiornaVelo() {
        if (typeof gameState === 'undefined' || !gameState) return;
        const m = g.TagTeam.membroAttivo('player');
        const turnoCompagno = !!m && !gameState.gameOver && gameState.currentPlayer === 'player' && m.controllore === 'ia';
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
        const chi = posto === 'bot' ? 'Avversario' : (m.controllore === 'ia' ? 'IA' : 'Tu');
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
        Object.keys(pannelli).forEach((posto) => {
            const pannello = pannelli[posto];
            if (!pannello) return;
            if (!telefono || !manoAvv) { pannello.style.top = ''; return; }
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
        g.TagTeam.ascolta((evento, posto) => {
            if (evento === 'scambio' || evento === 'pronta') allineaLp(posto);
            if (evento === 'risposta' && posto === 'player') mostraRisposta();
            aggiornaTutto();
        });
        // Life Point, mano e Mazzo cambiano a ogni mossa: i riquadri si
        // aggiornano con il resto del duello. 'orologio' arriva a ogni cambio turno.
        const ridisegna = () => { aggiornaPannello('player'); aggiornaPannello('bot'); };
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
     * @param {boolean} vinto @param {boolean} abbandono
     * @returns {VoceEsito[]}
     */
    function chiudi(vinto, abbandono) {
        document.body.classList.remove('tag-turno-compagno');
        const compagno = identitaDi(idCompagno, '🤝');
        const nome = compagno ? compagno.name : 'il tuo compagno';
        if (abbandono) return [{ nota: true, icon: '🤝', rule: `Duello Tag Team abbandonato insieme a ${nome}.` }];
        return [{ nota: true, icon: '🤝', rule: vinto ? `Vittoria in Tag Team insieme a ${nome}.` : `Sconfitta in Tag Team insieme a ${nome}.` }];
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    window.ModalitaDuello.tag = {
        urlRitorno: 'tag.html',
        avvia: avvia,
        chiudi: chiudi
    };
})();
