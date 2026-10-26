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
        disegna(bossNome);
    }

    /** Un messaggio del compagno (dal 'game-action' della sala). */
    function ricevi(azione) {
        if (azione.tipo === 'fuori') { compagnoFuori = true; return; }
        if (azione.tipo === 'ripeti') { ultimoInviato = null; return; }
        if (azione.tipo !== 'colpo' || !Number.isFinite(azione.inflitti)) return;
        // Si somma a quanto il compagno aveva gia' fatto: un totale piu' vecchio non fa mai risalire il Boss oltre il giusto.
        const nuovo = azione.inflitti;
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
        const nome = boss.nome || 'Boss';
        if (timer) clearInterval(timer);
        timer = setInterval(() => tick(nome), PASSO_MS);
    }

    /** Dopo una caduta di linea: ridice al compagno quanto ho fatto. */
    function ridici() { ultimoInviato = null; }

    window.MpRaid = { avvia, ricevi, ridici };
})();
