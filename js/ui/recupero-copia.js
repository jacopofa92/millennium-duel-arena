/**
 * recupero-copia.js — "Recupera le modifiche" e "Importa un salvataggio".
 * =====================================================================
 * Due momenti in cui il salvataggio di questo dispositivo sta per essere
 * SOSTITUITO da un altro, e in cui l'utente deve vedere cosa succede prima
 * di scegliere:
 *
 *  1) RECUPERO (RecuperoCopia.monta/apri). Quando due dispositivi giocano
 *     sullo stesso account e uno è rimasto indietro, il cloud vince
 *     (CloudSync.risolviConflittoCloud) e le modifiche del dispositivo
 *     rimasto indietro restano in una copia di sicurezza
 *     (CloudSync.copiaDivergente). Un pulsante nel Profilo (visibile SOLO se
 *     la copia esiste) apre il confronto e lascia ripristinare o scartare.
 *
 *  2) IMPORTAZIONE (RecuperoCopia.importa). Scelto un file di backup NON lo
 *     si applica subito: si legge e si controlla (SaveManager.readFile), poi
 *     lo stesso confronto "adesso / file", con gli avvisi del caso (nome
 *     giocatore diverso, file più vecchio). Se si conferma, il salvataggio
 *     di adesso viene CONSERVATO come copia di sicurezza (si recupera dal
 *     pulsante del punto 1) e il file diventa il salvataggio.
 *
 * Condiviso da profilo.html e dalla vista Profilo di index.html (stesso
 * principio di profile-stats.js: mai due copie da tenere allineate).
 * Il ripristino/l'importazione si possono ANNULLARE: il salvataggio di prima
 * resta sempre da qualche parte, per questo i testi non promettono "perderai".
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
            nome: (save.player && save.player.name) || '',
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

    /**
     * Il riquadro generico: titolo, paragrafi, avvisi, tabella di confronto,
     * azioni. Ogni azione con `doppio` chiede un secondo tocco (il bottone
     * stesso cambia testo per 4 secondi). `esegui` riceve { esito, azioni,
     * chiudi, disabilita(on) } per scrivere il risultato nel riquadro.
     *
     * @param {{
     *   titolo: string, paragrafi: string[], avvisi?: string[], nota?: string,
     *   etichettaA: string, etichettaB: string, a: any, b: any,
     *   azioni: { testo: string, classe?: string, doppio?: string, esegui?: Function }[],
     *   alChiudere?: Function
     * }} o
     */
    function riquadro(o) {
        if (document.getElementById('recuperoCopia')) return null;
        const velo = el('div', 'rc-velo');
        velo.id = 'recuperoCopia';
        const box = el('div', 'rc-box');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-labelledby', 'rcTitolo');
        velo.appendChild(box);

        const testa = el('div', 'rc-testa');
        const titolo = el('h2', 'rc-titolo', o.titolo);
        titolo.id = 'rcTitolo';
        const x = el('button', 'rc-x', '✕');
        x.type = 'button';
        x.setAttribute('aria-label', 'Chiudi');
        testa.appendChild(titolo);
        testa.appendChild(x);
        box.appendChild(testa);

        const corpo = el('div', 'rc-corpo');
        box.appendChild(corpo);
        o.paragrafi.forEach((p) => corpo.appendChild(el('p', 'rc-testo', p)));
        (o.avvisi || []).forEach((p) => {
            const a = el('p', 'rc-attenzione', '⚠️ ' + p);
            a.setAttribute('role', 'alert');
            corpo.appendChild(a);
        });

        // Tabella a tre colonne su schermo largo; a blocchi su telefono (CSS: le etichette arrivano da data-et).
        const tabella = el('div', 'rc-tabella');
        tabella.setAttribute('role', 'table');
        const testaT = el('div', 'rc-riga rc-riga--testa');
        testaT.appendChild(el('span', 'rc-voce', ''));
        testaT.appendChild(el('span', 'rc-col', o.etichettaA));
        testaT.appendChild(el('span', 'rc-col', o.etichettaB));
        tabella.appendChild(testaT);
        const quando = el('div', 'rc-riga rc-riga--data');
        quando.appendChild(el('span', 'rc-voce', 'Ultima modifica'));
        [[o.a, o.etichettaA], [o.b, o.etichettaB]].forEach(([r, et]) => {
            const c = el('span', 'rc-col', r ? fmtData(r.salvato) : '—');
            c.dataset.et = et;
            quando.appendChild(c);
        });
        tabella.appendChild(quando);
        RIGHE.forEach((r) => {
            const va = o.a ? o.a[r.chiave] : 0;
            const vb = o.b ? o.b[r.chiave] : 0;
            const riga = el('div', 'rc-riga' + (vb > va ? ' rc-riga--piu' : vb < va ? ' rc-riga--meno' : ''));
            riga.appendChild(el('span', 'rc-voce', r.etichetta));
            const ca = el('span', 'rc-col', fmtNum.format(va));
            ca.dataset.et = o.etichettaA;
            const cb = el('span', 'rc-col', fmtNum.format(vb));
            cb.dataset.et = o.etichettaB;
            if (vb !== va) cb.appendChild(el('small', 'rc-delta', (vb > va ? ' +' : ' −') + fmtNum.format(Math.abs(vb - va))));
            riga.appendChild(ca);
            riga.appendChild(cb);
            tabella.appendChild(riga);
        });
        corpo.appendChild(tabella);
        if (o.nota) corpo.appendChild(el('p', 'rc-nota', o.nota));
        const esito = el('p', 'rc-esito');
        esito.setAttribute('role', 'status');
        corpo.appendChild(esito);

        const azioni = el('div', 'rc-azioni');
        box.appendChild(azioni);

        document.body.appendChild(velo);
        document.body.classList.add('rc-aperto');

        const chiudi = () => {
            document.removeEventListener('keydown', suTasto, true);
            document.body.classList.remove('rc-aperto');
            velo.remove();
            if (o.alChiudere) o.alChiudere();
        };
        const suTasto = (e) => { if (e.key === 'Escape') { e.stopPropagation(); chiudi(); } };
        document.addEventListener('keydown', suTasto, true);
        x.addEventListener('click', chiudi);
        velo.addEventListener('pointerdown', (e) => { if (e.target === velo) chiudi(); });

        const bottoni = [];
        const disabilita = (on) => bottoni.forEach((b) => { b.disabled = on; });
        const contesto = { esito, azioni, chiudi, disabilita };
        o.azioni.forEach((a) => {
            const b = el('button', 'rc-btn' + (a.classe ? ' ' + a.classe : ''), a.testo);
            b.type = 'button';
            bottoni.push(b);
            azioni.appendChild(b);
            let armato = null;
            b.addEventListener('click', () => {
                if (a.doppio && !armato) {
                    b.textContent = a.doppio;
                    b.classList.add('rc-btn--conferma');
                    armato = setTimeout(() => { armato = null; b.textContent = a.testo; b.classList.remove('rc-btn--conferma'); }, 4000);
                    return;
                }
                clearTimeout(armato);
                armato = null;
                b.classList.remove('rc-btn--conferma');
                b.textContent = a.testo;
                if (a.esegui) a.esegui(contesto); else chiudi();
            });
        });
        return contesto;
    }

    /** Sostituisce i pulsanti con un solo "Fatto" che esegue `fine`. */
    function soloFatto(ctx, fine) {
        ctx.azioni.textContent = '';
        const f = el('button', 'rc-btn rc-btn--ok', 'Fatto');
        f.type = 'button';
        f.addEventListener('click', () => { ctx.chiudi(); if (fine) fine(); });
        ctx.azioni.appendChild(f);
    }

    // ------------------------------------------------------------------
    // 1) Recupero della copia di sicurezza
    // ------------------------------------------------------------------
    /** Il pulsante nel Profilo, o niente se non c'è una copia da recuperare. */
    function monta(contenitore) {
        if (!contenitore) return;
        contenitore.textContent = '';
        const copia = window.CloudSync && CloudSync.copiaDivergente ? CloudSync.copiaDivergente() : null;
        const messe = window.CloudSync && CloudSync.copieRecuperabili ? CloudSync.copieRecuperabili() : [];
        if ((!copia || !copia.data) && !messe.length) { contenitore.style.display = 'none'; return; }
        contenitore.style.display = '';
        if (copia && copia.data) {
            contenitore.appendChild(el('div', 'rc-avviso', 'Su questo dispositivo ci sono modifiche che non sono arrivate sul cloud (conservate il ' + fmtData(copia.conservataIl) + ').'));
            const bottone = el('button', 'rc-apri', '🛟 Recupera le modifiche');
            bottone.type = 'button';
            bottone.addEventListener('click', () => apri(() => monta(contenitore)));
            contenitore.appendChild(bottone);
        }
        // Salvataggi messi da parte quando su questo dispositivo ha giocato qualcun altro (o prima che il dispositivo
        // sapesse di chi fossero): un pulsante per copia, ognuno con il confronto prima di ripristinare.
        if (messe.length) {
            contenitore.appendChild(el('div', 'rc-avviso', messe.length === 1
                ? 'Su questo dispositivo c\'è un salvataggio messo da parte che puoi riprendere.'
                : 'Su questo dispositivo ci sono ' + messe.length + ' salvataggi messi da parte che puoi riprendere.'));
            messe.forEach((m) => {
                const b = el('button', 'rc-apri', '🗂️ ' + (m.tipo === 'tua' ? 'Tuo salvataggio' : 'Salvataggio senza proprietario') + ' del ' + fmtData(m.conservataIl));
                b.type = 'button';
                b.addEventListener('click', () => apriCopiaMessaDaParte(m, () => monta(contenitore)));
                contenitore.appendChild(b);
            });
        }
    }

    /** Il riquadro di confronto per una copia messa da parte (CloudSync.copieRecuperabili). */
    function apriCopiaMessaDaParte(m, alCambio) {
        riquadro({
            titolo: m.tipo === 'tua' ? 'Un tuo salvataggio messo da parte' : 'Un salvataggio messo da parte',
            paragrafi: [
                m.tipo === 'tua'
                    ? 'Questo salvataggio è rimasto su questo dispositivo quando un altro account lo ha usato, o è una versione precedente del tuo.'
                    : 'Questo salvataggio è su questo dispositivo da prima che si sapesse a chi appartenesse. Se è tuo, puoi riprenderlo.',
                'Qui sotto vedi la differenza. Se lo ripristini diventa il tuo salvataggio e viene caricato sul cloud.'
            ],
            etichettaA: 'Adesso',
            etichettaB: 'Messo da parte',
            a: riassunto(window.SaveManager && SaveManager.hasSave() ? SaveManager.load() : null),
            b: riassunto(m.data),
            nota: 'Il salvataggio di adesso non va perso: diventa la tua copia di sicurezza, e da lì puoi tornare indietro.',
            alChiudere: alCambio,
            azioni: [
                {
                    testo: 'Ripristina', classe: 'rc-btn--ok', doppio: 'Tocca ancora per confermare',
                    esegui: (ctx) => {
                        ctx.disabilita(true);
                        ctx.esito.textContent = 'Ripristino in corso…';
                        CloudSync.ripristinaCopiaMessaDaParte(m.uid, m.indice)
                            .then(() => {
                                const carica = window.AutoSync && AutoSync.caricaOra ? AutoSync.caricaOra() : Promise.resolve();
                                return Promise.resolve(carica).catch(() => null);
                            })
                            .then(() => {
                                ctx.esito.textContent = '✅ Salvataggio ripristinato. Quello di prima è nella copia di sicurezza.';
                                ctx.esito.classList.add('rc-esito--ok');
                                ctx.azioni.textContent = '';
                                const fine = el('button', 'rc-btn rc-btn--ok', 'Fatto');
                                fine.type = 'button';
                                fine.addEventListener('click', () => { window.location.reload(); });
                                ctx.azioni.appendChild(fine);
                            })
                            .catch((e) => {
                                ctx.esito.textContent = 'Non sono riuscito a ripristinare: ' + (e && e.message ? e.message : 'errore sconosciuto');
                                ctx.disabilita(false);
                            });
                    }
                },
                { testo: 'Chiudi' }
            ]
        });
    }

    /** Il riquadro di recupero. `alCambio` ridisegna il pulsante dopo ripristino/scarto. */
    function apri(alCambio) {
        const copia = window.CloudSync && CloudSync.copiaDivergente ? CloudSync.copiaDivergente() : null;
        if (!copia || !copia.data) return;
        riquadro({
            titolo: 'Modifiche non sincronizzate',
            paragrafi: [
                'Hai giocato su questo dispositivo mentre il cloud veniva aggiornato da un altro. Per non perdere i progressi di quell\'altro dispositivo, qui è stata caricata la sua versione, e quello che avevi fatto qui è rimasto in una copia di sicurezza.',
                'Qui sotto vedi la differenza. Se ripristini la copia, diventa il tuo salvataggio e viene caricata sul cloud al posto di quello attuale.'
            ],
            etichettaA: 'Adesso',
            etichettaB: 'Copia',
            a: riassunto(window.SaveManager && SaveManager.hasSave() ? SaveManager.load() : null),
            b: riassunto(copia.data),
            nota: 'Il ripristino si può annullare: il salvataggio di adesso prende il posto della copia, e basta ripristinare di nuovo per tornare indietro.',
            alChiudere: alCambio,
            azioni: [
                {
                    testo: 'Ripristina la copia', classe: 'rc-btn--ok', doppio: 'Tocca ancora per confermare',
                    esegui: (ctx) => {
                        ctx.disabilita(true);
                        ctx.esito.textContent = 'Ripristino in corso…';
                        CloudSync.ripristinaCopiaDivergente()
                            .then(() => {
                                // Il salvataggio ora è la copia: si carica sul cloud (la base di
                                // sincronizzazione è ancora quella dell'ultimo allineamento).
                                const carica = window.AutoSync && AutoSync.caricaOra ? AutoSync.caricaOra() : Promise.resolve();
                                return Promise.resolve(carica).catch(() => null);
                            })
                            .then(() => {
                                ctx.esito.textContent = '✅ Copia ripristinata. Il salvataggio di prima è stato conservato: se cambi idea puoi tornare indietro da qui.';
                                ctx.esito.classList.add('rc-esito--ok');
                                ctx.azioni.textContent = '';
                                const fine = el('button', 'rc-btn rc-btn--ok', 'Fatto');
                                fine.type = 'button';
                                // La pagina del Profilo mostra ancora i dati di prima: si ricarica.
                                fine.addEventListener('click', () => { window.location.reload(); });
                                ctx.azioni.appendChild(fine);
                            })
                            .catch((e) => {
                                ctx.esito.textContent = 'Non sono riuscito a ripristinare: ' + (e && e.message ? e.message : 'errore sconosciuto');
                                ctx.disabilita(false);
                            });
                    }
                },
                {
                    testo: 'Scarta la copia', classe: 'rc-btn--no', doppio: 'Tocca ancora: la copia sparisce',
                    esegui: (ctx) => { CloudSync.scartaCopiaDivergente(); ctx.chiudi(); }
                },
                { testo: 'Chiudi' }
            ]
        });
    }

    // ------------------------------------------------------------------
    // 2) Importazione di un file di salvataggio
    // ------------------------------------------------------------------
    /**
     * Importa un file scelto dall'utente, ma solo dopo averglielo fatto vedere.
     * @param {File} file
     * @param {{ alFinito?: Function, avviso?: (testo: string) => void }} [opzioni]
     *        alFinito: la pagina ridisegna il Profilo; avviso: un messaggio breve (toast)
     */
    function importa(file, opzioni) {
        const op = opzioni || {};
        const dillo = (t) => { if (op.avviso) op.avviso(t); };
        return SaveManager.readFile(file).then((letto) => {
            const attuale = SaveManager.hasSave() ? SaveManager.load() : null;
            const a = riassunto(attuale);
            const b = riassunto(letto);
            const avvisi = [];
            if (a && b && a.nome && b.nome && a.nome.trim().toLowerCase() !== b.nome.trim().toLowerCase()) {
                avvisi.push('Il file appartiene a «' + b.nome + '», mentre qui giochi come «' + a.nome + '»: controlla di aver scelto il file giusto.');
            }
            if (a && b && a.salvato && b.salvato && Date.parse(b.salvato) < Date.parse(a.salvato)) {
                avvisi.push('Il file è più vecchio del salvataggio di adesso: i progressi fatti dopo il ' + fmtData(b.salvato) + ' non ci sono. Restano nella copia di sicurezza.');
            }
            riquadro({
                titolo: 'Importare questo salvataggio?',
                paragrafi: [
                    'Stai per sostituire il salvataggio di questo dispositivo con quello del file «' + (file && file.name ? file.name : 'salvataggio') + '». Dopo l\'importazione verrà caricato anche sul cloud, e gli altri tuoi dispositivi lo scaricheranno.',
                    'Il salvataggio di adesso non va perso: viene conservato come copia di sicurezza e lo ritrovi nel pulsante «Recupera le modifiche» del Profilo.'
                ],
                avvisi: avvisi,
                etichettaA: 'Adesso',
                etichettaB: 'File',
                a: a,
                b: b,
                alChiudere: null,
                azioni: [
                    {
                        testo: 'Importa il file', classe: 'rc-btn--ok', doppio: 'Tocca ancora per importare',
                        esegui: (ctx) => {
                            ctx.disabilita(true);
                            try {
                                // Prima si conserva quello di adesso, poi si applica il file:
                                // se il file viene rifiutato non si è toccato niente.
                                const prima = attuale ? JSON.parse(JSON.stringify(attuale)) : null;
                                SaveManager.applyExternalSave(letto);
                                if (prima && window.CloudSync && CloudSync.conservaCopiaDi) CloudSync.conservaCopiaDi(prima);
                                ctx.esito.textContent = '✅ Salvataggio importato. Quello di prima è conservato: lo ritrovi in «Recupera le modifiche».';
                                ctx.esito.classList.add('rc-esito--ok');
                                dillo('⬆️ Salvataggio importato!');
                                soloFatto(ctx, op.alFinito);
                            } catch (e) {
                                ctx.esito.textContent = 'Importazione non riuscita: ' + (e && e.message ? e.message : 'errore sconosciuto');
                                ctx.disabilita(false);
                            }
                        }
                    },
                    { testo: 'Annulla' }
                ]
            });
        }).catch((e) => { dillo('⚠️ ' + (e && e.message ? e.message : 'Importazione non riuscita.')); });
    }

    window.RecuperoCopia = { monta, apri, importa, riassunto };
})();
