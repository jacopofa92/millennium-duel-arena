// @ts-check
/**
 * tag-mode.js — Il duello Tag Team (fase 1: tu e un compagno IA contro un Duellante).
 * =====================================================================
 * duelMonstersCore.html?mode=tag&character=<avversario>&difficulty=<livello>&partner=<compagno>&lp=membro|lato
 *
 * Fuori dal motore, come le altre modalità: le regole della squadra stanno
 * in js/modes/tag.js (senza interfaccia), qui solo ciò che sta intorno:
 *  - PREPARAZIONE (avvolge preparaManiIniziali): il tuo lato diventa una
 *    squadra con il compagno scelto, che porta il suo mazzo;
 *  - CHI GIOCA: nome e ritratto nel riquadro dei Life Point seguono il membro
 *    davanti, e l'annuncio del turno dice il suo nome;
 *  - IL COMPAGNO IA: durante il suo turno un velo blocca i click sul campo e
 *    sulla mano (le guardie dell'interfaccia guardano il NOME del posto,
 *    'player', non chi lo controlla, quindi senza velo potresti muovere al
 *    suo posto);
 *  - LA PANCHINA: un riquadro con i due membri, Life Point, carte in mano e
 *    nel Mazzo, chi è davanti e chi è fuori.
 * Premi e record: quelli di un duello normale contro quell'avversario.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'tag') return;

    /** @type {any} */
    const g = window;
    const idCompagno = params.get('partner') || '';
    const regolaLp = params.get('lp') === 'lato' ? 'lato' : (params.get('lp') === 'membro' ? 'membro' : tagDatabase.regolaLpPredefinita);

    /** @type {HTMLElement | null} */
    let pannello = null;
    /** @type {HTMLElement | null} */
    let avviso = null;

    function personaggio(id) {
        return (typeof characterDatabase !== 'undefined' ? characterDatabase : []).find((c) => c.id === id) || null;
    }

    /** Identità mostrabile di un personaggio del roster (come in duel-session.js). */
    function identitaDi(id) {
        const c = personaggio(id);
        if (!c) return null;
        return { id: c.id, name: c.name, title: c.title || '', image: c.image || null, icon: '🤝' };
    }

    function escape(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    /** Nome e ritratto del riquadro dei Life Point del giocatore = il membro davanti. */
    function mostraChiGioca() {
        const m = g.TagTeam.membroAttivo('player');
        if (!m || !m.identita) return;
        if (g.DuelSession && g.DuelSession.player) Object.assign(g.DuelSession.player, m.identita);
        const box = document.getElementById('playerInfo');
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

    function riga(m) {
        const stato = !m.vivo
            ? `<span class="tag-stato tag-stato--fuori">${m.motivo === 'mazzo' ? 'Mazzo vuoto' : 'Eliminato'}</span>`
            : (m.davanti ? '<span class="tag-stato tag-stato--davanti">In campo</span>' : '<span class="tag-stato">In panchina</span>');
        const lp = regolaLp === 'membro' ? `<span class="tag-lp" title="Life Point">❤ ${m.lp}</span>` : '';
        const chi = m.controllore === 'ia' ? 'IA' : 'Tu';
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
     */
    function aggiornaPannello() {
        if (!pannello) return;
        const r = g.TagTeam.riassunto('player');
        if (!r) return;
        const titolo = regolaLp === 'lato' ? `<div class="tag-titolo">Tag Team · Life Point condivisi</div>` : '<div class="tag-titolo">Tag Team</div>';
        const altro = r.membri.find((m) => !m.davanti) || r.membri[0];
        const dati = [
            regolaLp === 'membro' && altro.vivo ? `❤ ${altro.lp}` : '',
            altro.vivo ? `✋ ${altro.mano}` : (altro.motivo === 'mazzo' ? 'Mazzo vuoto' : 'eliminato')
        ].filter(Boolean).join(' · ');
        const aperto = pannello.classList.contains('is-aperta');
        // Nella pillola solo il primo nome: con nome e cognome non stava fra le carte su un telefono stretto.
        const breve = String(altro.nome || '').split(' ')[0];
        pannello.innerHTML = `<button type="button" class="tag-compatto" aria-expanded="${aperto}" title="${escape(altro.nome)}">🤝 ${escape(breve)}<span>${escape(dati)}</span><span aria-hidden="true">${aperto ? '▴' : '▾'}</span></button>`
            + `<div class="tag-dettagli">${titolo}${r.membri.map(riga).join('')}</div>`;
        posizionaPillola();
    }

    /**
     * Sul telefono la pillola va subito sotto la mano dell'avversario, se lì
     * non tocca nessuna casella del campo; altrimenti (schermi molto piccoli)
     * resta in alto, sopra i dorsi della mano avversaria: è la sovrapposizione
     * meno dannosa, perché sono carte coperte. Misurato su 360x640, 393x852 e
     * 430x932. Sul desktop decide il CSS.
     */
    function posizionaPillola() {
        if (!pannello) return;
        if (!window.matchMedia('(max-width: 900px)').matches) { pannello.style.top = ''; return; }
        const pillola = pannello.querySelector('.tag-compatto');
        const manoAvv = document.getElementById('botHand');
        const infoAvv = document.getElementById('botInfo');
        if (!pillola || !manoAvv) return;
        const sotto = Math.max(manoAvv.getBoundingClientRect().bottom, infoAvv ? infoAvv.getBoundingClientRect().bottom : 0) + 4;
        const larga = pillola.getBoundingClientRect().width;
        const alta = pillola.getBoundingClientRect().height;
        const libera = ![...document.querySelectorAll('.field-slot')].some((s) => {
            const x = s.getBoundingClientRect();
            return x.width && !(x.right <= 6 || x.left >= 6 + larga || x.bottom <= sotto || x.top >= sotto + alta);
        });
        pannello.style.top = (libera ? sotto : 64) + 'px';
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
        mostraChiGioca();
        aggiornaVelo();
        aggiornaPannello();
    }

    function costruisciInterfaccia() {
        pannello = document.createElement('aside');
        pannello.id = 'tagPanchina';
        pannello.className = 'tag-panchina';
        pannello.setAttribute('aria-label', 'La tua squadra');
        document.body.appendChild(pannello);
        // La pillola del telefono apre e chiude il dettaglio (il riquadro viene riscritto a ogni aggiornamento, quindi l'ascolto sta qui).
        pannello.addEventListener('click', (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (!t.closest('.tag-compatto')) return;
            pannello.classList.toggle('is-aperta');
            aggiornaPannello();
        });
        avviso = document.createElement('div');
        avviso.id = 'tagAvvisoCompagno';
        avviso.className = 'tag-avviso';
        avviso.hidden = true;
        document.body.appendChild(avviso);
        g.TagTeam.ascolta((evento, posto) => {
            if (evento === 'scambio' || evento === 'pronta') allineaLp(posto);
            aggiornaTutto();
        });
        // Life Point, mano e Mazzo cambiano a ogni mossa: il riquadro si
        // aggiorna con il resto del duello. 'orologio' arriva a ogni cambio turno.
        g.EventiDuello.ascolta('ridisegna', () => { aggiornaPannello(); aggiornaVelo(); });
        g.EventiDuello.ascolta('life-points', aggiornaPannello);
        g.EventiDuello.ascolta('orologio', aggiornaVelo);
        window.addEventListener('resize', posizionaPillola);
        aggiornaTutto();
    }

    function avvia() {
        const compagno = identitaDi(idCompagno);
        const mazzo = compagno && typeof getCharacterDeck === 'function' ? getCharacterDeck(idCompagno, tagDatabase.compagno.mazzo) : null;
        // Un link senza compagno valido (o con un compagno senza mazzo): si torna alla pagina di scelta.
        if (!compagno || !mazzo) {
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
                lp: tagDatabase.lp
            });
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
        const compagno = identitaDi(idCompagno);
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
