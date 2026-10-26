// Raid cooperativo: due giocatori, un Boss, UNA barra di Life Point.
//
// Come funziona (e perche' non tocca il motore):
//  - Ognuno gioca il PROPRIO duello contro il Boss, in locale, nella stessa pagina della sala (e' il punto: navigare a
//    un'altra pagina chiuderebbe il collegamento col compagno). Non e' il "passo comune" del duello a due: qui i due
//    duelli sono indipendenti e non si scambiano mosse.
//  - Cio' che si condivide e' solo il DANNO al Boss. Ogni lato manda il TOTALE che ha inflitto (`inflitti`), non le
//    variazioni: un messaggio perso o doppio non sposta niente, il successivo rimette tutto a posto.
//  - Il Boss locale parte da `lp` (la barra comune) e perde, oltre ai danni propri, quelli del compagno. Quando la barra
//    arriva a zero il controllo vittoria del duello (checkGameOver) la vede come qualunque Boss a zero: vincono entrambi.
//  - Si osserva `gameState.botLP` ogni 400 ms invece di agganciarsi a ogni punto che toglie Life Point: sono troppi,
//    e la regola del duello non deve sapere che esiste un Raid.
(function () {
    'use strict';

    const PASSO_MS = 400;
    let rete = null;
    let lp = 0;
    let stato = null;        // il gameState a cui si riferisce il conteggio (un duello nuovo ne ha uno nuovo)
    let mie = 0;             // danno inflitto da me, in totale
    let compagno = 0;        // danno inflitto dal compagno, in totale
    let ultimoInviato = null;
    let compagnoFuori = false;
    let fuoriInviato = false;
    let timer = null;
    let barra = null;
    let totaleInAttesa = null;
    // Il campo del compagno (sola lettura): ultima fotografia ricevuta e quella che ho mandato io.
    let campoCompagno = null;
    let ultimoCampo = null;
    let nomeCompagno = 'Compagno';
    let pannello = null;

    function formato(n) { return Math.max(0, Math.round(n)).toLocaleString('it-IT'); }

    function disegna(bossNome) {
        if (!barra) {
            barra = document.createElement('div');
            barra.id = 'mpRaidBar';
            barra.setAttribute('role', 'status');
            barra.innerHTML = '<div class="mpr-nome"></div><div class="mpr-pista"><div class="mpr-riempi"></div></div><div class="mpr-dettaglio"></div>';
            document.body.appendChild(barra);
        }
        const restanti = Math.max(0, lp - mie - compagno);
        barra.querySelector('.mpr-nome').textContent = `${bossNome}  ${formato(restanti)} / ${formato(lp)}`;
        barra.querySelector('.mpr-riempi').style.width = (100 * restanti / lp).toFixed(1) + '%';
        barra.querySelector('.mpr-dettaglio').textContent =
            `Tu ${formato(mie)} · Compagno ${formato(compagno)}${compagnoFuori ? ' (a terra)' : ''}`;
    }

    // ------------------------------------------------------------------
    // Vedere il campo del compagno. Tutto QUI, a sola lettura: dal gameState si LEGGE soltanto, e quello che si
    // disegna sono carte con uid finti dentro un pannello a parte, che sparisce dal DOM alla chiusura, cosi' nessun
    // codice del duello (ologrammi, riscontri, ricerche per uid) puo' incontrarle.
    // La fotografia e' solo PUBBLICA: le carte coperte viaggiano senza identita' e la mano senza carte (solo quante).
    // ------------------------------------------------------------------
    function fotoSlot(s) {
        if (!s || !s.card) return null;
        const pos = s.position === 'defense' ? 'defense' : 'attack';
        if (s.isFaceDown) return { coperta: true, pos };
        const c = s.card;
        const E = window.DuelEngine;
        const atk = E && E.getEffectiveAtk ? E.getEffectiveAtk(c) : c.attack;
        const def = E && E.getEffectiveDef ? E.getEffectiveDef(c) : c.defense;
        const dato = { id: c.id, pos };
        if (Number.isInteger(atk)) dato.atk = atk;
        if (Number.isInteger(def)) dato.def = def;
        return dato;
    }

    function fotografiaDelCampo(g) {
        const riga = (a) => Array.from({ length: 5 }, (_, i) => fotoSlot(a && a[i]));
        return {
            lp: g.playerLP, mano: (g.playerHand || []).length, mazzo: g.playerDeckCount || 0,
            cimitero: (g.playerGraveyard || []).length,
            mostri: riga(g.playerMonsterField), mt: riga(g.playerSTField),
            bossLp: g.botLP, bossMano: (g.botHand || []).length, bossCimitero: (g.botGraveyard || []).length,
            bossMostri: riga(g.botMonsterField), bossMt: riga(g.botSTField)
        };
    }

    function inviaCampo() {
        let foto;
        try { foto = fotografiaDelCampo(gameState); } catch (e) { return; }
        const testo = JSON.stringify(foto);
        if (testo === ultimoCampo) return;
        ultimoCampo = testo;
        invia('campo', { campo: foto });
    }

    function creaCarta(dato, k) {
        const el = document.createElement('div');
        el.className = 'mpr-slot';
        if (!dato || typeof createCardElement !== 'function') return el;
        let carta = { id: -1, uid: 'raid-' + k, name: '', type: 'monster' };
        if (!dato.coperta && typeof cardDatabase !== 'undefined') {
            const modello = cardDatabase.find((c) => c.id === dato.id);
            if (modello) carta = Object.assign({}, modello, { uid: 'raid-' + k });
            if (Number.isInteger(dato.atk)) carta.attack = dato.atk;
            if (Number.isInteger(dato.def)) carta.defense = dato.def;
        }
        try { el.appendChild(createCardElement(carta, !!dato.coperta, dato.pos, { miniatura: true })); } catch (e) { /* una carta illeggibile resta uno slot vuoto */ }
        return el;
    }

    function sezione(titolo, righe, stat) {
        const s = document.createElement('section');
        s.className = 'mpr-sez';
        const h = document.createElement('h3');
        h.textContent = titolo;
        const st = document.createElement('div');
        st.className = 'mpr-stat';
        st.textContent = stat;
        s.append(h, st);
        righe.forEach((riga, r) => {
            const div = document.createElement('div');
            div.className = 'mpr-riga';
            (riga || []).forEach((d, i) => div.appendChild(creaCarta(d, titolo + r + '-' + i)));
            s.appendChild(div);
        });
        return s;
    }

    function disegnaPannello() {
        if (!pannello) return;
        const corpo = pannello.querySelector('.mpr-corpo');
        corpo.textContent = '';
        const c = campoCompagno;
        if (!c) { corpo.textContent = 'Il compagno non ha ancora mostrato il suo campo.'; return; }
        corpo.append(
            sezione(nomeCompagno, [c.mostri, c.mt], `LP ${formato(c.lp)} · Mano ${c.mano} · Mazzo ${c.mazzo} · Cimitero ${c.cimitero}`),
            sezione('Il suo Boss', [c.bossMostri, c.bossMt], `LP ${formato(c.bossLp)} · Mano ${c.bossMano} · Cimitero ${c.bossCimitero}`)
        );
    }

    function chiudiPannello() {
        if (pannello) { pannello.remove(); pannello = null; }
    }

    function apriPannello() {
        if (pannello) { chiudiPannello(); return; }
        pannello = document.createElement('div');
        pannello.id = 'mpRaidCampo';
        pannello.innerHTML = '<div class="mpr-scheda" role="dialog" aria-label="Campo del compagno"><button type="button" class="mpr-chiudi" aria-label="Chiudi">✕</button><div class="mpr-corpo"></div></div>';
        pannello.addEventListener('click', (e) => { if (e.target === pannello || e.target.closest('.mpr-chiudi')) chiudiPannello(); });
        document.body.appendChild(pannello);
        disegnaPannello();
    }

    function creaPulsante() {
        if (document.getElementById('mpRaidCampoBtn')) return;
        const b = document.createElement('button');
        b.id = 'mpRaidCampoBtn';
        b.type = 'button';
        b.title = 'Guarda il campo del compagno';
        b.setAttribute('aria-label', 'Guarda il campo del compagno');
        b.textContent = '👁';
        b.onclick = apriPannello;
        document.body.appendChild(b);
    }

    function invia(tipo, extra) {
        if (rete) rete.sendAction(Object.assign({ kind: 'raid', tipo }, extra || {}));
    }

    function tick(bossNome) {
        if (typeof gameState === 'undefined' || !gameState || typeof gameState.botLP !== 'number') return;
        if (stato !== gameState) {
            // Duello (o rivincita) nuovo: il Boss riparte dalla barra comune, meno cio' che il compagno ha gia' fatto.
            stato = gameState;
            mie = 0;
            gameState.botLP = Math.max(0, lp - compagno);
            if (typeof updateUI === 'function') updateUI();
        }
        if (gameState.gameOver) {
            if (gameState.playerLP <= 0 && !fuoriInviato) { fuoriInviato = true; invia('fuori'); }
            disegna(bossNome);
            return;
        }
        // Quello che manca alla barra e' tutto mio: i colpi del compagno li ho gia' sottratti io stesso.
        mie = lp - gameState.botLP - compagno;
        if (mie !== ultimoInviato) { ultimoInviato = mie; invia('colpo', { inflitti: mie }); }
        inviaCampo();
        disegna(bossNome);
    }

    /** Un messaggio del compagno (dal 'game-action' della sala). */
    function ricevi(azione) {
        if (azione.tipo === 'fuori') { compagnoFuori = true; return; }
        if (azione.tipo === 'ripeti') { ultimoInviato = null; ultimoCampo = null; return; }
        if (azione.tipo === 'campo') {
            if (azione.campo && typeof azione.campo === 'object') { campoCompagno = azione.campo; disegnaPannello(); }
            return;
        }
        if (azione.tipo !== 'colpo' || !Number.isInteger(azione.inflitti)) return;
        // Il compagno puo' partire prima di me: la barra qui non e' ancora nota e il totale non si puo' contenere.
        // Si tiene da parte e si applica all'avvio (altrimenti, se poi non colpisce piu', andrebbe perso).
        if (!lp) { totaleInAttesa = azione.inflitti; return; }
        // Il compagno e' un'altra persona (e un altro client): un totale assurdo non deve poter azzerare o curare il Boss
        // oltre la barra. Si tiene tra 0 e la barra intera; il resto e' danno possibile e quindi accettato.
        const nuovo = Math.max(0, Math.min(lp, azione.inflitti));
        if (nuovo === compagno) return;
        const delta = nuovo - compagno;
        compagno = nuovo;
        if (typeof gameState !== 'undefined' && gameState && stato === gameState && !gameState.gameOver) {
            gameState.botLP = Math.max(0, gameState.botLP - delta);
            if (typeof updateUI === 'function') updateUI();
        }
    }

    /** Avvia il Raid. `boss` = { nome, lp }. */
    function avvia(net, boss) {
        rete = net;
        lp = boss.lp;
        if (boss.compagno) nomeCompagno = boss.compagno;
        creaPulsante();
        const nome = boss.nome || 'Boss';
        if (totaleInAttesa !== null) { const t = totaleInAttesa; totaleInAttesa = null; ricevi({ kind: 'raid', tipo: 'colpo', inflitti: t }); }
        if (timer) clearInterval(timer);
        timer = setInterval(() => tick(nome), PASSO_MS);
    }

    /** Dopo una caduta di linea: ridice al compagno quanto ho fatto. */
    function ridici() { ultimoInviato = null; ultimoCampo = null; }

    window.MpRaid = { avvia, ricevi, ridici };
})();
