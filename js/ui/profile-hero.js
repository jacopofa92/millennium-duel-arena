// @ts-check
/**
 * profile-hero.js — La parte alta del Profilo: chi sei, come stai andando,
 * cosa hai in tasca, con quali mazzi giochi.
 * =====================================================================
 * COMPONENTE condiviso fra la vista Profilo del menu (index.html) e
 * profilo.html, come js/ui/profile-stats.js e js/ui/sfide-view.js: le due
 * copie della stessa schermata sono già andate alla deriva più volte
 * (vedi CLAUDE.md, "viste fuse"), quindi la si scrive una volta sola.
 *
 * Uso:   ProfileHero.render(contenitore, { toast: (testo) => ... })
 *
 * Sostituisce, richiesta dell'utente ("migliora la ui del profilo"):
 *  - la tessera col nome dentro una casella di testo sempre aperta (un
 *    modulo, non un profilo): ora il nome è un titolo, e la matita lo
 *    rende modificabile;
 *  - la fila Deck / Vittorie / Sconfitte, che le Statistiche più sotto
 *    ripetevano: vittorie, sconfitte e percentuale stanno qui, una volta;
 *  - quattro riquadri grandi per le valute: ora una fila di pillole;
 *  - la griglia di scatole enormi, una per riga su telefono: ora una fila
 *    scorrevole di scatole piccole, e un tocco rende attivo un mazzo.
 *
 * Il TITOLO del duellante (Novizio → Re dei Giochi) è calcolato dal
 * salvataggio, mai salvato: un punto per vittoria, 15 per torneo vinto, 20
 * per storia completata. La regola è scritta sotto il titolo, così nessuno
 * deve indovinare perché è cambiato.
 */
