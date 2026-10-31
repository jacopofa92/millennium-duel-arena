// @ts-check
/**
 * mp-tag-sala.js — la sala del TAG TEAM IN RETE (multiplayer.html?modo=tag).
 * =====================================================================
 * Come vuole l'autore: l'host sceglie il formato (2 contro 2, 2 contro 1) e
 * apre la stanza; ognuno entra col codice e SI SIEDE in un posto libero;
 * l'host sistema le coppie (sposta o scambia le persone fra i posti); i posti
 * rimasti vuoti li gioca l'IA (girano sul client dell'host, vedi
 * js/multiplayer/mp-passo-comune.js); quando tutti sono seduti e hanno
 * confermato di essere pronti, si parte. Ogni cambio di posti o di regole
 * toglie il "pronto" a tutti: si conferma la disposizione finale.
 *
 * Chi decide: l'HOST tiene lo stato della sala e lo manda a tutti a ogni
 * cambiamento (tipo 'stato'); gli altri chiedono (tipo 'io': nome, pedina,
 * pronto; tipo 'siedi': un posto) e disegnano quello che ricevono. Così non
 * esistono due versioni della sala. Se l'host esce, il relay ne nomina un
 * altro (il primo rimasto) e quello continua dallo stato che aveva.
 *
 * La stanza la crea il relay con `capienza` 3 o 4 (server/server.js): da lì
 * arrivano 'room-update' (chi c'è, chi è l'host, il mio id pubblico) e ogni
 * messaggio porta `da`. Un relay vecchio non sa fare stanze grandi: lo si
 * capisce dalla risposta (niente `capienza`) e lo si dice.
 *
 * Tutti i messaggi della sala sono `kind: 'tag-sala'` (forma in
 * js/multiplayer/protocollo-mp.js). Alla partenza la disposizione diventa
 * quella del passo comune a posti (MpPassoComune.configuraPosti) e la
 * variante a squadre la legge da window.MP_TAG (js/modes/tag-mode.js).
 */
