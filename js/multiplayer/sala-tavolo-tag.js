/**
 * sala-tavolo-tag.js — la sala a tavolo (sala-tavolo.js) montata sulla sala del Tag Team in rete (mp-tag-sala.js).
 * ----------------------------------------------------------------------------------------------------------------
 * Come sala-tavolo-1v1.js: NON tocca rete ne' regole. Legge la sala di sempre (`MpTagSala.fotografia()`), la disegna a tavolo e
 * traduce i gesti nelle funzioni che la sala di sempre ha gia' (`MpTagSala.azioni`). I messaggi `tag-sala` sono quelli di prima.
 *
 * Qui il posto si SCEGLIE davvero: chi entra comincia in piedi (il suo token sta al centro del tavolo) e tocca uno slot libero. L'host
 * puo' sempre intervenire: tocca una persona in piedi e poi il posto dove metterla (se e' occupato si scambiano), alza o scambia chi e'
 * seduto, cambia il duellante che giochera' l'IA in un posto lasciato libero.
 *
 * E' la sala di serie, come quella a due (vedi SalaTavolo.acceso).
 */
(function () {
    'use strict';

    const sala = window.MpTagSala;
    if (!sala || !sala.suCambio || !window.SalaTavolo) return;
    if (!window.SalaTavolo.acceso()) return;

    const AO = window.ArenaOptions;
    const personaggio = (id) => (typeof characterDatabase !== 'undefined' ? characterDatabase : []).find((c) => c.id === id) || null;
    const LP = [['membro', 'A testa'], ['lato', 'Condivisi dalla squadra']];
    const TURNI = [['obbligato', 'A turno'], ['libero', 'A turno, scambio su richiesta']];
    const LIVELLI = [['easy', 'Facile'], ['medium', 'Normale'], ['hard', 'Difficile']];
    const NESSUN_BOSS = 'Nessun Boss';
    let vista = null;
    let schermata = null;

    const etichetta = (tabella, valore) => (tabella.find(([v]) => v === valore) || [valore, valore])[1];
    const valoreDa = (tabella, testo) => (tabella.find(([, t]) => t === testo) || [null])[0];

    function pedinaDi(idPedina) {
        const p = window.MpPedina ? MpPedina.risolvi(idPedina) : null;
        return p ? p.image : '';
    }

    /** Finestra per scegliere quale Duellante IA gioca un posto lasciato libero (tocco su una scheda). */
    function scegliIA(posto, f) {
        if (!window.MpScelte) return;
        const corpo = document.createElement('div');
        corpo.className = 'st-picker-ia';
        f.duellantiIA.forEach((d) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'st-picker-ia-voce' + (f.ia[posto] === d.id ? ' is-scelto' : '');
            const img = document.createElement('span');
            img.className = 'st-picker-ia-img';
            if (d.image) img.style.backgroundImage = `url("${typeof window.getCharacterPawnImage === 'function' ? window.getCharacterPawnImage(d.image) : d.image}")`;
            const nome = document.createElement('b');
            nome.textContent = d.nome;
            b.append(img, nome);
            b.onclick = () => { sala.azioni.scegliIA(posto, d.id); MpScelte.chiudi(); };
            corpo.append(b);
        });
        MpScelte.apri('Chi gioca questo posto se resta vuoto', corpo);
    }

    function monta() {
        if (vista) return;
        schermata = document.querySelector('[data-vista="tag"] .mp-screen');
        if (!schermata) return;
        const radice = document.createElement('div');
        radice.className = 'mp-tavolo-radice';
        schermata.appendChild(radice);
        schermata.classList.add('mp-tavolo-attivo');
        vista = window.SalaTavolo.monta(radice, {});
        // Cosa paga una vittoria con la composizione corrente: il riquadro di sempre (lo riempie Rewards) passa sotto le regole del tavolo.
        const premi = document.getElementById('mpTagPremi');
        const fascia = radice.querySelector('.st-regole');
        if (premi) radice.appendChild(premi);   // i premi sono l'ultima cosa, sotto tutto

        const az = sala.azioni;
        vista.su('prendi-posto', (k) => az.prendiPosto(k));
        vista.su('lascia-posto', () => az.alzati());
        vista.su('pronto', () => az.pronto());
        vista.su('personale', (chiave) => { if (chiave === 'duellante') az.apriPedina(); else if (chiave === 'mazzo') az.apriMazzo(); });
        vista.su('in-piedi', (id) => az.scegliAssegna(id));
        vista.su('assegna-posto', (k) => { const f = sala.fotografia(); if (f && f.assegna) az.assegna(f.assegna, k); });
        vista.su('azione-host', ({ tipo, posto }) => {
            const f = sala.fotografia();
            if (!f) return;
            if (tipo === 'sposta-al-centro') az.alzaPersona(posto);
            else if (tipo === 'scambia') az.scambiaConMe(posto);
            else if (tipo === 'cambia-ia') scegliIA(posto, f);
        });
        vista.su('regola', ({ chiave, valore, apri }) => {
            if (chiave === 'arena' && apri) az.apriArena();
            else if (chiave === 'regolaLp') az.impostaRegola('regolaLp', valoreDa(LP, valore));
            else if (chiave === 'scambio') az.impostaRegola('scambio', valoreDa(TURNI, valore));
            else if (chiave === 'livelloIA') az.impostaRegola('livelloIA', valoreDa(LIVELLI, valore));
            else if (chiave === 'boss') {
                const f = sala.fotografia();
                const b = f && f.bossDisponibili.find((x) => x.nome === valore);
                az.impostaRegola('boss', b ? b.id : '');
            }
        });
    }

    function costruisci(f) {
        const miePosto = Object.keys(f.posti).find((k) => f.posti[k] === f.io) || null;
        const io = { id: f.io, nome: f.nomeMio || 'Tu', pedina: f.pedinaMia ? f.pedinaMia.image : '' };
        const slot = {};
        f.postiDelFormato.forEach((k) => {
            const chi = f.posti[k];
            if (chi) {
                const p = f.persone[chi] || {};
                const connesso = f.collegati[chi] !== false;
                slot[k] = { tipo: 'persona', id: chi, nome: p.nome || 'Giocatore', pedina: pedinaDi(p.pedina), pronto: !!p.pronto,
                    sotto: !connesso ? 'Connessione persa' : ((chi === f.host ? 'Host · ' : '') + (p.pronto ? 'Pronto' : 'Sta scegliendo…')) };
            } else {
                const bossQui = k === 'B0' && f.formato === '2v1' && f.boss;
                const c = personaggio(bossQui ? f.boss : f.ia[k]);
                const nomeIA = c ? c.name : 'IA';
                slot[k] = {
                    tipo: 'libero', daIA: true, pedina: c ? c.image : '',
                    nome: bossQui ? `Boss: ${nomeIA}` : 'Posto libero',
                    sotto: bossQui ? 'Lo gioca il Boss' : `Se resta vuoto: ${nomeIA} (IA)`,
                    voci: f.sonoHost && !bossQui ? [['Cambia duellante IA', 'cambia-ia']] : undefined
                };
            }
        });
        const squadra = (sq) => ({ nome: f.nomiSquadra[sq], posti: f.postiDelFormato.filter((k) => k.charAt(0) === sq) });

        const inPiedi = f.presenti.filter((p) => !Object.keys(f.posti).some((k) => f.posti[k] === p.id)).map((p) => {
            const d = f.persone[p.id] || {};
            return { id: p.id, nome: d.nome || 'Giocatore', pedina: pedinaDi(d.pedina), io: p.id === f.io };
        });

        const regole = [
            { chiave: 'regolaLp', etichetta: 'Life Point', aiuto: f.regolaLp === 'lato' ? 'La squadra ha un solo totale di Life Point.' : 'Ogni giocatore ha i suoi Life Point.', valore: etichetta(LP, f.regolaLp), opzioni: LP.map((x) => x[1]), modificabile: true },
            { chiave: 'scambio', etichetta: 'Turni nella squadra', aiuto: f.scambio === 'libero' ? 'I compagni si alternano e possono chiedere lo scambio.' : 'I compagni si alternano a ogni turno.', valore: etichetta(TURNI, f.scambio), opzioni: TURNI.map((x) => x[1]), modificabile: true },
            { chiave: 'livelloIA', etichetta: 'Livello IA', aiuto: 'Vale per i posti lasciati liberi.', valore: etichetta(LIVELLI, f.livelloIA), opzioni: LIVELLI.map((x) => x[1]), modificabile: true }
        ];
        if (f.formato === '2v1') {
            const attuale = f.bossDisponibili.find((b) => b.id === f.boss);
            regole.push({ chiave: 'boss', etichetta: 'Duellante solo', aiuto: 'Un Boss al posto dell\'avversario singolo.', valore: attuale ? 'Boss: ' + attuale.nome : NESSUN_BOSS, opzioni: [NESSUN_BOSS].concat(f.bossDisponibili.map((b) => b.nome)), modificabile: true });
        }
        const random = AO ? AO.RANDOM : 'random';
        const haCampo = AO && f.campo && f.campo !== random;
        regole.push({ chiave: 'arena', etichetta: 'Arena e musica', aiuto: 'Valgono per tutti i giocatori.', valore: haCampo ? AO.nomeCampo(f.campo) : 'Arena casuale', img: haCampo ? AO.previewFor(f.campo) : '', apri: true, modificabile: true });

        const mazzo = f.mazzo;
        const nCarte = mazzo ? (mazzo.main || []).reduce((t, v) => t + (v.qty || 1), 0) : 0;
        const seduti = Object.keys(f.posti).filter((k) => f.posti[k]).length;
        const prontoDi = (id) => Object.keys(f.posti).some((k) => f.posti[k] === id) && !!(f.persone[id] && f.persone[id].pronto);
        const nonPronti = f.presenti.filter((p) => !prontoDi(p.id)).length;
        let messaggio;
        if (f.assegna) { const d = f.persone[f.assegna] || {}; messaggio = `Dove metti ${d.nome || 'questo giocatore'}? Tocca un posto.`; }
        else if (!miePosto) messaggio = 'Scegli un posto: tocca uno slot libero.';
        else if (f.presenti.length < 2) messaggio = 'Condividi il codice: serve almeno un altro giocatore.';
        else if (nonPronti) messaggio = `Si parte quando tutti sono seduti e pronti (ne mancano ${nonPronti}).`;
        else messaggio = 'Si parte!';

        return {
            squadre: { A: squadra('A'), B: squadra('B') }, slot, io, ioPosto: miePosto, host: f.sonoHost, consentiIA: false,
            puoiAlzarsi: f.sonoHost ? undefined : false, nascondiEspelli: true,
            inPiedi, assegna: f.assegna || null, regole,
            personali: [
                { chiave: 'duellante', titolo: 'Il tuo duellante', valore: f.pedinaMia ? f.pedinaMia.name : 'Duellante', dettaglio: 'Lo vedono tutti', pedina: io.pedina },
                { chiave: 'mazzo', titolo: 'Il tuo mazzo', valore: mazzo ? mazzo.name : 'Mazzo generato al momento', dettaglio: mazzo ? `${nCarte} carte · lo scegli solo per te` : 'Non hai ancora un mazzo tuo', icona: 'cards' }
            ],
            codice: f.codice, pronto: !!f.mioPronto, prontoBloccato: f.avviata || seduti === 0,
            messaggio, sagoma: 'images/characters/pedine/mirror.png',
            arenaImg: haCampo ? AO.previewFor(f.campo) : ''
        };
    }

    function aggiorna() {
        const f = sala.fotografia();
        if (!f) return;
        monta();
        if (vista) vista.imposta(costruisci(f));
    }

    sala.suCambio(aggiorna);
})();
