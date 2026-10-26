// Raid cooperativo: guardare il campo dei compagni (SOLA LETTURA).
//
// Regole per non inquinare il duello:
//  - dal gameState si LEGGE soltanto (`fotografia`), mai si scrive;
//  - quello che si disegna sono carte con uid finti (`raid-...`) dentro un pannello a parte, che viene RIMOSSO dal DOM
//    alla chiusura: nessun codice del duello (ologrammi, riscontri, ricerche per uid, box info) puo' incontrarle;
//  - le informazioni delle carte si mostrano in un riquadro NOSTRO, non nel box info del duello (che legge lo stato
//    del proprio duello).
//
// Cosa viaggia: una fotografia PUBBLICA del campo di chi manda e di quello del suo Boss — mostri e Magie/Trappole,
// Life Point, quante carte ha in mano. Le carte COPERTE del compagno viaggiano CON la loro identita' (e' un alleato: serve
// a coordinarsi, e si apre l'info con un tocco), ma restano disegnate col dorso; quelle coperte del suo Boss no.
// Si prevedono fino a 3 compagni (Raid a piu' giocatori): ognuno ha il suo tasto e il suo campo, per `id`.
(function () {
    'use strict';

    const MAX_COMPAGNI = 3;
    const PASSO_MS = 400;
    const TASTO = 40; // diametro del tasto, in px

    /** @type {{ id: string, nome: string, image: string, campo: any }[]} */
    let compagni = [];
    let apertoId = null;
    let pannello = null;
    let timer = null;
    let nomeBoss = 'Boss';

    function formato(n) { return Math.max(0, Math.round(n)).toLocaleString('it-IT'); }

    // ------------------------------------------------------------------ fotografia (parte che manda)
    function fotoSlot(s, rivelaCoperta) {
        if (!s || !s.card) return null;
        const pos = s.position === 'defense' ? 'defense' : 'attack';
        const c = s.card;
        if (s.isFaceDown) return rivelaCoperta ? { coperta: true, id: c.id, pos } : { coperta: true, pos };
        const E = window.DuelEngine;
        const atk = E && E.getEffectiveAtk ? E.getEffectiveAtk(c) : c.attack;
        const def = E && E.getEffectiveDef ? E.getEffectiveDef(c) : c.defense;
        const dato = { id: c.id, pos };
        if (Number.isInteger(atk)) dato.atk = atk;
        if (Number.isInteger(def)) dato.def = def;
        return dato;
    }

    function fotografia(g) {
        const riga = (a, rivela) => Array.from({ length: 5 }, (_, i) => fotoSlot(a && a[i], rivela));
        return {
            lp: g.playerLP, mano: (g.playerHand || []).length, mazzo: g.playerDeckCount || 0,
            cimitero: (g.playerGraveyard || []).length,
            mostri: riga(g.playerMonsterField, true), mt: riga(g.playerSTField, true),
            bossLp: g.botLP, bossMano: (g.botHand || []).length, bossCimitero: (g.botGraveyard || []).length,
            bossMostri: riga(g.botMonsterField, false), bossMt: riga(g.botSTField, false)
        };
    }

    // ------------------------------------------------------------------ disegno
    function modello(id) {
        return typeof cardDatabase !== 'undefined' ? cardDatabase.find((c) => c.id === id) : null;
    }

    function cartaDa(dato, k) {
        let carta = { id: -1, uid: 'raid-' + k, name: '', type: 'monster' };
        if (dato && Number.isInteger(dato.id)) {
            const m = modello(dato.id);
            if (m) carta = Object.assign({}, m, { uid: 'raid-' + k });
            if (!dato.coperta) {
                if (Number.isInteger(dato.atk)) carta.attack = dato.atk;
                if (Number.isInteger(dato.def)) carta.defense = dato.def;
            }
        }
        return carta;
    }

    function slot(dato, k, tipo) {
        const el = document.createElement('div');
        el.className = 'mpr-slot mpr-slot--' + tipo;
        if (!dato || typeof createCardElement !== 'function') return el;
        try {
            el.appendChild(createCardElement(cartaDa(dato, k), !!dato.coperta, dato.pos, { miniatura: true }));
        } catch (e) { return el; }
        // Con l'identita' nota (carte scoperte, o coperte del COMPAGNO) si puo' aprire l'informazione.
        if (Number.isInteger(dato.id) && modello(dato.id)) {
            el.classList.add('mpr-leggibile');
            if (dato.coperta) el.classList.add('mpr-coperta-nota');
            el.addEventListener('click', () => mostraInfo(dato, k));
        }
        return el;
    }

    function mano(n, k) {
        const div = document.createElement('div');
        div.className = 'mpr-mano';
        const tot = Math.max(0, Math.min(12, n | 0));
        for (let i = 0; i < tot; i++) {
            const s = document.createElement('div');
            s.className = 'mpr-mano-carta';
            // Ventaglio: le carte si sovrappongono e si aprono appena.
            const mezzo = (tot - 1) / 2;
            s.style.setProperty('--rot', ((i - mezzo) * 3).toFixed(1) + 'deg');
            s.style.setProperty('--su', (Math.abs(i - mezzo) * .8).toFixed(1) + 'px');
            if (typeof createCardElement === 'function') {
                try { s.appendChild(createCardElement({ id: -1, uid: 'raid-m' + k + i, name: '', type: 'monster' }, true, 'attack', { miniatura: true })); } catch (e) { /* resta vuota */ }
            }
            div.appendChild(s);
        }
        const etichetta = document.createElement('span');
        etichetta.className = 'mpr-mano-n';
        etichetta.textContent = String(n);
        div.appendChild(etichetta);
        return div;
    }

    function riga(dati, k, tipo, etichetta) {
        const r = document.createElement('div');
        r.className = 'mpr-riga mpr-riga--' + tipo;
        r.setAttribute('data-etichetta', etichetta);
        (dati || []).forEach((d, i) => r.appendChild(slot(d, k + '-' + i, tipo)));
        return r;
    }

    function blocco(classe, titolo, sotto, parti) {
        const s = document.createElement('section');
        s.className = 'mpr-blocco ' + classe;
        const h = document.createElement('div');
        h.className = 'mpr-blocco-testa';
        const t = document.createElement('span');
        t.className = 'mpr-blocco-titolo';
        t.textContent = titolo;
        const st = document.createElement('span');
        st.className = 'mpr-blocco-stat';
        st.textContent = sotto;
        h.append(t, st);
        s.appendChild(h);
        parti.forEach((p) => s.appendChild(p));
        return s;
    }

    function disegna() {
        if (!pannello) return;
        const c = compagni.find((x) => x.id === apertoId);
        const corpo = pannello.querySelector('.mpr-corpo');
        const testata = pannello.querySelector('.mpr-testata');
        corpo.textContent = '';
        testata.textContent = '';
        if (!c) return;

        const av = document.createElement('span');
        av.className = 'mpr-avatar';
        if (c.image) av.style.backgroundImage = `url("${c.image}")`;
        const nome = document.createElement('span');
        nome.className = 'mpr-nome-giocatore';
        nome.textContent = c.nome;
        const sub = document.createElement('span');
        sub.className = 'mpr-sub';
        sub.textContent = c.campo ? `LP ${formato(c.campo.lp)}` : '';
        const chi = document.createElement('span');
        chi.className = 'mpr-chi';
        chi.append(nome, sub);
        testata.append(av, chi);

        const f = c.campo;
        if (!f) {
            const vuoto = document.createElement('div');
            vuoto.className = 'mpr-vuoto';
            vuoto.textContent = `${c.nome} non ha ancora mostrato il suo campo.`;
            corpo.appendChild(vuoto);
            return;
        }
        // In alto il Boss (come lo vede lui: Magie/Trappole in cima, mostri sotto), in basso il giocatore.
        corpo.append(
            blocco('mpr-boss', nomeBoss, `LP ${formato(f.bossLp)} · Cimitero ${f.bossCimitero}`, [
                mano(f.bossMano, 'b'),
                riga(f.bossMt, 'bt', 'mt', 'Magie / Trappole'),
                riga(f.bossMostri, 'bm', 'mostro', 'Mostri')
            ]),
            (() => { const d = document.createElement('div'); d.className = 'mpr-scontro'; d.textContent = '⚔'; return d; })(),
            blocco('mpr-giocatore', c.nome, `Mazzo ${f.mazzo} · Cimitero ${f.cimitero}`, [
                riga(f.mostri, 'gm', 'mostro', 'Mostri'),
                riga(f.mt, 'gt', 'mt', 'Magie / Trappole'),
                mano(f.mano, 'g')
            ])
        );
    }

    // ------------------------------------------------------------------ info carta (riquadro nostro)
    function chiudiInfo() {
        const i = pannello && pannello.querySelector('.mpr-info');
        if (i) i.remove();
    }

    function mostraInfo(dato, k) {
        if (!pannello) return;
        chiudiInfo();
        const m = modello(dato.id);
        if (!m) return;
        const carta = cartaDa(Object.assign({}, dato, { coperta: false }), 'i' + k);
        const termini = typeof getCardTerms === 'function' ? getCardTerms(carta) : { monsterSingular: 'Mostro', spellSingular: 'Magia', trapSingular: 'Trappola' };
        const tipo = carta.type === 'monster' ? termini.monsterSingular : carta.type === 'spell' ? termini.spellSingular : termini.trapSingular;
        const box = document.createElement('div');
        box.className = 'mpr-info';
        const anteprima = document.createElement('div');
        anteprima.className = 'mpr-info-carta';
        try { anteprima.appendChild(createCardElement(carta, false, 'attack')); } catch (e) { /* senza anteprima */ }
        const testo = document.createElement('div');
        testo.className = 'mpr-info-testo';
        const t = document.createElement('strong');
        t.textContent = carta.name + (dato.coperta ? ' (coperta)' : '');
        const r = document.createElement('div');
        r.className = 'mpr-info-riga';
        const livello = carta.type === 'monster' && carta.level ? ` · Livello ${carta.level}` : '';
        const stat = carta.type === 'monster' ? ` · ATK ${carta.attack} / DEF ${carta.defense}` : '';
        r.textContent = tipo + livello + stat;
        const e = document.createElement('p');
        const scritto = typeof formatCardText === 'function' ? formatCardText(carta.effect, carta) : carta.effect;
        e.textContent = scritto || 'Questa carta non presenta un effetto scritto.';
        testo.append(t, r, e);
        box.append(anteprima, testo);
        box.addEventListener('click', chiudiInfo);
        pannello.querySelector('.mpr-scheda').appendChild(box);
    }

    // ------------------------------------------------------------------ pannello e tasti
    function chiudiPannello() {
        if (pannello) { pannello.remove(); pannello = null; }
        apertoId = null;
        segnaTastoAttivo();
    }

    function apriPannello(id) {
        if (pannello && apertoId === id) { chiudiPannello(); return; }
        if (!pannello) {
            pannello = document.createElement('div');
            pannello.id = 'mpRaidCampo';
            const scheda = document.createElement('div');
            scheda.className = 'mpr-scheda';
            scheda.setAttribute('role', 'dialog');
            scheda.setAttribute('aria-label', 'Campo del compagno');
            const x = document.createElement('button');
            x.type = 'button';
            x.className = 'mpr-chiudi';
            x.setAttribute('aria-label', 'Chiudi');
            x.textContent = '✕';
            const testata = document.createElement('div');
            testata.className = 'mpr-testata';
            const corpo = document.createElement('div');
            corpo.className = 'mpr-corpo';
            scheda.append(x, testata, corpo);
            pannello.appendChild(scheda);
            pannello.addEventListener('click', (e) => { if (e.target === pannello || e.target.closest('.mpr-chiudi')) chiudiPannello(); });
            document.body.appendChild(pannello);
        }
        apertoId = id;
        segnaTastoAttivo();
        disegna();
    }

    function segnaTastoAttivo() {
        document.querySelectorAll('.mpr-tasto').forEach((b) => b.classList.toggle('mpr-attivo', b.dataset.id === apertoId));
    }

    function creaTasti() {
        document.querySelectorAll('.mpr-tasto').forEach((b) => b.remove());
        compagni.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mpr-tasto';
            b.dataset.id = c.id;
            b.title = `Guarda il campo di ${c.nome}`;
            b.setAttribute('aria-label', `Guarda il campo di ${c.nome}`);
            const foto = document.createElement('span');
            foto.className = 'mpr-tasto-foto';
            if (c.image) foto.style.backgroundImage = `url("${c.image}")`;
            const badge = document.createElement('span');
            badge.className = 'mpr-tasto-badge';
            badge.textContent = '🃏';
            const nome = document.createElement('span');
            nome.className = 'mpr-tasto-nome';
            nome.textContent = c.nome;
            b.append(foto, badge, nome);
            b.onclick = () => apriPannello(c.id);
            document.body.appendChild(b);
        });
        posiziona();
        segnaTastoAttivo();
    }

    /**
     * In VERTICALE su telefono i tasti stanno nella fascia fra le Magie/Trappole del giocatore e la sua mano; altrimenti
     * a sinistra, a meta' altezza, uno sotto l'altro. Si ricalcola a ogni passo: la mano e il campo cambiano misura.
     */
    function posiziona() {
        const tasti = Array.from(document.querySelectorAll('.mpr-tasto'));
        if (tasti.length === 0) return;
        const verticale = window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches;
        const H = window.innerHeight;
        if (verticale) {
            const mano = document.getElementById('playerHand');
            const cima = mano ? mano.getBoundingClientRect().top : H - 120;
            let fondo = 0;
            document.querySelectorAll('.field-slot[data-owner="player"]').forEach((s) => {
                const r = s.getBoundingClientRect();
                // Anche una casella che sconfina sotto la cima della mano (Mazzo/Cimitero su schermi bassi) conta: la fascia
                // libera comincia dopo di lei.
                if (r.top < cima && r.bottom > fondo) fondo = r.bottom;
            });
            let centro = fondo > 0 ? (fondo + cima) / 2 : cima - 24;
            // Su schermi bassi la fascia fra le Magie/Trappole e la mano e' piu' stretta del tasto (misurato: da 375x667 in giu'
            // il tasto finiva sopra la colonna di Mazzo/Cimitero, a 320x568 anche sulla mano): li' va SOTTO la mano, che e' libera.
            if (fondo > 0 && cima - fondo < TASTO + 2 && mano) {
                const sotto = mano.getBoundingClientRect().bottom + 6;
                if (sotto + TASTO < H - 4) centro = sotto + TASTO / 2;
            }
            tasti.forEach((b, i) => {
                b.style.left = (8 + i * (TASTO + 6)) + 'px';
                b.style.top = Math.max(0, centro - TASTO / 2) + 'px';
                b.style.transform = 'none';
            });
        } else {
            const totale = tasti.length * (TASTO + 8) - 8;
            tasti.forEach((b, i) => {
                b.style.left = '8px';
                b.style.top = (H / 2 - totale / 2 + i * (TASTO + 8)) + 'px';
                b.style.transform = 'none';
            });
        }
    }

    // ------------------------------------------------------------------ API
    /** `lista` = [{ id, nome, image }] dei compagni (fino a 3), `boss` = nome del Boss. */
    function avvia(lista, boss) {
        if (boss) nomeBoss = boss;
        const vecchi = compagni;
        compagni = (lista || []).slice(0, MAX_COMPAGNI).map((c, i) => {
            const id = c.id || (i === 0 ? 'c1' : 'c' + (i + 1));
            const prima = vecchi.find((x) => x.id === id);
            return { id, nome: c.nome || 'Compagno', image: c.image || '', campo: prima ? prima.campo : null };
        });
        // Messaggi arrivati prima dell'avvio, per compagni non nell'elenco: si tengono finche' c'e' posto.
        vecchi.forEach((v) => { if (!compagni.some((x) => x.id === v.id) && compagni.length < MAX_COMPAGNI) compagni.push(v); });
        creaTasti();
        if (timer) clearInterval(timer);
        timer = setInterval(posiziona, PASSO_MS);
        window.addEventListener('resize', posiziona);
    }

    function ricevi(id, campo) {
        let c = compagni.find((x) => x.id === id);
        if (!c) {
            if (compagni.length >= MAX_COMPAGNI) return;
            c = { id, nome: 'Compagno', image: '', campo: null };
            compagni.push(c);
            if (timer) creaTasti();
        }
        c.campo = campo;
        if (apertoId === id) disegna();
    }

    window.MpRaidCampo = { avvia, ricevi, fotografia, chiudi: chiudiPannello };
})();
