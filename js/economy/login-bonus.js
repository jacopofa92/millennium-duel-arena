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
            accessi: Math.max(0, Number(s && s.accessi) || 0),
            ultima: (s && s.ultima && typeof s.ultima === 'object') ? s.ultima : null
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
            ultima: s.ultima,
            // Con questo accesso si scatta il premio mensile?
            scattaMensile: accessiDopo % MENSILE.ogni === 0,
            accessiAlMensile: MENSILE.ogni - (s.accessi % MENSILE.ogni)
        };
    }

    let inCorso = false;
    /**
     * Riscuote il premio di oggi, SENZA possibilita' di darlo a meta'. Torna { ok, voci: [{ tipo, quantita }], indice, motivo }:
     * `motivo` = 'non-disponibile' (gia' riscosso o senza data attendibile) o 'non-salvato' (la scrittura non e' andata: il
     * salvataggio e' rimasto com'era e si puo' riprovare).
     * Garanzie: (1) una sola scrittura per crediti, Stelle, buono, Carta Locazione e avanzamento del giorno (SaveManager.transazione);
     * (2) lo stato di oggi si ricontrolla DENTRO la scrittura, quindi un doppio tocco o un'altra scheda non pagano due volte;
     * (3) dopo la scrittura si rilegge e si confronta ogni importo con l'atteso: se qualcosa non torna, tutto viene annullato;
     * (4) a premio dato si chiede subito il caricamento sul cloud (`sincronizzato` e' la Promise, che non blocca nessuno).
     */
    function riscuoti() {
        if (inCorso) return { ok: false, voci: [], motivo: 'non-disponibile' };
        const st = stato();
        if (!st.disponibile) return { ok: false, voci: [], motivo: 'non-disponibile' };
        inCorso = true;
        try {
            const p = st.premio;
            const giornoOggi = oggi();
            const voci = [];
            if (p.crediti) voci.push({ tipo: 'credits', quantita: p.crediti });
            if (p.stelle) voci.push({ tipo: 'starChips', quantita: p.stelle });
            if (p.buonoBusta) voci.push({ tipo: 'bustaBase', quantita: p.buonoBusta });
            if (st.scattaMensile) voci.push({ tipo: 'locatorCards', quantita: MENSILE.locazione, mensile: true });
            const CAMPO = { credits: 'credits', starChips: 'starChips', locatorCards: 'locatorCards' };
            let prima = null;
            const r = SaveManager.transazione((s) => {
                const lb = s.modalita && s.modalita[CHIAVE];
                if (lb && lb.ultimo === giornoOggi) return false;   // gia' riscosso (altra scheda, doppio tocco): niente
                s.currency = s.currency || {};
                s.modalita = s.modalita || {};
                const buoniPrima = Math.max(0, Number(s.modalita[CHIAVE_BUONI] && s.modalita[CHIAVE_BUONI].base) || 0);
                prima = { credits: s.currency.credits || 0, starChips: s.currency.starChips || 0, locatorCards: s.currency.locatorCards || 0, buoni: buoniPrima };
                voci.forEach((v) => {
                    if (CAMPO[v.tipo]) s.currency[CAMPO[v.tipo]] = (s.currency[CAMPO[v.tipo]] || 0) + v.quantita;
                    else if (v.tipo === 'bustaBase') s.modalita[CHIAVE_BUONI] = { base: buoniPrima + v.quantita };
                });
                s.modalita[CHIAVE] = {
                    ultimo: giornoOggi,
                    giorno: (st.indice + 1) % PREMI.length,
                    accessi: st.accessi + 1,
                    // La ricevuta dell'ultima riscossione (si vede nel Profilo): data e cosa e' arrivato.
                    ultima: { data: giornoOggi, giorno: st.indice + 1, voci: voci.map((v) => ({ tipo: v.tipo, quantita: v.quantita })) }
                };
            }, (salvato) => {
                if (!salvato || !prima) return false;
                const c = salvato.currency || {};
                const m = salvato.modalita || {};
                const atteso = (tipo) => voci.filter((v) => v.tipo === tipo).reduce((a, v) => a + v.quantita, 0);
                return (c.credits || 0) === prima.credits + atteso('credits')
                    && (c.starChips || 0) === prima.starChips + atteso('starChips')
                    && (c.locatorCards || 0) === prima.locatorCards + atteso('locatorCards')
                    && Math.max(0, Number(m[CHIAVE_BUONI] && m[CHIAVE_BUONI].base) || 0) === prima.buoni + atteso('bustaBase')
                    && !!m[CHIAVE] && m[CHIAVE].ultimo === giornoOggi;
            });
            if (!r.ok) return { ok: false, voci: [], motivo: stato().disponibile ? 'non-salvato' : 'non-disponibile' };
            // Subito sul cloud: il premio non deve restare solo su questo dispositivo.
            const sincronizzato = (window.AutoSync && typeof AutoSync.caricaOra === 'function') ? AutoSync.caricaOra().catch(() => false) : Promise.resolve(false);
            return { ok: true, voci: voci, indice: st.indice, sincronizzato: sincronizzato };
        } finally {
            inCorso = false;
        }
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

    /** Mostra il riquadro del bonus di oggi. `quandoFinito()` parte quando si chiude (solo dopo la riscossione). */
    function mostra(quandoFinito) {
        const st = stato();
        if (!st.disponibile) { if (quandoFinito) quandoFinito(); return; }
        // Il riquadro NON si chiude da solo ne' con Esc, il tasto Indietro o un tocco fuori: si chiude solo dopo aver riscosso
        // (richiesta dell'utente: il premio non deve potersi mancare, e non c'era modo di richiamarlo piu' tardi).
        const fine = () => { velo.remove(); document.removeEventListener('keydown', blocca, true); if (quandoFinito) quandoFinito(); };
        const blocca = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); } };

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
        btnPrendi.onclick = () => {
            btnPrendi.disabled = true;
            const r = riscuoti();
            if (!r.ok) {
                if (r.motivo === 'non-salvato') {
                    // Il salvataggio non e' andato a buon fine e non e' stato toccato: si puo' riprovare.
                    mensile.textContent = 'Non sono riuscito a salvare il premio. Non e\' stato toccato niente: riprova.';
                    mensile.hidden = false; mensile.classList.add('lb-errore');
                    btnPrendi.textContent = 'Riprova'; btnPrendi.disabled = false;
                    return;
                }
                // Gia' riscosso (altra scheda o altro dispositivo): niente da pagare, si chiude.
                sotto.textContent = 'Il bonus di oggi risulta gia\' riscosso.';
                azioni.replaceChildren();
                const chiudi = el('button', 'lb-btn lb-btn--oro', 'Fatto');
                chiudi.type = 'button'; chiudi.onclick = fine;
                azioni.appendChild(chiudi); chiudi.focus({ preventScroll: true });
                return;
            }
            mensile.classList.remove('lb-errore');
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
        azioni.append(btnPrendi);

        scheda.append(sigillo, titolo, sotto, griglia, oggiBox, mensile, azioni);
        velo.appendChild(scheda);
        document.body.appendChild(velo);
        document.addEventListener('keydown', blocca, true);
        setTimeout(() => btnPrendi.focus({ preventScroll: true }), 40);
    }

    window.LoginBonus = { PREMI, MENSILE, stato, riscuoti, mostra, buoniBusta, usaBuonoBusta };
})();
