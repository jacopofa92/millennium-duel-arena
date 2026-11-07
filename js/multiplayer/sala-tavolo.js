/**
 * sala-tavolo.js — la SALA UNICA a tavolo per tutte le modalità online (fase 1: solo anteprima, nessuna rete).
 * ---------------------------------------------------------------------------------------------------------
 * Oggi le sale online sono tre (Duello/Specchio/Raid condividono la sala a due posti, il Tag Team ne ha una sua) e si siedono in modi
 * diversi. Qui c'e' UN componente: la modalita' non decide la pagina, decide solo QUANTI posti ci sono e di che tipo, piu' le regole.
 *
 * Il componente e' CONTROLLATO: disegna lo stato che riceve (`imposta(stato)`) e per ogni gesto dell'utente emette un evento
 * (`su('prendi-posto', fn)`...); chi lo usa (oggi la pagina di anteprima, domani la sala vera con la rete) decide cosa succede e
 * richiama `imposta` con lo stato nuovo. Cosi' lo stesso disegno regge una sala finta e una vera senza cambiare riga.
 *
 * Il gesto centrale: il TUO token sta al CENTRO del tavolo finche' non scegli. Tocchi uno slot libero e il token ci scivola (un
 * movimento morbido, niente rimbalzi); ritocchi il tuo slot e torni al centro. L'host puo' sempre intervenire (menu "⋯" sugli slot).
 *
 * Forma dello stato:
 *   {
 *     squadre: { A: { nome, posti: ['A0', ...] }, B: { nome, posti: ['B0', ...] } },
 *     slot: { A0: { tipo: 'libero' | 'persona' | 'ia' | 'boss', id?, nome?, pedina?, pronto? }, ... },
 *     io: { id, nome, pedina }, ioPosto: 'A0' | null, host: boolean (io sono l'host),
 *     consentiIA: boolean,
 *     regole: [{ chiave, etichetta, valore, opzioni?: [..], modificabile: boolean }],
 *     personali: [{ chiave, titolo, valore, dettaglio?, pedina?, icona? }],
 *     codice: 'K7P2Q', pronto: boolean (io)
 *   }
 * Eventi: 'prendi-posto'(posto) · 'lascia-posto'() · 'pronto'(bool) · 'azione-host'({ tipo, posto }) · 'regola'({ chiave, valore })
 *         · 'personale'(chiave)
 */