(function () {
    'use strict';

    /** @type {any} */
    const g = window;
    const net = g.DuelNetwork;
    if (!net) return;

    const FORMATI = {
        '2v2': { capienza: 4, posti: ['A0', 'A1', 'B0', 'B1'], nome: '2 contro 2', descrizione: 'Due coppie, una contro l\'altra.' },
        '2v1': { capienza: 3, posti: ['A0', 'A1', 'B0'], nome: '2 contro 1', descrizione: 'Una coppia contro un duellante solo (una persona, l\'IA o un Boss).' }
    };
    const LIVELLI = [['easy', 'Facile'], ['medium', 'Normale'], ['hard', 'Difficile']];
    const NOMI_SQUADRA = { A: 'Squadra Oro', B: 'Squadra Ombra' };

    let formatoScelto = '2v2';
    let attiva = false;
    let avviata = false;
    /** Ho chiesto una stanza da Tag: se il relay risponde senza capienza, è vecchio. */
    let richiestaInCorso = false;
    let codice = '';
    /** @type {string|null} */ let io = null;
    /** @type {string|null} */ let host = null;
    /** @type {{ id: string, collegato: boolean }[]} */ let presenti = [];
    /** Lo stato della sala (lo tiene l'host, gli altri lo ricevono). @type {any} */
    let stato = null;
    let mioPronto = false;
    /** Host: la persona che sta spostando. @type {string|null} */ let spostando = null;
    let setupArena = null;
    let setupMazzi = null;
    const scelta = { field: null, music: null };

    function $(id) { return document.getElementById(id); }
    function interna() { return g.MpSalaInterna || {}; }
    function status(testo, errore) { if (interna().showStatus) interna().showStatus(testo, errore); }
    function sonoHost() { return !!io && io === host; }
    const pulisci = (t) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    function mioNome() { return pulisci((g.SaveManager && SaveManager.getPlayerName && SaveManager.getPlayerName()) || '') || 'Giocatore'; }
    function personaggio(id) { return (typeof characterDatabase !== 'undefined' ? characterDatabase : []).find((c) => c.id === id) || null; }
    function nomePersonaggio(id) { const c = personaggio(id); return c ? c.name : id; }

    /**
     * I Duellanti che l'IA può giocare in un posto vuoto: TUTTI quelli con un mazzo vero, senza
     * restrizioni (decisione dell'autore), i compagni proposti per primi. Senza l'elenco dei mazzi
     * (character-decks.js non caricato) restano i compagni proposti e i Boss, che un mazzo ce l'hanno.
     */
    function duellantiIA() {
        const ids = [];
        const aggiungi = (id) => { if (id && ids.indexOf(id) === -1 && personaggio(id)) ids.push(id); };
        (typeof tagDatabase !== 'undefined' ? tagDatabase.compagniProposti : []).forEach(aggiungi);
        if (typeof getCharacterDeck === 'function') {
            (typeof characterDatabase !== 'undefined' ? characterDatabase : []).forEach((c) => { if (getCharacterDeck(c.id, 'medium')) aggiungi(c.id); });
        }
        (g.RAID_BOSSES || []).forEach((b) => aggiungi(b.id));
        return ids;
    }
    function bossDisponibili() { return (g.RAID_BOSSES || []).filter((b) => personaggio(b.id)); }

    // ------------------------------------------------------------------
    // Ingresso: il formato si sceglie prima di aprire la stanza
    // ------------------------------------------------------------------

    function modoTag() { return g.MP_MODO === 'tag'; }

    /**
     * Da mp-lobby.js, al click su "Apri la stanza": la capienza da chiedere, o
     * null fuori dal Tag. Da qui la prossima 'room-created' è nostra.
     */
    function capienzaRichiesta() {
        if (!modoTag()) return null;
        richiestaInCorso = true;
        return FORMATI[formatoScelto].capienza;
    }

    function montaSceltaFormato() {
        const box = $('mpTagFormato');
        if (!box || !modoTag()) return;
        box.hidden = false;
        box.innerHTML = '';
        Object.keys(FORMATI).forEach((id) => {
            const f = FORMATI[id];
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tg-formato' + (id === formatoScelto ? ' is-scelto' : '');
            b.setAttribute('data-formato', id);
            b.setAttribute('aria-pressed', String(id === formatoScelto));
            const t = document.createElement('strong'); t.textContent = f.nome;
            const d = document.createElement('small'); d.textContent = f.descrizione;
            b.append(t, d);
            b.onclick = () => { formatoScelto = id; montaSceltaFormato(); };
            box.appendChild(b);
        });
        const testo = document.querySelector('#mpPanelCreate > p');
        if (testo) testo.textContent = 'Scegli il formato e apri la stanza: chi entra si siede, tu sistemi le coppie, i posti liberi li gioca l\'IA.';
    }

    // ------------------------------------------------------------------
    // Stato della sala (host)
    // ------------------------------------------------------------------

    function statoIniziale(formato) {
        const posti = {};
        FORMATI[formato].posti.forEach((p) => { posti[p] = null; });
        posti.A0 = io;
        const ia = {};
        const dueIA = duellantiIA();
        FORMATI[formato].posti.forEach((p, i) => { ia[p] = dueIA[i % Math.max(1, dueIA.length)] || 'yugiMuto'; });
        if (formato === '2v1' && personaggio('kaiba')) ia.B0 = 'kaiba';
        return {
            formato, posti, ia,
            livelloIA: 'medium',
            boss: null,
            regolaLp: typeof tagDatabase !== 'undefined' ? tagDatabase.regolaLpPredefinita : 'membro',
            scambio: typeof tagDatabase !== 'undefined' ? tagDatabase.scambioPredefinito : 'obbligato',
            campo: null, musica: null,
            persone: {},
            v: 0
        };
    }

    function postoDi(id) {
        if (!stato) return null;
        return Object.keys(stato.posti).find((k) => stato.posti[k] === id) || null;
    }

    /** Ogni cambio di disposizione o di regole: si riconferma tutto. */
    function togliPronti() {
        Object.keys(stato.persone).forEach((id) => { stato.persone[id].pronto = false; });
    }

    /** Host: lo stato a tutti, poi il controllo della partenza. */
    function pubblica() {
        if (!sonoHost() || !stato || avviata) return;
        stato.v++;
        net.sendAction({ kind: 'tag-sala', tipo: 'stato', stato });
        disegna();
        controllaPartenza();
    }

    /** Host: tiene la sala allineata a chi c'è davvero nella stanza. */
    function allineaAiPresenti() {
        // Io ci sono sempre, anche prima del primo elenco del relay (arriva subito dopo 'room-created').
        const ids = presenti.map((p) => p.id).concat(io ? [io] : []);
        Object.keys(stato.posti).forEach((k) => { if (stato.posti[k] && ids.indexOf(stato.posti[k]) === -1) stato.posti[k] = null; });
        Object.keys(stato.persone).forEach((id) => { if (ids.indexOf(id) === -1) delete stato.persone[id]; });
        stato.persone[io] = Object.assign(stato.persone[io] || {}, { nome: mioNome(), pedina: g.MpPedina ? MpPedina.scelta().id : 'player', pronto: mioPronto && !!postoDi(io) });
    }

    /**
     * Host: mette (o sposta) `chi` nel posto `posto`; se è occupato, i due si
     * scambiano (chi era lì va nel posto lasciato, o in piedi). Un ospite può
     * chiedere solo un posto libero: lo controlla chi riceve la richiesta.
     */
    function siedi(chi, posto) {
        if (!stato || !(posto in stato.posti)) return;
        const da = postoDi(chi);
        if (da === posto) return;
        const occupante = stato.posti[posto];
        stato.posti[posto] = chi;
        if (da) stato.posti[da] = occupante || null;
        togliPronti();
    }

    function riceviIo(da, m) {
        if (!sonoHost() || !stato) return;
        const prima = stato.persone[da] || {};
        const seduto = !!postoDi(da);
        stato.persone[da] = {
            nome: pulisci(m.nome) || 'Giocatore',
            pedina: typeof m.pedina === 'string' ? m.pedina : 'player',
            pronto: !!m.pronto && seduto
        };
        if (JSON.stringify(prima) !== JSON.stringify(stato.persone[da])) pubblica();
        else net.sendAction({ kind: 'tag-sala', tipo: 'stato', stato }); // chi è appena entrato deve ricevere lo stato comunque
    }

    // ------------------------------------------------------------------
    // Partenza (host)
    // ------------------------------------------------------------------

    function controllaPartenza() {
        if (!sonoHost() || avviata || !stato) return;
        if (presenti.length < 2) return;
        const tuttiPronti = presenti.every((p) => p.collegato && postoDi(p.id) && stato.persone[p.id] && stato.persone[p.id].pronto);
        if (!tuttiPronti) return;
        const posti = {};
        Object.keys(stato.posti).forEach((k) => {
            const chi = stato.posti[k];
            if (chi) {
                const p = stato.persone[chi] || {};
                posti[k] = { tipo: 'persona', client: chi, nome: p.nome || 'Giocatore', pedina: p.pedina || 'player' };
            } else if (k === 'B0' && stato.formato === '2v1' && stato.boss) {
                posti[k] = { tipo: 'ia', personaggio: stato.boss, mazzo: 'hard', ia: 'hard', boss: true };
            } else {
                posti[k] = { tipo: 'ia', personaggio: stato.ia[k], mazzo: stato.livelloIA, ia: stato.livelloIA };
            }
        });
        const R = g.ArenaOptions.RANDOM;
        const partenza = {
            formato: stato.formato,
            host: io,
            posti,
            iniziaSquadra: Math.random() < 0.5 ? 'A' : 'B',
            regolaLp: stato.regolaLp,
            scambio: stato.scambio,
            boss: posti.B0 && posti.B0.boss ? posti.B0.personaggio : null,
            field: g.ArenaOptions.risolviCampo(scelta.field || R),
            music: g.ArenaOptions.risolviTraccia(scelta.music || R)
        };
        net.sendAction({ kind: 'tag-sala', tipo: 'via', partenza });
        if (net.lockRoom) net.lockRoom();
        parti(partenza);
    }

    /** Su ogni client: la disposizione diventa il passo comune a posti, poi l'arena. */
    function parti(partenza) {
        if (avviata) return;
        avviata = true;
        const mio = Object.keys(partenza.posti).find((k) => partenza.posti[k].tipo === 'persona' && partenza.posti[k].client === io);
        if (!mio) { status('❌ La partita è partita senza di te: non avevi un posto.', true); return; }
        const i = interna();
        if (i.segnaAvviato) i.segnaAvviato();
        if (i.fermaAnteprima) i.fermaAnteprima();
        const miaSquadra = mio.charAt(0);
        g.MP_TAG = partenza;
        g.MP_MIO_POSTO = mio;
        if (g.MpPassoComune) MpPassoComune.configuraPosti({ mioClient: io, miaSquadra, host: partenza.host, iniziaSquadra: partenza.iniziaSquadra, posti: partenza.posti });
        g.MP_broadcast = (azione) => {
            if (!azione || azione.kind !== 'game-over') return;
            // L'esito per squadra: lo stesso messaggio vale per compagni e avversari (vedi js/multiplayer/multiplayer.js).
            const hoVinto = azione.opponentWon === 'draw' ? 'draw' : !azione.opponentWon;
            const altra = miaSquadra === 'A' ? 'B' : 'A';
            net.sendAction(Object.assign({}, azione, { vinceSquadra: hoVinto === 'draw' ? 'draw' : (hoVinto ? miaSquadra : altra) }));
        };
        const config = { field: partenza.field, music: partenza.music };
        if (i.contoAllaRovescia) {
            i.contoAllaRovescia(config, () => avviaArena(config));
        } else {
            avviaArena(config);
        }
    }

    async function avviaArena(config) {
        const i = interna();
        if (g.PageLoader) PageLoader.show();
        g.MULTIPLAYER_MODE = true;
        if (i.applicaImpostazioniArena) i.applicaImpostazioniArena(config);
        const sala = $('mpLobbyScreen');
        if (sala) sala.remove();
        if (i.loadDuelArena) await i.loadDuelArena();
    }

    // ------------------------------------------------------------------
    // Ingresso nella sala
    // ------------------------------------------------------------------

    function entra(msg) {
        if (attiva) return;
        attiva = true;
        codice = msg.code || codice;
        if (msg.tu) io = msg.tu;
        const i = interna();
        if (i.mostraSchermata) i.mostraSchermata('tag');
        mostraCodice();
        montaPersonali();
        status(sonoHost() ? '🕐 Condividi il codice: chi entra si siede in un posto libero.' : '🪑 Scegli un posto libero e conferma quando sei pronto.');
        if (i.precaricaArena) i.precaricaArena();
    }

    function mostraCodice() {
        const tiles = $('mpTagCodice');
        if (!tiles) return;
        tiles.innerHTML = '';
        codice.split('').forEach((ch, i) => {
            const t = document.createElement('span');
            t.className = 'mp-code-tile';
            t.textContent = ch;
            t.style.animationDelay = (i * 70) + 'ms';
            tiles.appendChild(t);
        });
        const testo = $('mpTagCodiceTesto');
        if (testo) testo.textContent = codice;
        const copia = $('mpTagCopia');
        if (copia) copia.onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(codice).then(() => status('✅ Codice copiato negli appunti!')); };
    }

    /** Pedina, mazzo, arena e musica: gli stessi componenti della sala 1 contro 1. */
    function montaPersonali() {
        if (g.MpPedina && $('mpTagPedina')) {
            MpPedina.monta($('mpTagPedina'), { onChange: () => annunciaIo() });
        }
        if (g.DuelSetup && $('mpTagMazzi') && !setupMazzi) {
            setupMazzi = g.DuelSetup.mount($('mpTagMazzi'), { decks: true, arena: false, deckLabel: false, onDeckChange: (m) => status(`🃏 Duellerai con "${m.name}".`) });
            setupMazzi.refresh();
        }
        if (g.DuelSetup && $('mpTagArena') && !setupArena) {
            setupArena = g.DuelSetup.mount($('mpTagArena'), {
                readOnly: !sonoHost(),
                initial: { field: g.ArenaOptions.RANDOM, music: g.ArenaOptions.RANDOM, origin: 'all' },
                onChange: (sel) => {
                    scelta.field = sel.field;
                    scelta.music = sel.music;
                    if (sonoHost() && stato) { stato.campo = sel.field; stato.musica = sel.music; togliPronti(); pubblica(); }
                },
                onPreviewBlocked: () => status('🔇 Il browser ha bloccato l\'anteprima: tocca lo schermo e riprova.', true)
            });
        }
    }

    function annunciaIo() {
        if (!io) return;
        if (sonoHost()) {
            if (stato) { allineaAiPresenti(); pubblica(); }
            return;
        }
        net.sendAction({ kind: 'tag-sala', tipo: 'io', nome: mioNome(), pedina: g.MpPedina ? MpPedina.scelta().id : 'player', pronto: mioPronto });
    }

    // ------------------------------------------------------------------
    // Disegno
    // ------------------------------------------------------------------

    function el(tag, classe, testo) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (testo != null) e.textContent = testo;
        return e;
    }

    function bottone(testo, onClick, classe) {
        const b = el('button', classe || 'tg-btn', testo);
        /** @type {HTMLButtonElement} */ (b).type = 'button';
        b.onclick = onClick;
        return b;
    }

    function selettore(opzioni, valore, onChange, etichetta) {
        const s = /** @type {HTMLSelectElement} */ (el('select', 'tg-select'));
        s.setAttribute('aria-label', etichetta);
        opzioni.forEach(([v, t]) => { const o = /** @type {HTMLOptionElement} */ (el('option', null, t)); o.value = v; s.appendChild(o); });
        s.value = valore;
        s.disabled = !sonoHost();
        s.onchange = () => onChange(s.value);
        return s;
    }

    function collegato(id) { const p = presenti.find((x) => x.id === id); return !!(p && p.collegato); }

    function cartaPosto(k) {
        const chi = stato.posti[k];
        const box = el('div', 'tg-posto' + (chi ? ' is-occupato' : ' is-libero') + (chi === io ? ' is-mio' : '') + (spostando ? ' is-bersaglio' : ''));
        box.setAttribute('data-posto', k);
        const ritratto = el('div', 'tg-ritratto');
        const testi = el('div', 'tg-testi');
        if (chi) {
            const p = stato.persone[chi] || {};
            const pedina = g.MpPedina ? MpPedina.risolvi(p.pedina) : null;
            if (pedina) ritratto.style.backgroundImage = `url("${pedina.image}")`;
            testi.appendChild(el('strong', 'tg-nome', (p.nome || 'Giocatore') + (chi === io ? ' (tu)' : '')));
            const st = !collegato(chi) ? 'Connessione persa' : (p.pronto ? '✓ Pronto' : 'Sta scegliendo…');
            testi.appendChild(el('small', 'tg-stato' + (p.pronto ? ' is-pronto' : ''), (chi === host ? '👑 Host · ' : '') + st));
        } else {
            const bossQui = k === 'B0' && stato.formato === '2v1' && stato.boss;
            const idIA = bossQui ? stato.boss : stato.ia[k];
            const c = personaggio(idIA);
            if (c && c.image) ritratto.style.backgroundImage = `url("${c.image}")`;
            ritratto.classList.add('is-ia');
            testi.appendChild(el('strong', 'tg-nome', 'Posto libero'));
            testi.appendChild(el('small', 'tg-stato', bossQui ? `Lo gioca il Boss: ${nomePersonaggio(idIA)}` : `Lo gioca l'IA: ${nomePersonaggio(idIA)}`));
            if (sonoHost() && !bossQui) {
                testi.appendChild(selettore(duellantiIA().map((id) => [id, nomePersonaggio(id)]), stato.ia[k], (v) => { stato.ia[k] = v; togliPronti(); pubblica(); }, 'Duellante IA del posto ' + k));
            }
        }
        box.append(ritratto, testi);
        const azioni = el('div', 'tg-azioni');
        if (spostando && sonoHost()) {
            if (stato.posti[k] !== spostando) azioni.appendChild(bottone(chi ? '⇄ Scambia qui' : '⬇ Metti qui', () => {
                siedi(spostando, k);
                spostando = null;
                allineaAiPresenti();
                pubblica();
            }, 'tg-btn tg-btn--primario'));
        } else if (!chi && postoDi(io) !== k) {
            azioni.appendChild(bottone('🪑 Siediti qui', () => chiediPosto(k), 'tg-btn tg-btn--primario'));
        } else if (chi && sonoHost()) {
            azioni.appendChild(bottone('⇄ Sposta', () => { spostando = chi; disegna(); }));
        }
        if (azioni.childNodes.length) box.appendChild(azioni);
        return box;
    }

    function chiediPosto(k) {
        if (sonoHost()) { siedi(io, k); allineaAiPresenti(); pubblica(); return; }
        mioPronto = false;
        net.sendAction({ kind: 'tag-sala', tipo: 'siedi', posto: k });
    }

    function disegna() {
        const radice = $('mpTagSala');
        if (!radice) return;
        if (!stato) { radice.textContent = 'In attesa della sala dell\'host…'; return; }
        radice.innerHTML = '';
        const f = FORMATI[stato.formato];
        radice.appendChild(el('p', 'tg-formato-attivo', `${f.nome} · ${presenti.length}/${f.capienza} nella stanza`));
        const squadre = el('div', 'tg-squadre');
        ['A', 'B'].forEach((sq, i) => {
            if (i === 1) squadre.appendChild(el('div', 'tg-vs', 'VS'));
            const col = el('section', 'tg-squadra tg-squadra--' + sq);
            col.appendChild(el('h3', 'tg-squadra-nome', NOMI_SQUADRA[sq]));
            f.posti.filter((k) => k.charAt(0) === sq).forEach((k) => col.appendChild(cartaPosto(k)));
            squadre.appendChild(col);
        });
        radice.appendChild(squadre);
        if (spostando && sonoHost()) {
            const p = stato.persone[spostando] || {};
            const riga = el('p', 'tg-nota', `Dove metti ${p.nome || 'questo giocatore'}? Tocca un posto. `);
            riga.appendChild(bottone('Annulla', () => { spostando = null; disegna(); }));
            radice.appendChild(riga);
        }
        const inPiedi = presenti.filter((p) => !postoDi(p.id));
        if (inPiedi.length) {
            const riga = el('div', 'tg-inpiedi');
            riga.appendChild(el('span', 'tg-inpiedi-titolo', 'In piedi:'));
            inPiedi.forEach((p) => {
                const d = stato.persone[p.id] || {};
                const chip = el('span', 'tg-chip', (d.nome || 'Giocatore') + (p.id === io ? ' (tu)' : ''));
                if (sonoHost() && p.id !== io) chip.appendChild(bottone('⇄', () => { spostando = p.id; disegna(); }, 'tg-btn tg-btn--mini'));
                riga.appendChild(chip);
            });
            radice.appendChild(riga);
        }
        radice.appendChild(regole());
        aggiornaPronto();
        if (setupArena && setupArena.setReadOnly) setupArena.setReadOnly(!sonoHost());
        if (!sonoHost() && setupArena && setupArena.showSelection && stato.campo) setupArena.showSelection({ field: stato.campo, music: stato.musica });
    }

    function regole() {
        const box = el('div', 'tg-regole');
        box.appendChild(el('div', 'tg-regole-titolo', sonoHost() ? 'Regole (le scegli tu, valgono per tutti)' : 'Regole (le sceglie l\'host)'));
        const riga = (etichetta, controllo) => { const r = el('label', 'tg-regola'); r.appendChild(el('span', null, etichetta)); r.appendChild(controllo); box.appendChild(r); };
        riga('Life Point', selettore([['membro', 'A testa'], ['lato', 'Condivisi dalla squadra']], stato.regolaLp, (v) => { stato.regolaLp = v; togliPronti(); pubblica(); }, 'Life Point'));
        riga('Turni nella squadra', selettore([['obbligato', 'A turno'], ['libero', 'A turno, scambio su richiesta']], stato.scambio, (v) => { stato.scambio = v; togliPronti(); pubblica(); }, 'Turni nella squadra'));
        riga('Livello dell\'IA', selettore(LIVELLI, stato.livelloIA, (v) => { stato.livelloIA = v; togliPronti(); pubblica(); }, 'Livello dell\'IA'));
        if (stato.formato === '2v1') {
            const boss = [['', 'Nessun Boss']].concat(bossDisponibili().map((b) => [b.id, 'Boss: ' + nomePersonaggio(b.id)]));
            riga('Duellante solo', selettore(boss, stato.boss || '', (v) => { stato.boss = v || null; togliPronti(); pubblica(); }, 'Boss'));
            if (stato.boss) box.appendChild(el('small', 'tg-nota', `Il Boss gioca il posto libero della Squadra Ombra con ${typeof tagDatabase !== 'undefined' ? tagDatabase.lpBoss : 12000} Life Point e il mazzo Difficile.`));
        }
        return box;
    }

    function aggiornaPronto() {
        const btn = /** @type {HTMLButtonElement | null} */ ($('mpTagPronto'));
        const nota = $('mpTagProntoNota');
        if (!stato) return;
        const seduto = !!postoDi(io);
        const mio = stato.persone[io];
        mioPronto = !!(mio && mio.pronto);
        if (btn) {
            btn.disabled = !seduto || avviata;
            btn.classList.toggle('is-pronto', mioPronto);
            btn.textContent = mioPronto ? '✓ Sei pronto' : 'Sono pronto';
        }
        if (nota) {
            const mancano = presenti.filter((p) => !postoDi(p.id) || !(stato.persone[p.id] && stato.persone[p.id].pronto)).length;
            nota.textContent = !seduto ? 'Siediti in un posto per poter confermare.'
                : presenti.length < 2 ? 'Aspetta che entri almeno un altro giocatore.'
                    : mancano ? `Si parte quando tutti sono seduti e pronti (ne mancano ${mancano}).` : 'Si parte!';
        }
    }

    // ------------------------------------------------------------------
    // Rete
    // ------------------------------------------------------------------

    net.on('room-created', (msg) => {
        if (!richiestaInCorso) return;
        richiestaInCorso = false;
        if (!(msg.capienza > 2)) {
            // Relay vecchio: la stanza è da 2, il Tag Team in rete non si può giocare.
            status('❌ Il server non sa ancora gestire stanze da più di due giocatori: il Tag Team in rete arriva con il prossimo aggiornamento del server.', true);
            net.leaveRoom();
            const crea = $('mpCreateBtn');
            if (crea) /** @type {HTMLButtonElement} */ (crea).disabled = false;
            return;
        }
        io = msg.tu || null;
        host = io;
        stato = statoIniziale(formatoScelto);
        entra(msg);
        allineaAiPresenti();
        disegna();
    });

    net.on('room-update', (msg) => {
        if (avviata) return;
        if (!attiva) entra(msg);
        io = msg.tu || io;
        const eraHost = sonoHost();
        host = msg.host;
        presenti = Array.isArray(msg.giocatori) ? msg.giocatori : [];
        if (sonoHost()) {
            // Host da sempre, o appena diventato (il precedente è uscito): continua dallo stato che ha.
            if (!stato) stato = statoIniziale(FORMATI['2v1'].capienza === msg.capienza ? '2v1' : '2v2');
            if (!eraHost) { togliPronti(); status('👑 L\'host è uscito: ora la sala la gestisci tu.'); }
            allineaAiPresenti();
            pubblica();
        } else {
            annunciaIo();
            disegna();
        }
    });

    net.on('game-action', (msg) => {
        const a = msg && msg.action;
        if (!a || a.kind !== 'tag-sala' || avviata) return;
        if (g.ProtocolloMP) {
            const motivo = ProtocolloMP.motivoRifiuto(a);
            if (motivo) { console.warn('Tag Team: messaggio scartato (' + motivo + ')'); return; }
        }
        const da = msg.da;
        if (a.tipo === 'stato' && da === host && !sonoHost()) { stato = a.stato; disegna(); return; }
        if (a.tipo === 'via' && da === host) { parti(a.partenza); return; }
        if (a.tipo === 'io') { riceviIo(da, a); return; }
        if (a.tipo === 'siedi' && sonoHost() && stato) {
            if (stato.posti[a.posto] !== null) { pubblica(); return; } // occupato: lo stato attuale glielo dice
            siedi(da, a.posto);
            pubblica();
        }
    });

    net.on('opponent-disconnected', () => { if (attiva && !avviata) disegna(); });
    net.on('opponent-left', () => { if (attiva && !avviata) status('👋 Un giocatore ha lasciato la stanza.'); });
    net.on('error', (m) => { if (attiva && !avviata && /cominciata/.test((m && m.message) || '')) status('❌ ' + m.message, true); });

    (function collegaPronto() {
        const btn = $('mpTagPronto');
        if (!btn) return;
        btn.onclick = () => {
            if (avviata || !postoDi(io)) return;
            mioPronto = !mioPronto;
            if (g.NativeHaptics) g.NativeHaptics.light();
            if (sonoHost()) { allineaAiPresenti(); pubblica(); }
            else { net.sendAction({ kind: 'tag-sala', tipo: 'io', nome: mioNome(), pedina: g.MpPedina ? MpPedina.scelta().id : 'player', pronto: mioPronto }); aggiornaPronto(); }
        };
    })();

    montaSceltaFormato();

    g.MpTagSala = {
        capienzaRichiesta,
        /** Vero se la prossima 'room-created' è una stanza del Tag Team (mp-lobby.js la lascia a questa sala). */
        aspettaStanza: () => richiestaInCorso,
        /** Per i test: lo stato della sala e chi sono. */
        _stato: () => ({ io, host, presenti, stato, avviata })
    };
})();
