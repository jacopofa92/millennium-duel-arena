/**
 * sala-tavolo-1v1.js — la sala a tavolo (sala-tavolo.js) montata sulla sala a due posti: Duello, Duello a specchio, Assalto al Boss.
 * -----------------------------------------------------------------------------------------------------------------------------
 * NON tocca la rete ne' le regole: la logica resta tutta in mp-lobby.js. Questo file fa due cose sole:
 *   1) legge la sala di sempre (`MpSalaInterna.fotografia()`, avvisato da `suCambio`) e ne ricava lo stato da disegnare;
 *   2) traduce i gesti del tavolo (pronto, scelte, regole) nei controlli che la sala di sempre ha gia' — che restano nel
 *      documento, nascosti ma vivi — attraverso `MpSalaInterna.azioni`.
 * Cosi' i protocolli, i test e il comportamento sono quelli di prima, e solo il disegno cambia.
 *
 * E' la sala di serie. Nessun parametro nell'indirizzo: solo i test che guardano la sala vecchia la spengono (`window.SALA_CLASSICA`).
 *
 * Posti: i due ruoli li decide il server, quindi qui sono FISSI (`postoFisso`): l'host sta in A0, lo sfidante in B0 (nel Raid in A1,
 * accanto all'host, contro il Boss in B0). Un posto da scegliere vale solo dove i posti sono davvero liberi: nel Tag (mp-tag-sala).
 */
