/**
 * login-bonus.js — il BONUS D'ACCESSO GIORNALIERO.
 * ------------------------------------------------------------------------------------------
 * Un calendario di 7 giorni: la prima volta che si apre il gioco in un giorno compare il riquadro col premio di oggi da riscuotere.
 * Scelte dell'utente (2026-11-08): calendario CHE NON PUNISCE (saltare un giorno non fa perdere niente: si riprende dal giorno a cui
 * si era) e premi NON sgravi — circa 2.500 Crediti equivalenti a settimana (una Stella ~ 500 Crediti, come nel cambio valute), cioe' un
 * decimo scarso di cio' che si guadagna giocando. Ogni 28 accessi totali (non di fila) c'e' in piu' 1 Carta Locazione, che il cambio
 * valute limita gia' a 2 a settimana. MAI Carte del Millennio: aprono i mazzi avanzati.
 *
 * I premi sono SOLO in questa tabella (`PREMI`, `MENSILE`): il riquadro, il Negozio e i test li leggono da qui.
 *
 * IL GIORNO E' QUELLO DEL SERVER (ServerDate.dayKey, UTC): spostare l'orologio del telefono non fa riscuotere due volte. Se la data
 * non e' attendibile (offline: `ServerDate.isTrusted()` falso) il bonus NON si offre, e si offrira' alla prossima apertura col server.
 *
 * STATO nel salvataggio (quindi sincronizzato col cloud), contenitore `save.modalita.loginBonus`:
 *   { ultimo: 'AAAA-MM-GG' (ultimo giorno riscosso), giorno: 0-6 (quanti premi del ciclo gia' presi), accessi: totale }
 * La Busta Base in regalo non e' accreditata come carte: e' un BUONO (`save.modalita.buoniBusta.base`), che il Negozio spende col
 * pulsante "Apri gratis" (non conta nelle 10 al giorno, non costa Crediti).
 */
