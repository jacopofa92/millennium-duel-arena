/**
 * recupero-copia.js — "Recupera le modifiche non sincronizzate".
 * =====================================================================
 * Quando due dispositivi giocano sullo stesso account e uno è rimasto
 * indietro, il cloud vince (CloudSync.risolviConflittoCloud) e le modifiche
 * fatte sul dispositivo rimasto indietro restano in una copia di sicurezza
 * (CloudSync.copiaDivergente). Questo componente la rende raggiungibile:
 * un pulsante nel Profilo (visibile SOLO se la copia esiste) che apre un
 * riquadro con la differenza fra il salvataggio di adesso e la copia, e
 * lascia scegliere se ripristinarla o scartarla.
 *
 * Condiviso da profilo.html e dalla vista Profilo di index.html (stesso
 * principio di profile-stats.js: mai due copie da tenere allineate).
 * Uso: RecuperoCopia.monta(<elemento contenitore>) — ogni chiamata ridisegna
 * il contenitore (lo svuota se non c'è nessuna copia).
 *
 * Il ripristino è ANNULLABILE: il salvataggio di adesso prende il posto
 * della copia (vedi CloudSync.ripristinaCopiaDivergente), quindi ripristinare
 * una seconda volta riporta indietro. Per questo il testo del riquadro non
 * promette "perderai": spiega cosa succede davvero.
 */