(function () {
    'use strict';

    const el = (tag, classe, testo) => {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (testo != null) e.textContent = testo;
        return e;
    };

    /** La figura intera di un personaggio (pedina scontornata), se la pagina sa risolverla. */
    function pedinaDi(percorso) {
        if (!percorso) return '';
        return typeof window.getCharacterPawnImage === 'function' ? (window.getCharacterPawnImage(percorso) || percorso) : percorso;
    }

    function monta(radice, opzioni) {
        const gestori = {};
        const emetti = (nome, dato) => (gestori[nome] || []).forEach((fn) => fn(dato));
        let stato = null;
        let menuAperto = null;       // id del posto con il menu host aperto
        let ultimoAncoraKey = null;  // dove stava il token: serve a sapere se si e' mosso (per l'animazione)

        radice.classList.add('st-sala');
        radice.innerHTML = '';

        const tavolo = el('div', 'st-tavolo');
        const sqB = el('section', 'st-squadra st-squadra--b');
        const centro = el('div', 'st-centro');
        const sqA = el('section', 'st-squadra st-squadra--a');
        const ancoraCentro = el('div', 'st-ancora');
        const etCentro = el('p', 'st-centro-testo');
        centro.append(el('span', 'st-vs', 'VS'), ancoraCentro, etCentro);
        const token = el('div', 'st-token');
        token.setAttribute('aria-hidden', 'true');
        tavolo.append(sqB, centro, sqA, token);

        const fascia = el('div', 'st-regole');
        const personali = el('div', 'st-personali');
        const barra = el('div', 'st-barra');
        const stato_riga = el('p', 'st-stato-sala');
        const bottonePronto = el('button', 'st-pronto-btn');
        bottonePronto.type = 'button';
        const codiceEl = el('div', 'st-codice');
        barra.append(codiceEl, stato_riga, bottonePronto);

        radice.append(tavolo, fascia, personali, barra);

        // Un tocco fuori chiude il menu dell'host.
        document.addEventListener('pointerdown', (ev) => {
            if (menuAperto && !(ev.target instanceof Element && ev.target.closest('.st-cella'))) { menuAperto = null; disegna(); }
        });
        window.addEventListener('resize', () => posizionaToken(false));

        function nomeSquadra(sq) { return (stato.squadre[sq] && stato.squadre[sq].nome) || sq; }

        /** Una cella: lo slot (bottone) piu' il suo menu host. */
        function cella(squadra, indice, id) {
            const s = stato.slot[id] || { tipo: 'libero' };
            const mio = stato.ioPosto === id;
            const wrap = el('div', 'st-cella');
            const b = el('button', 'st-slot st-slot--' + (mio ? 'io' : s.tipo));
            b.type = 'button';
            b.dataset.posto = id;
            const angoli = el('span', 'st-angoli');
            angoli.setAttribute('aria-hidden', 'true');
            const fig = el('span', 'st-fig');
            if (!mio && (s.tipo === 'persona' || s.tipo === 'ia' || s.tipo === 'boss') && s.pedina) fig.style.backgroundImage = `url("${pedinaDi(s.pedina)}")`;
            if (!mio && s.tipo === 'libero') fig.textContent = '?';
            const et = el('span', 'st-etichetta', `${nomeSquadra(squadra)} · ${indice + 1}`);
            let nome, sotto;
            if (mio) { nome = stato.io.nome; sotto = stato.pronto ? 'Pronto' : 'Il tuo posto: tocca per tornare al centro'; }
            else if (s.tipo === 'libero') { nome = 'Posto libero'; sotto = 'Tocca per prendere posto'; }
            else if (s.tipo === 'ia') { nome = s.nome || 'IA'; sotto = 'Giocatore IA'; }
            else if (s.tipo === 'boss') { nome = s.nome || 'Boss'; sotto = 'Il Boss'; }
            else { nome = s.nome || 'Giocatore'; sotto = s.pronto ? 'Pronto' : 'Non ancora pronto'; }
            const n = el('b', 'st-nome', nome);
            const sub = el('small', 'st-sotto', sotto);
            b.append(angoli, fig, et, n, sub);
            if ((mio && stato.pronto) || (!mio && s.tipo === 'persona' && s.pronto)) b.append(el('i', 'st-pronto-segno', 'PRONTO'));
            b.setAttribute('aria-label', `${et.textContent}: ${nome}. ${sotto}`);
            // Prendere posto: solo uno slot libero (o il proprio, per tornare al centro). Gli altri sono dell'host.
            b.disabled = !(mio || s.tipo === 'libero');
            b.onclick = () => { if (mio) emetti('lascia-posto'); else if (s.tipo === 'libero') emetti('prendi-posto', id); };
            wrap.append(b);

            // Menu dell'host: persone altrui, IA, e slot liberi dove si puo' mettere un'IA.
            const voci = [];
            if (stato.host && !mio) {
                if (s.tipo === 'persona') {
                    voci.push(['Metti al centro', 'sposta-al-centro']);
                    if (stato.ioPosto) voci.push(['Scambia con me', 'scambia']);
                    voci.push(['Allontana dalla stanza', 'espelli']);
                } else if (s.tipo === 'ia') {
                    voci.push(['Cambia IA', 'cambia-ia'], ['Togli l\'IA', 'togli-ia']);
                } else if (s.tipo === 'libero' && stato.consentiIA) {
                    voci.push(['Metti un\'IA qui', 'metti-ia']);
                }
            }
            if (voci.length) {
                const m = el('button', 'st-menu-btn', '•••');
                m.type = 'button';
                m.setAttribute('aria-label', 'Azioni dell\'host su questo posto');
                m.onclick = (ev) => { ev.stopPropagation(); menuAperto = menuAperto === id ? null : id; disegna(); };
                wrap.append(m);
                if (menuAperto === id) {
                    const lista = el('div', 'st-menu');
                    voci.forEach(([testo, tipo]) => {
                        const v = el('button', null, testo);
                        v.type = 'button';
                        v.onclick = () => { menuAperto = null; emetti('azione-host', { tipo, posto: id }); };
                        lista.append(v);
                    });
                    wrap.append(lista);
                }
            }
            return wrap;
        }

        function disegnaSquadra(sezione, chiave) {
            const sq = stato.squadre[chiave];
            sezione.replaceChildren();
            if (!sq) { sezione.hidden = true; return; }
            sezione.hidden = false;
            sezione.dataset.n = String(sq.posti.length);
            const titolo = el('h3', 'st-squadra-titolo', sq.nome);
            const riga = el('div', 'st-riga');
            sq.posti.forEach((id, i) => riga.append(cella(chiave, i, id)));
            sezione.append(titolo, riga);
        }

        function disegnaRegole() {
            fascia.replaceChildren();
            (stato.regole || []).forEach((r) => {
                const c = el('button', 'st-chip' + (r.modificabile && stato.host ? ' st-chip--modificabile' : ''));
                c.type = 'button';
                c.append(el('small', null, r.etichetta), el('b', null, String(r.valore)));
                const puoi = r.modificabile && stato.host && r.opzioni && r.opzioni.length > 1;
                c.disabled = !puoi;
                if (r.modificabile && !stato.host) c.title = 'La decide l\'host';
                c.onclick = () => {
                    const i = r.opzioni.indexOf(r.valore);
                    emetti('regola', { chiave: r.chiave, valore: r.opzioni[(i + 1) % r.opzioni.length] });
                };
                fascia.append(c);
            });
        }

        function disegnaPersonali() {
            personali.replaceChildren();
            (stato.personali || []).forEach((p) => {
                const t = el('button', 'st-tessera');
                t.type = 'button';
                const img = el('span', 'st-tessera-img');
                if (p.pedina) img.style.backgroundImage = `url("${pedinaDi(p.pedina)}")`;
                else img.textContent = p.glifo || '';
                const testi = el('span', 'st-tessera-testi');
                testi.append(el('small', null, p.titolo), el('b', null, p.valore));
                if (p.dettaglio) testi.append(el('em', null, p.dettaglio));
                t.append(img, testi, el('span', 'st-tessera-cambia', 'Cambia'));
                t.onclick = () => emetti('personale', p.chiave);
                personali.append(t);
            });
        }

        function disegnaBarra() {
            const posti = Object.keys(stato.slot);
            const liberi = posti.filter((id) => stato.slot[id].tipo === 'libero' && id !== stato.ioPosto).length;
            const seduto = !!stato.ioPosto;
            const persone = posti.filter((id) => stato.slot[id].tipo === 'persona');
            const nonPronti = persone.filter((id) => !stato.slot[id].pronto).length + (seduto && !stato.pronto ? 1 : 0);
            let msg;
            if (!seduto) msg = 'Scegli un posto: tocca uno slot libero.';
            else if (liberi > 0) msg = liberi === 1 ? 'Manca 1 giocatore.' : `Mancano ${liberi} giocatori.`;
            else if (nonPronti > 0) msg = nonPronti === 1 ? 'Aspetto 1 giocatore pronto.' : `Aspetto ${nonPronti} giocatori pronti.`;
            else msg = 'Tutti pronti: si parte.';
            stato_riga.textContent = msg;
            bottonePronto.disabled = !seduto;
            bottonePronto.textContent = stato.pronto ? 'Annulla pronto' : 'Sono pronto';
            bottonePronto.classList.toggle('is-attivo', !!stato.pronto);
            bottonePronto.onclick = () => emetti('pronto', !stato.pronto);
            codiceEl.replaceChildren(el('small', null, 'Codice stanza'), el('b', null, stato.codice || '-----'));
        }

        /** Il token si muove con una transizione di `transform` verso il suo ancoraggio (il suo slot, o il centro). */
        function posizionaToken(anima) {
            if (!stato) return;
            const ancora = stato.ioPosto
                ? tavolo.querySelector(`.st-slot[data-posto="${stato.ioPosto}"] .st-fig`)
                : ancoraCentro;
            if (!ancora) return;
            const t = tavolo.getBoundingClientRect();
            const a = ancora.getBoundingClientRect();
            token.style.transition = anima ? '' : 'none';
            token.style.width = a.width + 'px';
            token.style.height = a.height + 'px';
            token.style.transform = `translate(${Math.round(a.left - t.left)}px, ${Math.round(a.top - t.top)}px)`;
            if (!anima) { void token.offsetWidth; token.style.transition = ''; }
        }

        function disegna() {
            disegnaSquadra(sqB, 'B');
            disegnaSquadra(sqA, 'A');
            etCentro.textContent = stato.ioPosto ? '' : 'Sei al centro: scegli dove giocare';
            ancoraCentro.classList.toggle('is-vuota', !!stato.ioPosto);
            if (stato.io.pedina) token.style.backgroundImage = `url("${pedinaDi(stato.io.pedina)}")`;
            token.classList.toggle('is-seduto', !!stato.ioPosto);
            disegnaRegole();
            disegnaPersonali();
            disegnaBarra();
            const chiave = stato.ioPosto || 'centro';
            const anima = ultimoAncoraKey !== null && ultimoAncoraKey !== chiave;
            ultimoAncoraKey = chiave;
            // Dopo il layout (le celle sono appena state ricreate), non prima: servono le misure vere.
            requestAnimationFrame(() => posizionaToken(anima));
        }

        return {
            imposta(nuovo) { stato = nuovo; disegna(); },
            stato() { return stato; },
            su(nome, fn) { (gestori[nome] = gestori[nome] || []).push(fn); }
        };
    }

    window.SalaTavolo = { monta };
})();