(function () {
    'use strict';

    /** I 7 premi del ciclo, in ordine. `buonoBusta`: Busta Base in regalo. */
    const PREMI = [
        { giorno: 1, crediti: 100 },
        { giorno: 2, crediti: 150 },
        { giorno: 3, stelle: 1 },
        { giorno: 4, crediti: 200 },
        { giorno: 5, buonoBusta: 1 },
        { giorno: 6, crediti: 250 },
        { giorno: 7, stelle: 1, crediti: 300 }
    ];
    /** Ogni `ogni` accessi totali: premio in piu'. */
    const MENSILE = { ogni: 28, locazione: 1 };

    const CHIAVE = 'loginBonus';
    const CHIAVE_BUONI = 'buoniBusta';

    function oggi() {
        return (window.ServerDate && typeof ServerDate.dayKey === 'function') ? ServerDate.dayKey() : new Date().toISOString().slice(0, 10);
    }
    const attendibile = () => !!(window.ServerDate && typeof ServerDate.isTrusted === 'function' && ServerDate.isTrusted());

    function leggi() {
        const s = (window.SaveManager && SaveManager.getModeState) ? SaveManager.getModeState(CHIAVE) : null;
        return {
            ultimo: (s && typeof s.ultimo === 'string') ? s.ultimo : '',
            giorno: Math.max(0, Math.min(PREMI.length - 1, Number(s && s.giorno) || 0)),
            accessi: Math.max(0, Number(s && s.accessi) || 0)
        };
    }

    /** Quante Buste Base in regalo ha il giocatore. */
    function buoniBusta() {
        const s = (window.SaveManager && SaveManager.getModeState) ? SaveManager.getModeState(CHIAVE_BUONI) : null;
        return Math.max(0, Number(s && s.base) || 0);
    }
    /** Spende un buono (dal Negozio). Torna true se c'era. */
    function usaBuonoBusta() {
        const n = buoniBusta();
        if (n < 1) return false;
        SaveManager.setModeState(CHIAVE_BUONI, { base: n - 1 });
        return true;
    }

    /**
     * Cosa si puo' fare adesso: { disponibile, attendibile, indice (0-6 del premio di oggi), premio, accessi, alMensile }.
     * `disponibile` solo con la data del server e se oggi non e' gia' stato riscosso.
     */
    function stato() {
        const s = leggi();
        const ok = attendibile();
        const accessiDopo = s.accessi + 1;
        return {
            disponibile: ok && s.ultimo !== oggi(),
            attendibile: ok,
            indice: s.giorno,
            premio: PREMI[s.giorno],
            accessi: s.accessi,
            // Con questo accesso si scatta il premio mensile?
            scattaMensile: accessiDopo % MENSILE.ogni === 0,
            accessiAlMensile: MENSILE.ogni - (s.accessi % MENSILE.ogni)
        };
    }

    /** Riscuote il premio di oggi. Torna { ok, voci: [{ tipo, quantita }], indice } (le voci servono a mostrarlo). */
    function riscuoti() {
        const st = stato();
        if (!st.disponibile) return { ok: false, voci: [] };
        const p = st.premio;
        const voci = [];
        if (p.crediti) { SaveManager.addCurrency('credits', p.crediti); voci.push({ tipo: 'credits', quantita: p.crediti }); }
        if (p.stelle) { SaveManager.addCurrency('starChips', p.stelle); voci.push({ tipo: 'starChips', quantita: p.stelle }); }
        if (p.buonoBusta) { SaveManager.setModeState(CHIAVE_BUONI, { base: buoniBusta() + p.buonoBusta }); voci.push({ tipo: 'bustaBase', quantita: p.buonoBusta }); }
        if (st.scattaMensile) { SaveManager.addCurrency('locatorCards', MENSILE.locazione); voci.push({ tipo: 'locatorCards', quantita: MENSILE.locazione, mensile: true }); }
        // Il ciclo avanza di UN passo, qualunque sia il giorno in cui si torna: niente premi persi e niente premi saltati.
        SaveManager.setModeState(CHIAVE, { ultimo: oggi(), giorno: (st.indice + 1) % PREMI.length, accessi: st.accessi + 1 });
        return { ok: true, voci: voci, indice: st.indice };
    }

    // ------------------------------------------------------------------
    // Il riquadro
    // ------------------------------------------------------------------
    const ICONE = { credits: 'coin', starChips: 'star', bustaBase: 'pack', locatorCards: 'map' };
    const NOMI = { credits: 'Crediti', starChips: 'Stelle', bustaBase: 'Busta Base', locatorCards: 'Carta Locazione' };

    function el(tag, classe, testo) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (testo != null) e.textContent = testo;
        return e;
    }
    function icona(nome) { return (window.Icons && Icons.buildIcon) ? Icons.buildIcon(nome) : null; }

    /** Le righe di un premio come [{ tipo, quantita }] (stessa forma di `voci`). */
    function vociDi(p) {
        const v = [];
        if (p.crediti) v.push({ tipo: 'credits', quantita: p.crediti });
        if (p.stelle) v.push({ tipo: 'starChips', quantita: p.stelle });
        if (p.buonoBusta) v.push({ tipo: 'bustaBase', quantita: p.buonoBusta });
        return v;
    }

    function chip(voce, grande) {
        const c = el('span', 'lb-voce' + (grande ? ' lb-voce--grande' : ''));
        const svg = icona(ICONE[voce.tipo]);
        if (svg) { const i = el('span', 'lb-voce-ico'); i.appendChild(svg); c.appendChild(i); }
        c.appendChild(el('b', null, voce.tipo === 'bustaBase' || voce.tipo === 'locatorCards' ? (voce.quantita > 1 ? voce.quantita + ' ' : '') + NOMI[voce.tipo] : voce.quantita.toLocaleString('it-IT')));
        if (voce.tipo === 'credits' || voce.tipo === 'starChips') c.title = NOMI[voce.tipo];
        return c;
    }

    /** Mostra il riquadro del bonus di oggi. `quandoFinito()` parte quando si chiude (riscosso o rimandato). */
    function mostra(quandoFinito) {
        const st = stato();
        if (!st.disponibile) { if (quandoFinito) quandoFinito(); return; }
        const fine = () => { velo.remove(); document.removeEventListener('keydown', suEsc); if (quandoFinito) quandoFinito(); };
        const suEsc = (ev) => { if (ev.key === 'Escape') fine(); };

        const velo = el('div', 'lb-velo');
        velo.setAttribute('role', 'dialog');
        velo.setAttribute('aria-modal', 'true');
        velo.setAttribute('aria-labelledby', 'lbTitolo');
        const scheda = el('div', 'lb-scheda');
        const sigillo = el('div', 'lb-sigillo');
        const ic = icona('calendar');
        if (ic) sigillo.appendChild(ic);
        const titolo = el('h2', 'lb-titolo', 'Bonus d\'accesso');
        titolo.id = 'lbTitolo';
        const sotto = el('p', 'lb-sotto', `Giorno ${st.indice + 1} di ${PREMI.length}. Se salti un giorno non perdi niente: riprendi da qui.`);

        const griglia = el('div', 'lb-giorni');
        PREMI.forEach((p, i) => {
            const cella = el('div', 'lb-giorno' + (i < st.indice ? ' is-preso' : '') + (i === st.indice ? ' is-oggi' : '') + (i === PREMI.length - 1 ? ' is-ultimo' : ''));
            cella.appendChild(el('small', null, 'Giorno ' + p.giorno));
            const voci = el('div', 'lb-giorno-voci');
            vociDi(p).forEach((v) => voci.appendChild(chip(v)));
            cella.appendChild(voci);
            if (i < st.indice) { const ck = icona('check'); if (ck) { const m = el('span', 'lb-spunta'); m.appendChild(ck); cella.appendChild(m); } }
            griglia.appendChild(cella);
        });

        const oggiBox = el('div', 'lb-oggi');
        oggiBox.appendChild(el('small', null, 'Il premio di oggi'));
        const riga = el('div', 'lb-oggi-voci');
        const premiOggi = vociDi(st.premio);
        if (st.scattaMensile) premiOggi.push({ tipo: 'locatorCards', quantita: MENSILE.locazione });
        premiOggi.forEach((v) => riga.appendChild(chip(v, true)));
        oggiBox.appendChild(riga);

        const mensile = el('p', 'lb-mensile', st.scattaMensile
            ? `Oggi è il tuo ${st.accessi + 1}° accesso: in più una Carta Locazione!`
            : `Ogni ${MENSILE.ogni} accessi, anche non di fila, in più una Carta Locazione (ne mancano ${st.accessiAlMensile}).`);
        const azioni = el('div', 'lb-azioni');
        const btnPrendi = el('button', 'lb-btn lb-btn--oro', 'Riscuoti');
        btnPrendi.type = 'button';
        const btnDopo = el('button', 'lb-btn lb-btn--tenue', 'Dopo');
        btnDopo.type = 'button';
        btnDopo.onclick = fine;
        btnPrendi.onclick = () => {
            btnPrendi.disabled = true;
            const r = riscuoti();
            if (!r.ok) { fine(); return; }
            if (window.NativeHaptics && NativeHaptics.success) NativeHaptics.success();
            // Il riquadro diventa la ricevuta: cosa e' arrivato, dove lo si trova. Si chiude con "Fatto".
            scheda.classList.add('is-riscosso');
            sotto.textContent = 'Riscosso! Ci vediamo domani.';
            oggiBox.querySelector('small').textContent = 'Hai ricevuto';
            mensile.textContent = r.voci.some((v) => v.mensile)
                ? 'La Carta Locazione è nel tuo portafoglio.'
                : (r.voci.some((v) => v.tipo === 'bustaBase') ? 'La Busta Base in regalo si apre dal Negozio, senza pagare.' : '');
            mensile.hidden = !mensile.textContent;
            azioni.replaceChildren();
            const ok = el('button', 'lb-btn lb-btn--oro', 'Fatto');
            ok.type = 'button';
            ok.onclick = fine;
            azioni.appendChild(ok);
            ok.focus({ preventScroll: true });
        };
        azioni.append(btnPrendi, btnDopo);

        scheda.append(sigillo, titolo, sotto, griglia, oggiBox, mensile, azioni);
        velo.appendChild(scheda);
        document.body.appendChild(velo);
        document.addEventListener('keydown', suEsc);
        setTimeout(() => btnPrendi.focus({ preventScroll: true }), 40);
    }

    window.LoginBonus = { PREMI, MENSILE, stato, riscuoti, mostra, buoniBusta, usaBuonoBusta };
})();