(function () {
    'use strict';

    const fmtNum = new Intl.NumberFormat('it-IT');

    function fmtData(iso) {
        const d = new Date(iso);
        if (!iso || isNaN(d)) return 'data sconosciuta';
        return d.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    /** Le cifre che l'utente riconosce, lette dal salvataggio grezzo (mai dalle API, che per un amministratore mostrano valori fissi). */
    function riassunto(save) {
        if (!save) return null;
        const collezione = save.collection || {};
        const records = save.records || {};
        return {
            salvato: save.player && save.player.lastSaved,
            nome: (save.player && save.player.name) || '—',
            crediti: Number(save.currency && save.currency.credits) || 0,
            stelle: Number(save.currency && save.currency.starChips) || 0,
            carte: Object.keys(collezione).reduce((n, id) => n + (Number(collezione[id]) || 0), 0),
            carteDiverse: Object.keys(collezione).length,
            mazzi: Array.isArray(save.decks) ? save.decks.length : 0,
            vittorie: Object.keys(records).reduce((n, id) => n + (Number(records[id] && records[id].wins) || 0), 0)
        };
    }

    const RIGHE = [
        { chiave: 'crediti', etichetta: 'Crediti' },
        { chiave: 'stelle', etichetta: 'Stelle' },
        { chiave: 'carte', etichetta: 'Carte possedute' },
        { chiave: 'carteDiverse', etichetta: 'Carte diverse' },
        { chiave: 'mazzi', etichetta: 'Mazzi' },
        { chiave: 'vittorie', etichetta: 'Vittorie totali' }
    ];

    function el(tag, classe, testo) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (testo != null) e.textContent = testo;
        return e;
    }

    /** Il pulsante nel Profilo, o niente se non c'è una copia da recuperare. */
    function monta(contenitore) {
        if (!contenitore) return;
        contenitore.textContent = '';
        const copia = window.CloudSync && CloudSync.copiaDivergente ? CloudSync.copiaDivergente() : null;
        if (!copia || !copia.data) { contenitore.style.display = 'none'; return; }
        contenitore.style.display = '';
        contenitore.appendChild(el('div', 'rc-avviso', 'Su questo dispositivo ci sono modifiche che non sono arrivate sul cloud (conservate il ' + fmtData(copia.conservataIl) + ').'));
        const bottone = el('button', 'rc-apri', '🛟 Recupera le modifiche');
        bottone.type = 'button';
        bottone.addEventListener('click', () => apri(() => monta(contenitore)));
        contenitore.appendChild(bottone);
    }

    /** Il riquadro: spiegazione, confronto, azioni. `alCambio` ridisegna il pulsante dopo ripristino/scarto. */
    function apri(alCambio) {
        if (document.getElementById('recuperoCopia')) return;
        const copia = CloudSync.copiaDivergente();
        if (!copia || !copia.data) return;
        const adesso = riassunto(window.SaveManager && SaveManager.hasSave() ? SaveManager.load() : null);
        const conservata = riassunto(copia.data);

        const velo = el('div', 'rc-velo');
        velo.id = 'recuperoCopia';
        const box = el('div', 'rc-box');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-labelledby', 'rcTitolo');
        velo.appendChild(box);

        const testa = el('div', 'rc-testa');
        const titolo = el('h2', 'rc-titolo', 'Modifiche non sincronizzate');
        titolo.id = 'rcTitolo';
        const chiudi = el('button', 'rc-x', '✕');
        chiudi.type = 'button';
        chiudi.setAttribute('aria-label', 'Chiudi');
        testa.appendChild(titolo);
        testa.appendChild(chiudi);
        box.appendChild(testa);

        const corpo = el('div', 'rc-corpo');
        box.appendChild(corpo);

        corpo.appendChild(el('p', 'rc-testo', 'Hai giocato su questo dispositivo mentre il cloud veniva aggiornato da un altro. Per non perdere i progressi di quell\'altro dispositivo, qui è stata caricata la sua versione, e quello che avevi fatto qui è rimasto in una copia di sicurezza.'));
        corpo.appendChild(el('p', 'rc-testo', 'Qui sotto vedi la differenza. Se ripristini la copia, diventa il tuo salvataggio e viene caricata sul cloud al posto di quello attuale.'));

        // Il confronto: una tabella a tre colonne su schermo largo, a blocchi su telefono (CSS).
        const tabella = el('div', 'rc-tabella');
        tabella.setAttribute('role', 'table');
        const intestazione = el('div', 'rc-riga rc-riga--testa');
        intestazione.appendChild(el('span', 'rc-voce', ''));
        intestazione.appendChild(el('span', 'rc-col', 'Adesso'));
        intestazione.appendChild(el('span', 'rc-col', 'Copia conservata'));
        tabella.appendChild(intestazione);
        const quando = el('div', 'rc-riga rc-riga--data');
        quando.appendChild(el('span', 'rc-voce', 'Ultima modifica'));
        quando.appendChild(el('span', 'rc-col', adesso ? fmtData(adesso.salvato) : '—'));
        quando.appendChild(el('span', 'rc-col', conservata ? fmtData(conservata.salvato) : '—'));
        tabella.appendChild(quando);
        RIGHE.forEach((r) => {
            const a = adesso ? adesso[r.chiave] : 0;
            const c = conservata ? conservata[r.chiave] : 0;
            const riga = el('div', 'rc-riga' + (c > a ? ' rc-riga--piu' : c < a ? ' rc-riga--meno' : ''));
            riga.appendChild(el('span', 'rc-voce', r.etichetta));
            riga.appendChild(el('span', 'rc-col', fmtNum.format(a)));
            const col = el('span', 'rc-col', fmtNum.format(c));
            if (c !== a) col.appendChild(el('small', 'rc-delta', (c > a ? ' +' : ' −') + fmtNum.format(Math.abs(c - a))));
            riga.appendChild(col);
            tabella.appendChild(riga);
        });
        corpo.appendChild(tabella);
        corpo.appendChild(el('p', 'rc-nota', 'Il ripristino si può annullare: il salvataggio di adesso prende il posto della copia, e basta ripristinare di nuovo per tornare indietro.'));
        const esito = el('p', 'rc-esito');
        esito.setAttribute('role', 'status');
        corpo.appendChild(esito);

        const azioni = el('div', 'rc-azioni');
        const ripristina = el('button', 'rc-btn rc-btn--ok', 'Ripristina la copia');
        const scarta = el('button', 'rc-btn rc-btn--no', 'Scarta la copia');
        const annulla = el('button', 'rc-btn', 'Chiudi');
        [ripristina, scarta, annulla].forEach((b) => { b.type = 'button'; azioni.appendChild(b); });
        box.appendChild(azioni);

        document.body.appendChild(velo);
        document.body.classList.add('rc-aperto');

        const chiudiTutto = () => {
            document.removeEventListener('keydown', suTasto, true);
            document.body.classList.remove('rc-aperto');
            velo.remove();
            if (alCambio) alCambio();
        };
        const suTasto = (e) => { if (e.key === 'Escape') { e.stopPropagation(); chiudiTutto(); } };
        document.addEventListener('keydown', suTasto, true);
        chiudi.addEventListener('click', chiudiTutto);
        annulla.addEventListener('click', chiudiTutto);
        velo.addEventListener('pointerdown', (e) => { if (e.target === velo) chiudiTutto(); });

        // Due passaggi per le azioni che cambiano il salvataggio: il primo tocco
        // chiede conferma nel bottone stesso, il secondo esegue.
        function conDoppioTocco(bottone, testoConferma, esegui) {
            const originale = bottone.textContent;
            let armato = null;
            bottone.addEventListener('click', () => {
                if (!armato) {
                    bottone.textContent = testoConferma;
                    bottone.classList.add('rc-btn--conferma');
                    armato = setTimeout(() => { armato = null; bottone.textContent = originale; bottone.classList.remove('rc-btn--conferma'); }, 4000);
                    return;
                }
                clearTimeout(armato);
                armato = null;
                bottone.classList.remove('rc-btn--conferma');
                bottone.textContent = originale;
                esegui();
            });
        }

        conDoppioTocco(ripristina, 'Tocca ancora per confermare', () => {
            [ripristina, scarta].forEach((b) => { b.disabled = true; });
            esito.textContent = 'Ripristino in corso…';
            CloudSync.ripristinaCopiaDivergente()
                .then(() => {
                    // Il salvataggio ora è la copia: si carica sul cloud (la base di
                    // sincronizzazione è ancora quella dell'ultimo allineamento).
                    const carica = window.AutoSync && AutoSync.caricaOra ? AutoSync.caricaOra() : Promise.resolve();
                    return Promise.resolve(carica).catch(() => null);
                })
                .then(() => {
                    esito.textContent = '✅ Copia ripristinata. Il salvataggio di prima è stato conservato: se cambi idea puoi tornare indietro da qui.';
                    esito.classList.add('rc-esito--ok');
                    azioni.textContent = '';
                    const fine = el('button', 'rc-btn rc-btn--ok', 'Fatto');
                    fine.type = 'button';
                    // La pagina del Profilo mostra ancora i dati di prima: si ricarica.
                    fine.addEventListener('click', () => { window.location.reload(); });
                    azioni.appendChild(fine);
                })
                .catch((e) => {
                    esito.textContent = 'Non sono riuscito a ripristinare: ' + (e && e.message ? e.message : 'errore sconosciuto');
                    [ripristina, scarta].forEach((b) => { b.disabled = false; });
                });
        });

        conDoppioTocco(scarta, 'Tocca ancora: la copia sparisce', () => {
            CloudSync.scartaCopiaDivergente();
            chiudiTutto();
        });
    }

    window.RecuperoCopia = { monta, apri, riassunto };
})();
