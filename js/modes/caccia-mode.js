/**
 * caccia-mode.js — Il duello della Caccia al Boss.
 * =====================================================================
 * duelMonstersCore.html?mode=caccia&character=<boss>&difficulty=Difficile
 *
 * Fuori dal motore, come le altre modalità. Cambia solo ciò che sta intorno:
 *  - PREPARAZIONE (avvolge preparaManiIniziali): il Boss parte con più Life Point
 *    (cacciaDatabase.lpBoss); comincia sempre il giocatore (niente morra).
 *  - IL LIMITE DI TURNI: un controllo ogni 250 ms conta i turni DEL GIOCATORE; quando
 *    comincia il turno successivo all'ultimo concesso e il Boss è ancora in piedi, la
 *    caccia è persa e si chiude il duello con endDuel(false), la stessa funzione
 *    pubblica di ogni sconfitta (come fa il Puzzle).
 *  - Un riquadro in alto mostra "Turno X di N" per tutta la caccia.
 * Premi: i soliti di un duello, più il premio della settimana alla prima caccia vinta.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'caccia') return;

    const LIMITE = cacciaDatabase.turni;
    let turniGiocati = 0;
    let ultimoTurnoVisto = null;
    let finitaPerTempo = false;
    /** @type {HTMLElement | null} */
    let riquadro = null;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let sorveglianza;

    function aggiornaRiquadro() {
        if (!riquadro) return;
        const rimasti = Math.max(0, LIMITE - turniGiocati);
        riquadro.textContent = `🏹 Turno ${Math.min(turniGiocati, LIMITE)} di ${LIMITE}` + (rimasti === 0 ? ' — ultimo!' : '');
        riquadro.style.color = rimasti <= 1 ? '#ff8a7a' : '#f7d774';
    }

    function sorveglia() {
        if (typeof gameState === 'undefined' || !gameState || gameState.gameOver) { if (gameState && gameState.gameOver) clearInterval(sorveglianza); return; }
        if (gameState.currentPlayer !== 'player' || gameState.turn === ultimoTurnoVisto) return;
        ultimoTurnoVisto = gameState.turn;
        turniGiocati++;
        if (turniGiocati > LIMITE) {
            clearInterval(sorveglianza);
            finitaPerTempo = true;
            turniGiocati = LIMITE;
            if (typeof endDuel === 'function') endDuel(false, { cacciaTempoScaduto: true });
            return;
        }
        aggiornaRiquadro();
    }

    function costruisciRiquadro() {
        const el = document.createElement('div');
        el.id = 'cacciaRiquadro';
        el.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:5000;pointer-events:none;'
            + 'padding:3px 12px;border-radius:999px;font:700 11px/1.4 system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap;'
            + 'background:rgba(8,12,22,.78);border:1px solid rgba(247,215,116,.45)';
        document.body.appendChild(el);
        return el;
    }

    function avvia() {
        const boss = Caccia.boss();
        // Un link vecchio (altra settimana, altro Boss): si torna alla pagina, che sa chi si caccia adesso.
        if (params.get('character') !== boss.id) {
            window.location.replace('caccia-boss.html');
            return;
        }
        Caccia.registraTentativo();
        const originale = window.preparaManiIniziali;
        window.preparaManiIniziali = function () {
            originale();
            gameState.botLP = cacciaDatabase.lpBoss;
        };
        initGame();
        riquadro = costruisciRiquadro();
        aggiornaRiquadro();
        sorveglianza = setInterval(sorveglia, 250);
    }

    /** @returns {'player'} la caccia comincia sempre dal giocatore: ogni turno conta. */
    function chiComincia() {
        return 'player';
    }

    /**
     * @param {boolean} vinto @param {boolean} abbandono
     */
    function chiudi(vinto, abbandono) {
        clearInterval(sorveglianza);
        if (!vinto || abbandono) {
            return [{
                nota: true,
                icon: '🏹',
                rule: abbandono
                    ? 'Caccia abbandonata. Puoi riprovare quando vuoi fino a lunedì.'
                    : (finitaPerTempo
                        ? `Tempo scaduto: avevi ${LIMITE} turni per battere il Boss. Puoi riprovare quando vuoi fino a lunedì.`
                        : 'Caccia fallita: i tuoi Life Point sono finiti. Puoi riprovare quando vuoi fino a lunedì.')
            }];
        }
        const esito = Caccia.registraVittoria(turniGiocati);
        if (!esito.primaVolta || !esito.premio) {
            return [{ nota: true, icon: '🏹', rule: `Boss battuto di nuovo in ${turniGiocati} turni: il premio di questa settimana l'hai già preso.` }];
        }
        const voci = [];
        const spiegazione = `Caccia al Boss vinta in ${turniGiocati} turni${esito.premio.veloce ? ' (bonus caccia veloce)' : ''}: il premio si prende una volta a settimana.`;
        if (window.SaveManager) {
            SaveManager.addCurrency('credits', esito.premio.crediti);
            voci.push({ currency: 'credits', amount: esito.premio.crediti, icon: '💰', nome: 'Crediti', rule: spiegazione });
            if (esito.premio.stelle > 0) {
                SaveManager.addCurrency('starChips', esito.premio.stelle);
                voci.push({ currency: 'starChips', amount: esito.premio.stelle, icon: '⭐', nome: 'Stelle dell\'Esagono', rule: spiegazione });
            }
        }
        return voci;
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    window.ModalitaDuello.caccia = {
        urlRitorno: 'caccia-boss.html',
        chiComincia: chiComincia,
        avvia: avvia,
        chiudi: chiudi
    };
})();