(function () {
    'use strict';

    const interna = window.MpSalaInterna;
    if (!interna || !interna.suCambio || !window.SalaTavolo) return;

    if (!window.SalaTavolo.acceso()) return;

    const AO = window.ArenaOptions;
    const SAGOMA = 'images/characters/pedine/mirror.png';
    let vista = null;
    let schermata = null;

    const personaggio = (id) => (typeof characterDatabase !== 'undefined' ? characterDatabase : []).find((c) => c.id === id) || null;

    function monta() {
        if (vista) return;
        schermata = document.querySelector('[data-vista="attesa"] .mp-screen');
        if (!schermata) return;
        const radice = document.createElement('div');
        radice.className = 'mp-tavolo-radice';
        schermata.appendChild(radice);
        schermata.classList.add('mp-tavolo-attivo');
        vista = window.SalaTavolo.monta(radice, {});
        // Cosa paga una vittoria con la scelta corrente: il riquadro di sempre (lo riempie Rewards) passa sotto le regole del tavolo.
        const premi = document.getElementById('mpPremiSala');
        const fascia = radice.querySelector('.st-regole');
        if (premi && fascia) fascia.insertAdjacentElement('afterend', premi);

        const az = interna.azioni;
        vista.su('pronto', () => az.pronto());
        vista.su('personale', (chiave) => {
            const f = interna.fotografia();
            if (chiave === 'duellante') az.apriPedina();
            else if (chiave === 'mazzo' && f && f.modo !== 'specchio') az.apriMazzo();
        });
        vista.su('regola', ({ chiave, valore, apri }) => {
            if (chiave === 'arena' && apri) az.apriArena();
            else if (chiave === 'boss' && apri) az.apriBoss();
            else if (chiave === 'incubo') az.impostaIncubo(valore === 'Incubo');
            else if (chiave === 'specchio') {
                const f = interna.fotografia();
                const scelto = f && f.specchioOpzioni.find((o) => o.nome === valore);
                az.impostaSpecchio(scelto ? scelto.id : az.casuale);
            }
        });
    }

    /** Il messaggio sotto il tavolo: dice cosa manca, nella lingua di questa sala. */
    function messaggio(f) {
        if (f.avviato) return 'Si parte!';
        if (!f.avversarioInStanza) return 'Condividi il codice: la stanza si apre quando entra qualcuno.';
        if (!f.avversarioCollegato) return 'L\'avversario ha perso la connessione: si aspetta che torni…';
        if (f.sonoPronto && !f.avversarioPronto) return 'Aspetto che anche l\'altro giocatore sia pronto.';
        if (!f.sonoPronto && f.avversarioPronto) return 'L\'altro giocatore e\' pronto: tocca a te.';
        return 'Si parte quando siete pronti tutti e due.';
    }

    function costruisci(f) {
        const raid = f.modo === 'raid';
        const io = { id: 'io', nome: f.nomeMio || 'Tu', pedina: f.pedinaMia ? f.pedinaMia.image : '' };
        const mioPosto = f.sonoHost ? 'A0' : (raid ? 'A1' : 'B0');
        const altroPosto = f.sonoHost ? (raid ? 'A1' : 'B0') : 'A0';

        const slot = {};
        slot[mioPosto] = { tipo: 'persona', id: 'io', nome: io.nome, pedina: io.pedina, pronto: f.sonoPronto };
        if (f.avversarioInStanza) {
            const p = f.pedinaAvversario;
            slot[altroPosto] = { tipo: 'persona', id: 'altro', nome: f.nomeAvversario || 'Avversario', pedina: p ? p.image : '', pronto: f.avversarioPronto,
                sotto: f.avversarioCollegato ? undefined : 'Connessione persa' };
        } else {
            slot[altroPosto] = { tipo: 'libero', nome: raid ? 'Compagno' : 'Avversario', sotto: 'In attesa di un giocatore…' };
        }
        let squadre;
        if (raid) {
            const bossC = f.boss ? personaggio(f.boss.id) : null;
            slot.B0 = { tipo: 'boss', nome: f.boss ? f.boss.nome : 'Boss da scegliere', pedina: bossC ? bossC.image : '' };
            squadre = { A: { nome: 'Cacciatori', posti: ['A0', 'A1'] }, B: { nome: 'Il Boss', posti: ['B0'] } };
        } else {
            squadre = { A: { nome: 'Padrone di casa', posti: ['A0'] }, B: { nome: 'Sfidante', posti: ['B0'] } };
        }

        const regole = [];
        if (f.modo === 'specchio') {
            const nomi = ['Un mazzo a caso'].concat(f.specchioOpzioni.map((o) => o.nome));
            regole.push({ chiave: 'specchio', etichetta: 'Mazzo comune', valore: f.specchioNome || 'Un mazzo a caso', opzioni: nomi, modificabile: true });
        }
        if (raid && f.boss) {
            const bossC = personaggio(f.boss.id);
            regole.push({ chiave: 'boss', etichetta: 'Boss', valore: f.boss.nome, apri: true, modificabile: true, img: bossC ? bossC.image : '' });
            regole.push({ chiave: 'incubo', etichetta: 'Livello', valore: f.incubo ? 'Incubo' : 'Normale', opzioni: ['Normale', 'Incubo'], modificabile: true });
        }
        const random = AO ? AO.RANDOM : 'random';
        const haCampo = AO && f.field && f.field !== random;
        regole.push({ chiave: 'arena', etichetta: 'Arena e musica', valore: haCampo ? AO.nomeCampo(f.field) : 'Arena casuale', img: haCampo ? AO.previewFor(f.field) : '', apri: true, modificabile: true });

        const mazzo = f.mazzo;
        const nCarte = mazzo ? (mazzo.main || []).reduce((t, v) => t + (v.qty || 1), 0) : 0;
        const personali = [{ chiave: 'duellante', titolo: 'Il tuo duellante', valore: f.pedinaMia ? f.pedinaMia.name : 'Duellante', dettaglio: 'Lo vede anche l\'altro giocatore', pedina: io.pedina }];
        if (f.modo === 'specchio') personali.push({ chiave: 'mazzo', titolo: 'Il tuo mazzo', valore: 'Si gioca il mazzo comune', dettaglio: 'Lo decide l\'host', icona: 'cards' });
        else personali.push({ chiave: 'mazzo', titolo: 'Il tuo mazzo', valore: mazzo ? mazzo.name : 'Mazzo generato al momento', dettaglio: mazzo ? `${nCarte} carte · lo scegli solo per te` : 'Non hai ancora un mazzo tuo', icona: 'cards' });

        return {
            squadre, slot, io, ioPosto: mioPosto, host: f.sonoHost, consentiIA: false, postoFisso: true,
            regole, personali, codice: f.codice, pronto: f.sonoPronto, prontoBloccato: !f.avversarioInStanza || f.avviato,
            messaggio: messaggio(f), sagoma: SAGOMA,
            arenaImg: haCampo ? AO.previewFor(f.field) : ''
        };
    }

    function aggiorna() {
        const f = interna.fotografia();
        if (!f) return;
        monta();
        if (vista) vista.imposta(costruisci(f));
    }

    interna.suCambio(aggiorna);
})();