(function () {
    'use strict';

    // La SCALA a punti. I sei titoli di sempre restano dove erano (stessi nomi, stesse soglie): fra uno e l'altro ne sono
    // entrati altri, cosi' si sale piu' spesso, e in cima ce ne sono quattro per chi gioca tanto. I titoli SPECIALI (storie,
    // tornei, traguardi) sono un'altra cosa, vedi js/data/titles-db.js.
    const TITOLI = [
        { da: 0, nome: 'Duellante novizio' },
        { da: 3, nome: 'Recluta dell\'Arena' },
        { da: 5, nome: 'Apprendista duellante' },
        { da: 12, nome: 'Duellante di strada' },
        { da: 20, nome: 'Duellante esperto' },
        { da: 35, nome: 'Veterano del Millennio' },
        { da: 50, nome: 'Asso del duello' },
        { da: 75, nome: 'Maestro dei Mostri' },
        { da: 100, nome: 'Campione' },
        { da: 150, nome: 'Campione del Regno' },
        { da: 200, nome: 'Re dei Giochi' },
        { da: 300, nome: 'Leggenda dell\'Arena' },
        { da: 500, nome: 'Sovrano dell\'Arena' },
        { da: 1000, nome: 'Divinità del Duello' }
    ];

    /**
     * I titoli speciali con il loro stato. Si sbloccano guardando le SFIDE completate (permanenti: un "Ricomincia" in una storia
     * non toglie un titolo), mai uno stato che si puo' azzerare. Forme di ichiede: vedi js/data/titles-db.js.
     */
    function speciali(save) {
        const catalogo = /** @type {any} */ (window).titoliSpecialiDatabase || [];
        const fatte = (save && save.challenges) || {};
        const completata = (id) => !!(fatte[id] && fatte[id].completed);
        const elencoSfide = /** @type {any} */ (window).challengesDatabase || [];
        return catalogo.map((def) => {
            const r = def.richiede || {};
            let sbloccato = false;
            if (Array.isArray(r.sfide)) {
                sbloccato = r.sfide.length > 0 && r.sfide.every(completata);
            } else if (r.prefisso) {
                const ids = elencoSfide.map((c) => c.id).filter((id) => id.indexOf(r.prefisso) === 0);
                const completate = ids.filter(completata).length;
                sbloccato = r.tutte ? (ids.length > 0 && completate === ids.length) : completate >= (r.almeno || 1);
            }
            return { def: def, sbloccato: sbloccato };
        });
    }

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function data(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return '—'; }
    }
    function icona(nome) { return `<span class="phr-ic" data-icon="${nome}" aria-hidden="true"></span>`; }

    function calcola(save) {
        let vinti = 0, persi = 0;
        Object.values(save.records || {}).forEach((r) => { vinti += (r && r.wins) || 0; persi += (r && r.losses) || 0; });
        let torneiVinti = 0;
        Object.values(save.tournamentStats || {}).forEach((t) => { torneiVinti += (t && t.completions) || 0; });
        let storieFinite = 0;
        Object.keys(save.story || {}).forEach((k) => { if (!/@livello$/.test(k) && save.story[k] && save.story[k].finita) storieFinite++; });
        const punti = vinti + torneiVinti * 15 + storieFinite * 20;
        let i = 0;
        while (i + 1 < TITOLI.length && punti >= TITOLI[i + 1].da) i++;
        const prossimo = TITOLI[i + 1] || null;
        const avanzamento = prossimo ? Math.round(((punti - TITOLI[i].da) / (prossimo.da - TITOLI[i].da)) * 100) : 100;
        const giocati = vinti + persi;
        // Il titolo mostrato: lo speciale scelto dal giocatore se lo ha ancora sbloccato, altrimenti quello della scala.
        const tuttiSpeciali = speciali(save);
        const sceltoId = save.player && save.player.titoloScelto;
        const scelto = tuttiSpeciali.find((x) => x.sbloccato && x.def.id === sceltoId) || null;
        return {
            vinti, persi, giocati, punti,
            percentuale: giocati ? Math.round((vinti / giocati) * 100) : null,
            speciali: tuttiSpeciali,
            specialiSbloccati: tuttiSpeciali.filter((x) => x.sbloccato).length,
            specialeScelto: scelto ? scelto.def : null,
            titoloScala: TITOLI[i].nome,
            titolo: scelto ? scelto.def.nome : TITOLI[i].nome, prossimo, avanzamento,
            livello: i + 1,
            livelliTotali: TITOLI.length,
            puntiMancanti: prossimo ? Math.max(0, prossimo.da - punti) : 0
        };
    }

    // "Mostra solo gli sbloccati": preferenza del DISPOSITIVO (come lo zoom di una lista), non del profilo, quindi localStorage.
    const CHIAVE_SOLO_SBLOCCATI = 'ygoTitoliSoloSbloccati';
    function leggiSoloSbloccati() {
        try { return localStorage.getItem(CHIAVE_SOLO_SBLOCCATI) === '1'; } catch (e) { return false; }
    }
    function scriviSoloSbloccati(valore) {
        try { if (valore) localStorage.setItem(CHIAVE_SOLO_SBLOCCATI, '1'); else localStorage.removeItem(CHIAVE_SOLO_SBLOCCATI); } catch (e) { /* non si ricorda, pazienza */ }
    }

    function render(contenitore, opzioni) {
        const el = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!el || !window.SaveManager) return;
        const toast = (opzioni && opzioni.toast) || (() => {});
        const save = SaveManager.load() || SaveManager.createNew('Giocatore');
        const s = calcola(save);
        const wallet = SaveManager.getCurrency();
        const decks = save.decks || [];
        const attivo = SaveManager.getActiveDeckId ? SaveManager.getActiveDeckId() : null;
        el.classList.add('profile-hero');

        // I titoli speciali, per gruppo nell'ordine del catalogo. La sezione resta aperta dopo aver scelto un titolo (render
        // ridisegna tutto: senza questo si richiuderebbe a ogni tocco).
        const aperti = !!el.querySelector('[data-phr="speciali"][open]');
        // Ogni gruppo e' richiudibile: si ricorda quali erano aperti (render ridisegna tutto). La prima volta restano aperti solo i
        // gruppi dove c'e' qualcosa di sbloccato o il titolo in uso, cosi' 45 titoli non diventano un muro di testo.
        const primaSezione = el.querySelector('[data-phr="speciali"]');
        const gruppiAperti = primaSezione
            ? new Set(Array.from(primaSezione.querySelectorAll('details.phr-gruppo[open]')).map((d) => d.getAttribute('data-gruppo')))
            : null;
        const soloSbloccati = leggiSoloSbloccati();
        const gruppiSpeciali = [];
        s.speciali.forEach((voce) => {
            let g = gruppiSpeciali.find((x) => x.nome === voce.def.gruppo);
            if (!g) { g = { nome: voce.def.gruppo, voci: [] }; gruppiSpeciali.push(g); }
            g.voci.push(voce);
        });

        const anello = s.percentuale == null
            ? '<div class="phr-anello phr-anello--vuoto"><span class="phr-anello-valore">—</span><span class="phr-anello-etichetta">vittorie</span></div>'
            : `<div class="phr-anello" style="--phr-pct:${s.percentuale}"><span class="phr-anello-valore">${s.percentuale}%</span><span class="phr-anello-etichetta">vittorie</span></div>`;

        el.innerHTML = `
            <div class="phr-testata">
                <div class="phr-ritratto">
                    <span class="phr-ritratto-ripiego">${icona('profile')}</span>
                    <img src="images/characters/mirror.jpg" alt="">
                </div>
                <div class="phr-identita">
                    <div class="phr-titolo-riga">
                        <div class="phr-titolo">${esc(s.titolo)}</div>
                        <div class="phr-livello" aria-label="Livello titolo ${s.livello} di ${s.livelliTotali}">Livello ${s.livello} <span>di ${s.livelliTotali}</span></div>
                    </div>
                    <div class="phr-nome-riga" data-phr="vista">
                        <h2 class="phr-nome"></h2>
                        <button type="button" class="phr-matita" data-phr="modifica" title="Cambia nome" aria-label="Cambia nome">${icona('pencil')}</button>
                    </div>
                    <form class="phr-nome-riga phr-modifica" data-phr="modulo" hidden>
                        <input type="text" class="phr-input" maxlength="24" aria-label="Nome del duellante">
                        <button type="submit" class="phr-btn phr-btn--oro">Salva</button>
                        <button type="button" class="phr-btn" data-phr="annulla">Annulla</button>
                    </form>
                    <div class="phr-barra" title="${s.prossimo ? `${s.punti} punti su ${s.prossimo.da}` : 'Titolo massimo'}">
                        <span style="width:${s.avanzamento}%"></span>
                    </div>
                    <div class="phr-regola">${s.prossimo
                        ? `Prossimo: ${esc(s.prossimo.nome)} · mancano ${s.puntiMancanti} punti (${s.punti}/${s.prossimo.da})`
                        : `Titolo massimo raggiunto · ${s.punti} punti`}
                        <span class="phr-regola-come">1 punto per vittoria, 15 per torneo vinto, 20 per storia completata</span>
                    </div>
                    ${s.specialeScelto ? `<div class="phr-speciale-nota">Titolo speciale · il tuo rango è <strong>${esc(s.titoloScala)}</strong></div>` : ''}
                    <details class="phr-percorso">
                        <summary>Vedi tutti i ${s.livelliTotali} titoli</summary>
                        <ol class="phr-livelli">
                            ${TITOLI.map((titolo, indice) => `<li class="${indice < s.livello - 1 ? 'is-superato' : indice === s.livello - 1 ? 'is-attuale' : 'is-bloccato'}"${indice === s.livello - 1 ? ' aria-current="step"' : ''}>
                                <span class="phr-livello-numero">${indice + 1}</span>
                                <span class="phr-livello-nome">${esc(titolo.nome)}</span>
                                <span class="phr-livello-soglia">${titolo.da} pt</span>
                            </li>`).join('')}
                        </ol>
                    </details>
                    ${s.speciali.length ? `<details class="phr-percorso phr-speciali" data-phr="speciali"${aperti ? ' open' : ''}>
                        <summary>Titoli speciali · ${s.specialiSbloccati} di ${s.speciali.length}</summary>
                        <div class="phr-speciali-aiuto">Si guadagnano completando storie, tornei e traguardi. Tocca uno sbloccato per mostrarlo sotto il tuo nome.</div>
                        <label class="phr-solo"><input type="checkbox" data-phr="solo-sbloccati"${soloSbloccati ? ' checked' : ''}> Mostra solo gli sbloccati</label>
                        ${gruppiSpeciali.map((g) => {
                            const voci = soloSbloccati ? g.voci.filter((v) => v.sbloccato) : g.voci;
                            if (!voci.length) return '';
                            const sbloccatiDelGruppo = g.voci.filter((v) => v.sbloccato).length;
                            const inUso = !!(s.specialeScelto && g.voci.some((v) => v.def.id === s.specialeScelto.id));
                            const apertoOra = gruppiAperti ? gruppiAperti.has(g.nome) : (sbloccatiDelGruppo > 0 || inUso);
                            return `<details class="phr-gruppo" data-gruppo="${esc(g.nome)}"${apertoOra ? ' open' : ''}>
                            <summary class="phr-gruppo-titolo">${esc(g.nome)} <span>${sbloccatiDelGruppo}/${g.voci.length}</span></summary>
                            <ul class="phr-speciali-elenco">${voci.map((v) => `<li class="${v.sbloccato ? 'is-sbloccato' : 'is-bloccato'}${s.specialeScelto && s.specialeScelto.id === v.def.id ? ' is-scelto' : ''}">
                                ${v.sbloccato
                                    ? `<button type="button" class="phr-speciale" data-titolo="${esc(v.def.id)}" aria-pressed="${s.specialeScelto && s.specialeScelto.id === v.def.id ? 'true' : 'false'}"><span class="phr-speciale-nome">${esc(v.def.nome)}</span><span class="phr-speciale-stato">${s.specialeScelto && s.specialeScelto.id === v.def.id ? 'In uso' : 'Usa'}</span></button>`
                                    : `<div class="phr-speciale phr-speciale--bloccato"><span class="phr-speciale-nome">${esc(v.def.nome)}</span><span class="phr-speciale-come">${esc(v.def.come)}</span></div>`}
                            </li>`).join('')}</ul>
                        </details>`;
                        }).join('')}
                        ${s.specialeScelto ? '<button type="button" class="phr-btn phr-speciale-reset" data-phr="titolo-scala">Torna al titolo a punti</button>' : ''}
                    </details>` : ''}
                    <div class="phr-salvato">Ultimo salvataggio: ${esc(data(save.player && save.player.lastSaved))}</div>
                </div>
            </div>

            <div class="phr-riepilogo">
                ${anello}
                <div class="phr-numero phr-numero--vinti"><strong>${s.vinti}</strong><span>Vittorie</span></div>
                <div class="phr-numero phr-numero--persi"><strong>${s.persi}</strong><span>Sconfitte</span></div>
                <div class="phr-numero"><strong>${s.giocati}</strong><span>Duelli</span></div>
            </div>

            <div class="phr-sezione">
                <div class="phr-sezione-titolo">${icona('wallet')} Portafoglio <a href="negozio.html" class="phr-link">Vai al Negozio ›</a></div>
                <div class="phr-pillole">
                    <div class="phr-pillola" title="Crediti">${icona('coin')}<strong>${wallet.credits || 0}</strong><span>Crediti</span></div>
                    <div class="phr-pillola" title="Stelle dell'Esagono">${icona('star')}<strong>${wallet.starChips || 0}</strong><span>Stelle</span></div>
                    <div class="phr-pillola" title="Carte Locazione">${icona('map')}<strong>${wallet.locatorCards || 0}</strong><span>Locazione</span></div>
                    <div class="phr-pillola" title="Carte del Millennio">${icona('eye')}<strong>${wallet.millenniumCards || 0}</strong><span>Millennio</span></div>
                </div>
            </div>

            <div class="phr-sezione">
                <div class="phr-sezione-titolo">${icona('cards')} I tuoi mazzi <span class="phr-conta">${decks.length}</span> <a href="creazione-deck.html" class="phr-link">Gestisci ›</a></div>
                <div class="phr-mazzi" data-phr="mazzi"></div>
            </div>`;

        // Nome: testo scritto dal giocatore, quindi textContent.
        const nome = (save.player && save.player.name) || 'Giocatore';
        el.querySelector('.phr-nome').textContent = nome;

        const img = el.querySelector('.phr-ritratto img');
        img.onload = () => el.querySelector('.phr-ritratto').classList.add('has-image');
        img.onerror = () => img.remove();

        // Modifica del nome.
        const vista = el.querySelector('[data-phr="vista"]');
        const modulo = el.querySelector('[data-phr="modulo"]');
        const input = modulo.querySelector('input');
        const apri = () => { input.value = nome; vista.hidden = true; modulo.hidden = false; input.focus(); input.select(); };
        const chiudi = () => { modulo.hidden = true; vista.hidden = false; };
        el.querySelector('[data-phr="modifica"]').onclick = apri;
        el.querySelector('[data-phr="annulla"]').onclick = chiudi;
        modulo.onsubmit = (e) => {
            e.preventDefault();
            SaveManager.setPlayerName(input.value);
            toast('Nome aggiornato!');
            render(el, opzioni);
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudi(); });

        // Titolo speciale: un tocco su uno sbloccato lo mostra sotto il nome (di nuovo lo stesso = si torna alla scala).
        el.querySelectorAll('.phr-speciale[data-titolo]').forEach((b) => {
            b.onclick = () => {
                const id = b.getAttribute('data-titolo');
                const era = s.specialeScelto && s.specialeScelto.id === id;
                SaveManager.setTitoloScelto(era ? null : id);
                toast(era ? 'Titolo a punti ripristinato.' : `Ora sei «${b.querySelector('.phr-speciale-nome').textContent}».`);
                render(el, opzioni);
            };
        });
        const filtro = el.querySelector('[data-phr="solo-sbloccati"]');
        if (filtro) filtro.onchange = () => { scriviSoloSbloccati(filtro.checked); render(el, opzioni); };
        const reset = el.querySelector('[data-phr="titolo-scala"]');
        if (reset) reset.onclick = () => { SaveManager.setTitoloScelto(null); toast('Titolo a punti ripristinato.'); render(el, opzioni); };

        // Mazzi: una scatola piccola per mazzo; un tocco su uno non attivo
        // lo rende quello con cui si gioca.
        const fila = el.querySelector('[data-phr="mazzi"]');
        if (decks.length === 0) {
            fila.innerHTML = '<div class="phr-vuoto">Nessun mazzo ancora: creane uno da Gestisci.</div>';
        }
        decks.forEach((deck) => {
            const conta = (deck.main || []).reduce((n, e) => n + (e.qty || 0), 0);
            const inUso = deck.id === attivo;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'phr-mazzo' + (inUso ? ' is-attivo' : '');
            b.title = inUso ? 'Mazzo in uso' : 'Usa questo mazzo';
            b.innerHTML = (window.DeckBox ? DeckBox.markup({ name: deck.name, color: deck.color || DeckBox.colorForId(deck.id) }) : '')
                + '<span class="phr-mazzo-nome"></span>'
                + `<span class="phr-mazzo-sub">${conta} carte</span>`
                + `<span class="phr-mazzo-stato">${inUso ? 'In uso' : 'Usa'}</span>`;
            b.querySelector('.phr-mazzo-nome').textContent = deck.name || '(senza nome)';
            b.onclick = () => {
                if (inUso || !SaveManager.setActiveDeckId) return;
                SaveManager.setActiveDeckId(deck.id);
                toast(`Ora giochi con «${deck.name || 'il mazzo scelto'}».`);
                render(el, opzioni);
            };
            fila.appendChild(b);
        });

        if (window.Icons) Icons.hydrate(el);
    }

    window.ProfileHero = { render: render, calcola: calcola, TITOLI: TITOLI, speciali: speciali };
})();
