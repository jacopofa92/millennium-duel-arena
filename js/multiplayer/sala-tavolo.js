/**
 * sala-tavolo.js — la SALA UNICA a tavolo per tutte le modalità online (anteprima, nessuna rete).
 * ---------------------------------------------------------------------------------------------------------
 * Oggi le sale online sono tre (Duello/Specchio/Raid condividono la sala a due posti, il Tag Team ne ha una sua) e si siedono in modi
 * diversi. Qui c'e' UN componente: la modalita' non decide la pagina, decide solo QUANTI posti ci sono e di che tipo, piu' le regole.
 *
 * Il componente e' CONTROLLATO: disegna lo stato che riceve (`imposta(stato)`) e per ogni gesto dell'utente emette un evento
 * (`su('prendi-posto', fn)`...); chi lo usa (oggi la pagina di anteprima, domani la sala vera con la rete) decide cosa succede e
 * richiama `imposta` con lo stato nuovo. Cosi' lo stesso disegno regge una sala finta e una vera senza cambiare riga.
 *
 * Il gesto centrale: il TUO token sta al CENTRO del tavolo finche' non scegli. Tocchi uno slot libero e il token ci scivola (un
 * movimento morbido, niente rimbalzi); ritocchi il tuo slot e torni al centro. L'host puo' sempre intervenire (menu "•••" sugli slot).
 *
 * Forma dello stato:
 *   {
 *     squadre: { A: { nome, posti: ['A0', ...] }, B: { nome, posti: ['B0', ...] } },
 *     slot: { A0: { tipo: 'libero' | 'persona' | 'ia' | 'boss', id?, nome?, pedina?, pronto? }, ... },
 *     io: { id, nome, pedina }, ioPosto: 'A0' | null, host: boolean (io sono l'host),
 *     consentiIA: boolean,
 *     regole: [{ chiave, etichetta, valore, img?, opzioni?: [..], modificabile: boolean }],
 *     personali: [{ chiave, titolo, valore, dettaglio?, pedina?, icona?, glifo? }],
 *     codice: 'K7P2Q', pronto: boolean (io),
 *     arenaImg?: 'percorso dello sfondo', sagoma?: 'percorso di una figura da mostrare in ombra negli slot liberi',
 *     avvio?: 3 | 2 | 1 (conto alla rovescia: lo decide chi usa il componente)
 *     postoFisso?: boolean (sale con ruoli decisi dal server: il proprio posto non si lascia, gli altri non si scelgono),
 *     prontoBloccato?: boolean ("Sono pronto" spento, es. nessun avversario ancora), messaggio?: string (sostituisce la riga di stato),
 *     puoiAlzarsi?: false (il proprio posto non si lascia: un ospite del Tag non puo' alzarsi),
 *     nascondiEspelli?: boolean (nessuna voce "Allontana"), inPiedi?: [{ id, nome, pedina?, io? }] (in stanza ma senza posto),
 *     assegna?: id (l'host sta mettendo a sedere quella persona: ogni posto diventa un bersaglio, evento 'assegna-posto')
 *   }
 *   Una regola puo' portare `aiuto` (la frase che dice cosa cambia); un elenco lungo di opzioni si sceglie in una finestra (MpScelte).
 *   Un posto libero puo' portare `daIA: true` (se resta vuoto lo gioca l'IA: per il via conta come occupato), `pedina` (chi lo giochera' se resta vuoto, mostrato in ombra) e `voci` (le voci del menu host).
 *   Altri eventi: 'in-piedi'(id) · 'assegna-posto'(posto) · 'copia-codice'(codice)
 *   Un posto puo' portare `sotto` (la riga sotto il nome) e, se libero, `nome`; una regola puo' portare `apri: true` (chip che apre
 *   una finestra, evento 'regola' con { chiave, apri: true } al posto del giro fra le opzioni).
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
    const tocco = () => { try { if (window.NativeHaptics && window.NativeHaptics.light) window.NativeHaptics.light(); } catch (e) { /* senza vibrazione */ } };

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
        let tipiPrecedenti = null;   // id -> tipo all'ultimo disegno: chi si siede ENTRA con una piccola apparizione
        let timerMoto = 0;

        radice.classList.add('st-sala');
        radice.innerHTML = '';

        // Lo sfondo e' l'arena scelta, sfocata e scurita: la sala cambia atmosfera con il campo. Sta dietro a tutto.
        const sfondo = el('div', 'st-sfondo');
        sfondo.setAttribute('aria-hidden', 'true');
        const tavolo = el('div', 'st-tavolo');
        const sqB = el('section', 'st-squadra st-squadra--b');
        const centro = el('div', 'st-centro');
        const sqA = el('section', 'st-squadra st-squadra--a');
        const ancoraCentro = el('div', 'st-ancora');
        const emblema = el('div', 'st-emblema');
        emblema.innerHTML = '<span class="st-emblema-anello"></span><span class="st-emblema-testo">VS</span>';
        const etCentro = el('p', 'st-centro-testo');
        const conto = el('div', 'st-conto');
        centro.append(emblema, ancoraCentro, etCentro, conto);
        const token = el('div', 'st-token');
        token.setAttribute('aria-hidden', 'true');
        tavolo.append(sqB, centro, sqA, token);

        const inPiediEl = el('div', 'st-inpiedi');
        const fascia = el('div', 'st-regole');
        const personali = el('div', 'st-personali');
        const barra = el('div', 'st-barra');
        const stato_riga = el('p', 'st-stato-sala');
        const bottonePronto = el('button', 'st-pronto-btn');
        bottonePronto.type = 'button';
        // Il codice e' un tasto: un tocco lo copia (e' la cosa che si fa subito dopo aver aperto una stanza).
        const codiceEl = el('button', 'st-codice');
        codiceEl.type = 'button';
        codiceEl.title = 'Tocca per copiare il codice';
        let timerCopia = 0;
        barra.append(codiceEl, stato_riga, bottonePronto);

        radice.append(sfondo, tavolo, inPiediEl, fascia, personali, barra);

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
            const entra = tipiPrecedenti && tipiPrecedenti[id] === 'libero' && (s.tipo === 'persona' || s.tipo === 'ia');
            const pronto = (mio && stato.pronto) || (!mio && s.tipo === 'persona' && s.pronto);
            const b = el('button', 'st-slot st-slot--' + (mio ? 'io' : s.tipo) + (pronto ? ' is-pronto' : '') + (entra ? ' st-entra' : ''));
            b.type = 'button';
            b.dataset.posto = id;
            const angoli = el('span', 'st-angoli');
            angoli.setAttribute('aria-hidden', 'true');
            const base = el('span', 'st-base');
            base.setAttribute('aria-hidden', 'true');
            const fig = el('span', 'st-fig');
            if (!mio && (s.tipo === 'persona' || s.tipo === 'ia' || s.tipo === 'boss') && s.pedina) fig.style.backgroundImage = `url("${pedinaDi(s.pedina)}")`;
            // Un posto libero che lo giochera' l'IA mostra il duellante, in ombra: si capisce chi comparira' se resta vuoto.
            if (!mio && s.tipo === 'libero' && s.pedina) { fig.style.backgroundImage = `url("${pedinaDi(s.pedina)}")`; fig.classList.add('st-fig--ia'); }
            else if (!mio && s.tipo === 'libero' && !stato.sagoma) fig.textContent = '?';
            const et = el('span', 'st-etichetta', `${nomeSquadra(squadra)} · ${indice + 1}`);
            let nome, sotto;
            if (mio) { nome = stato.io.nome; sotto = stato.pronto ? 'Pronto' : (stato.postoFisso ? 'Il tuo posto' : 'Il tuo posto: tocca per tornare al centro'); }
            else if (s.tipo === 'libero') { nome = s.nome || 'Posto libero'; sotto = s.sotto || (stato.postoFisso ? 'In attesa di un giocatore…' : 'Tocca per prendere posto'); }
            else if (s.tipo === 'ia') { nome = s.nome || 'IA'; sotto = 'Giocatore IA'; }
            else if (s.tipo === 'boss') { nome = s.nome || 'Boss'; sotto = 'Il Boss'; }
            else { nome = s.nome || 'Giocatore'; sotto = s.sotto || (s.pronto ? 'Pronto' : 'Non ancora pronto'); }
            const n = el('b', 'st-nome', nome);
            const sub = el('small', 'st-sotto', sotto);
            b.append(angoli, base, fig, et, n, sub);
            if (pronto) b.append(el('i', 'st-pronto-segno', 'PRONTO'));
            b.setAttribute('aria-label', `${et.textContent}: ${nome}. ${sotto}`);
            // Prendere posto: solo uno slot libero (o il proprio, per tornare al centro). Gli altri sono dell'host.
            // Con `postoFisso` (le sale a due posti con ruoli decisi dal server) il proprio posto non si lascia e gli altri non si scelgono.
            // `assegna`: l'host sta mettendo a sedere qualcuno che era in piedi, e ogni posto (anche occupato: si scambiano) e' un bersaglio.
            const assegnando = !!(stato.assegna && stato.host);
            b.disabled = assegnando ? false : (stato.postoFisso ? true : (mio ? stato.puoiAlzarsi === false : s.tipo !== 'libero'));
            if (assegnando) b.classList.add('is-bersaglio');
            b.onclick = () => {
                if (assegnando) { tocco(); emetti('assegna-posto', id); return; }
                if (mio) { tocco(); emetti('lascia-posto'); } else if (s.tipo === 'libero') { tocco(); emetti('prendi-posto', id); }
            };
            wrap.append(b);

            // Menu dell'host: persone altrui, IA, e slot liberi dove si puo' mettere un'IA.
            const voci = [];
            if (stato.host && !mio) {
                if (s.tipo === 'persona') {
                    voci.push(['Metti al centro', 'sposta-al-centro']);
                    if (stato.ioPosto) voci.push(['Scambia con me', 'scambia']);
                    if (!stato.nascondiEspelli) voci.push(['Allontana dalla stanza', 'espelli']);
                } else if (s.voci && s.voci.length) {
                    s.voci.forEach((v) => voci.push(v));
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

        /** Chi e' nella stanza ma non ha ancora un posto: chip. L'host ne tocca uno per sceglierlo e poi tocca il posto dove metterlo. */
        function disegnaInPiedi() {
            inPiediEl.replaceChildren();
            const lista = stato.inPiedi || [];
            inPiediEl.hidden = !lista.length;
            if (!lista.length) return;
            inPiediEl.append(el('span', 'st-inpiedi-titolo', 'In piedi'));
            lista.forEach((p) => {
                const c = el('button', 'st-inpiedi-chip' + (stato.assegna === p.id ? ' is-scelto' : ''), p.nome + (p.io ? ' (tu)' : ''));
                c.type = 'button';
                c.disabled = !(stato.host && !p.io);
                if (p.pedina) { const f = el('span', 'st-inpiedi-fig'); f.style.backgroundImage = `url("${pedinaDi(p.pedina)}")`; c.prepend(f); }
                c.onclick = () => { tocco(); emetti('in-piedi', p.id); };
                inPiediEl.append(c);
            });
        }

        /** Un elenco lungo di opzioni (mazzi, Boss...) si sceglie in una finestra, non girando fra i valori uno alla volta. */
        function sceglidaElenco(r) {
            if (!window.MpScelte) {
                const i = r.opzioni.indexOf(r.valore);
                emetti('regola', { chiave: r.chiave, valore: r.opzioni[(i + 1) % r.opzioni.length] });
                return;
            }
            const corpo = el('div', 'st-lista');
            r.opzioni.forEach((o) => {
                const v = el('button', 'st-lista-voce' + (o === r.valore ? ' is-scelto' : ''), o);
                v.type = 'button';
                v.onclick = () => { window.MpScelte.chiudi(); if (o !== r.valore) emetti('regola', { chiave: r.chiave, valore: o }); };
                corpo.append(v);
            });
            window.MpScelte.apri(r.etichetta, corpo);
        }

        /**
         * Le opzioni della partita: un pannello a righe. Ogni riga ha il nome, una frase che dice cosa cambia e il controllo:
         * due o tre scelte stanno in un selettore a segmenti (si vedono tutte, si tocca quella che si vuole); le altre (arena, mazzo,
         * Boss) sono un riquadro col valore corrente che apre la scelta. Per chi non e' host le righe sono in sola lettura.
         */
        function disegnaRegole() {
            fascia.replaceChildren();
            const lista = stato.regole || [];
            fascia.hidden = !lista.length;
            if (!lista.length) return;
            fascia.append(el('h3', 'st-opzioni-titolo', stato.host ? 'Opzioni della partita' : 'Opzioni della partita · le decide l\'host'));
            lista.forEach((r) => {
                const puoi = !!(r.modificabile && stato.host && (r.apri || (r.opzioni && r.opzioni.length > 1)));
                const riga = el('div', 'st-opz' + (puoi ? '' : ' is-letta'));
                riga.dataset.chiave = r.chiave;
                const testa = el('div', 'st-opz-testa');
                testa.append(el('b', null, r.etichetta));
                if (r.aiuto) testa.append(el('small', null, r.aiuto));
                riga.append(testa);
                if (!r.apri && r.opzioni && r.opzioni.length >= 2 && r.opzioni.length <= 3) {
                    const seg = el('div', 'st-seg');
                    seg.setAttribute('role', 'radiogroup');
                    seg.setAttribute('aria-label', r.etichetta);
                    r.opzioni.forEach((o) => {
                        const v = el('button', 'st-seg-voce' + (o === r.valore ? ' is-scelto' : ''), o);
                        v.type = 'button';
                        v.setAttribute('role', 'radio');
                        v.setAttribute('aria-checked', String(o === r.valore));
                        v.disabled = !puoi;
                        v.onclick = () => { if (o !== r.valore) { tocco(); emetti('regola', { chiave: r.chiave, valore: o }); } };
                        seg.append(v);
                    });
                    riga.append(seg);
                } else {
                    const c = el('button', 'st-opz-valore');
                    c.type = 'button';
                    c.disabled = !puoi;
                    if (r.img) { const mi = el('span', 'st-opz-img'); mi.style.backgroundImage = `url("${r.img}")`; c.append(mi); }
                    c.append(el('span', 'st-opz-testo', String(r.valore)));
                    if (puoi) c.append(el('span', 'st-opz-freccia', '›'));
                    c.onclick = () => {
                        tocco();
                        // `apri`: la scelta ha una sua finestra (arena, Boss...), la apre chi usa il componente.
                        if (r.apri) emetti('regola', { chiave: r.chiave, apri: true });
                        else sceglidaElenco(r);
                    };
                    riga.append(c);
                }
                fascia.append(riga);
            });
        }

        function disegnaPersonali() {
            personali.replaceChildren();
            (stato.personali || []).forEach((p) => {
                const t = el('button', 'st-tessera');
                t.type = 'button';
                const img = el('span', 'st-tessera-img');
                if (p.pedina) img.style.backgroundImage = `url("${pedinaDi(p.pedina)}")`;
                else {
                    const svg = (p.icona && window.Icons && window.Icons.buildIcon) ? window.Icons.buildIcon(p.icona) : null;
                    if (svg) img.append(svg); else img.textContent = p.glifo || '';
                }
                const testi = el('span', 'st-tessera-testi');
                testi.append(el('small', null, p.titolo), el('b', null, p.valore));
                if (p.dettaglio) testi.append(el('em', null, p.dettaglio));
                t.append(img, testi, el('span', 'st-tessera-cambia', 'Cambia'));
                t.onclick = () => emetti('personale', p.chiave);
                personali.append(t);
            });
        }

        /** Tutti seduti e tutti pronti (io compreso): il tavolo si accende. */
        function tuttiPronti() {
            const ids = Object.keys(stato.slot);
            if (!stato.ioPosto || !stato.pronto) return false;
            return ids.every((id) => {
                const s = stato.slot[id];
                if (id === stato.ioPosto) return true;
                return s.tipo === 'ia' || s.tipo === 'boss' || (s.tipo === 'libero' && s.daIA) || (s.tipo === 'persona' && s.pronto);
            });
        }

        function disegnaBarra(pronti) {
            const posti = Object.keys(stato.slot);
            const liberi = posti.filter((id) => stato.slot[id].tipo === 'libero' && !stato.slot[id].daIA && id !== stato.ioPosto).length;
            const seduto = !!stato.ioPosto;
            const persone = posti.filter((id) => stato.slot[id].tipo === 'persona');
            const nonPronti = persone.filter((id) => !stato.slot[id].pronto).length + (seduto && !stato.pronto ? 1 : 0);
            let msg;
            if (!seduto) msg = 'Scegli un posto: tocca uno slot libero.';
            else if (liberi > 0) msg = liberi === 1 ? 'Manca 1 giocatore.' : `Mancano ${liberi} giocatori.`;
            else if (nonPronti > 0) msg = nonPronti === 1 ? 'Aspetto 1 giocatore pronto.' : `Aspetto ${nonPronti} giocatori pronti.`;
            else msg = 'Tutti pronti: si parte.';
            stato_riga.textContent = stato.messaggio || msg;
            bottonePronto.disabled = !seduto || !!stato.prontoBloccato;
            bottonePronto.textContent = stato.pronto ? 'Annulla pronto' : 'Sono pronto';
            bottonePronto.classList.toggle('is-attivo', !!stato.pronto);
            bottonePronto.onclick = () => { tocco(); emetti('pronto', !stato.pronto); };
            const etCodice = el('small', null, 'Codice stanza');
            codiceEl.replaceChildren(etCodice, el('b', null, stato.codice || '-----'));
            codiceEl.onclick = () => {
                tocco();
                emetti('copia-codice', stato.codice);
                const ok = () => { etCodice.textContent = 'Copiato!'; clearTimeout(timerCopia); timerCopia = setTimeout(() => { etCodice.textContent = 'Codice stanza'; }, 1400); };
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(stato.codice || '').then(ok, () => {}); else ok();
            };
            barra.classList.toggle('is-pronti', pronti);
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
            if (anima) {
                // Per la durata dello spostamento il token e' piu' luminoso: una scia di luce dorata dietro di lui.
                token.classList.add('is-in-moto');
                clearTimeout(timerMoto);
                timerMoto = setTimeout(() => token.classList.remove('is-in-moto'), 600);
            } else { void token.offsetWidth; token.style.transition = ''; }
        }

        function disegna() {
            const pronti = tuttiPronti();
            radice.style.setProperty('--st-sagoma', stato.sagoma ? `url("${pedinaDi(stato.sagoma)}")` : 'none');
            radice.classList.toggle('st-con-sagoma', !!stato.sagoma);
            radice.classList.toggle('st-fissa', !!stato.postoFisso);
            sfondo.style.backgroundImage = stato.arenaImg ? `url("${stato.arenaImg}")` : 'none';
            disegnaSquadra(sqB, 'B');
            disegnaSquadra(sqA, 'A');
            tavolo.classList.toggle('is-tutti-pronti', pronti);
            if (stato.avvio) { etCentro.textContent = ''; conto.textContent = String(stato.avvio); conto.classList.add('is-visibile'); }
            else {
                conto.classList.remove('is-visibile');
                etCentro.textContent = pronti ? 'Tutti pronti' : ((stato.ioPosto || stato.postoFisso) ? '' : 'Sei al centro: scegli dove giocare');
            }
            emblema.classList.toggle('is-nascosto', !!stato.avvio);
            ancoraCentro.classList.toggle('is-vuota', !!stato.ioPosto);
            if (stato.io.pedina) token.style.backgroundImage = `url("${pedinaDi(stato.io.pedina)}")`;
            token.classList.toggle('is-seduto', !!stato.ioPosto);
            disegnaInPiedi();
            disegnaRegole();
            disegnaPersonali();
            disegnaBarra(pronti);
            tipiPrecedenti = {};
            Object.keys(stato.slot).forEach((id) => { tipiPrecedenti[id] = stato.slot[id].tipo; });
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

    /**
     * La sala a tavolo e' la sala di serie, senza parametri nell'indirizzo. `window.SALA_CLASSICA = true` la spegne: lo usano solo i test
     * che guardano gli elementi della sala vecchia.
     */
    function acceso() {
        return window.SALA_CLASSICA !== true;
    }

    window.SalaTavolo = { monta, acceso };
})();
