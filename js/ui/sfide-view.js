/**
 * sfide-view.js — La schermata delle Sfide, una sola per tutto il gioco.
 * =====================================================================
 * `SfideView.mount(contenitore)` disegna l'intera schermata — le cinque
 * sezioni (Oggi, Settimana, Sfide, Storie, Modalità), il riepilogo, quanto manca
 * alla prossima rotazione, la griglia a riquadri e il pannello di
 * dettaglio — e torna `{ refresh }` per ridisegnarla.
 *
 * PERCHÉ UN COMPONENTE. La schermata esisteva in DUE copie: sfide.html
 * (la pagina a sé) e la vista fusa nel menu di index.html (#view-sfide).
 * Le quattro sezioni e le missioni a rotazione erano state aggiunte solo
 * alla prima, e il menu — che è da dove ci si arriva davvero — mostrava
 * ancora il vecchio elenco unico, con in fondo la frase "le ricompense
 * arriveranno in un futuro aggiornamento" quando i premi esistevano da
 * tempo. Segnalato dall'utente ("la pagina sfide si vede ancora senza
 * giornaliere, settimanali"). Con un componente solo le due pagine non
 * possono più andare fuori passo: entrambe chiamano questa funzione.
 * Stesso schema del Negozio (ShopUI.mount in js/economy/shop-ui.js).
 *
 * Tutto si cerca DENTRO il contenitore (classi e data-attributi, nessun
 * id): nel menu di index.html vivono molte viste nella stessa pagina, e
 * un id ripetuto finirebbe a indicare l'elemento di un'altra.
 *
 * Serve che siano caricati: save-manager.js, rewards.js (cosa dà ogni
 * sfida), challenges-db.js, missions-db.js, story-campaigns.js (nome e
 * icona di ogni storia), server-date.js (l'ora del SERVER per la
 * rotazione), challenge-tracker.js. Stile in js/ui/sfide-view.css.
 */
(function () {
    'use strict';

    // L'ordine dei gruppi nella sezione "Sfide": si comincia da ciò che si
    // ottiene giocando normalmente e si finisce con i traguardi rari. Un
    // tipo non elencato (una famiglia nuova aggiunta a challenges-db.js e
    // dimenticata qui) finisce in fondo con un titolo generico invece di
    // sparire.
    const GRUPPI = [
        { type: 'winDuels', titolo: '🏆 Traguardi' },
        { type: 'defeatCharacter', titolo: '⚔️ Duellanti da battere' },
        { type: 'summonMonster', titolo: '✨ Mostri da evocare' },
        { type: 'activateCard', titolo: '🎴 Carte da attivare' },
        { type: 'perfectWin', titolo: '💎 Vittorie perfette' },
        { type: 'winInstantly', titolo: '🧩 Vittorie alternative' },
        { type: 'completeTournament', titolo: '🏟️ Tornei' },
        { type: 'winMillenniumItem', titolo: '🔱 Oggetti del Millennio' }
    ];

    const SEZIONI = [
        { id: 'giornaliere', etichetta: '☀️ Oggi' },
        { id: 'settimanali', etichetta: '📅 Settimana' },
        { id: 'generiche', etichetta: '🏆 Sfide' },
        { id: 'storie', etichetta: '📖 Storie' },
        { id: 'modalita', etichetta: '🎮 Modalità' }
    ];

    // Titolo e ordine dei gruppi nella sezione "Modalità": la chiave è il
    // campo `modalita` delle sfide in challenges-db.js. Una modalità non
    // elencata qui compare comunque, in fondo, col suo id.
    const MODALITA = [
        { id: 'puzzle', titolo: '🧩 Puzzle' },
        { id: 'rivincite', titolo: '⚔️ Rivincite' },
        { id: 'torre', titolo: '🗼 Torre dei Duellanti' },
        { id: 'settimana', titolo: '📅 Duello della Settimana' },
        { id: 'caccia', titolo: '🏹 Caccia al Boss' }
    ];

    function escape(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /** "2h 14m" — quanto manca al prossimo cambio, senza i secondi che ballerebbero. */
    function formattaAttesa(ms) {
        const totMin = Math.max(0, Math.round(ms / 60000));
        const giorni = Math.floor(totMin / 1440);
        const ore = Math.floor((totMin % 1440) / 60);
        const min = totMin % 60;
        if (giorni > 0) return `${giorni}g ${ore}h`;
        if (ore > 0) return `${ore}h ${min}m`;
        return `${min}m`;
    }

    /**
     * La riga "cosa dà questa Sfida", mostrata PRIMA di averla vinta: un
     * obiettivo va scelto sapendo cosa frutta. Rewards.previewChallenge
     * legge il premio senza accreditare nulla. Testi dal catalogo e da
     * rewards.js, mai dall'utente.
     */
    function premiHtml(challenge) {
        if (!window.Rewards || typeof Rewards.previewChallenge !== 'function') return '';
        const voci = Rewards.previewChallenge(challenge);
        if (voci.length === 0) return '';
        const etichetta = challenge.completed ? 'Ottenuto' : 'Ricompensa';
        return `<div class="sv-premio">
            <span class="sv-premio-etichetta">${etichetta}</span>
            ${voci.map((v) => `<span class="sv-premio-voce">${v.icon} +${v.amount} ${escape(v.nome)}</span>`).join('')}
        </div>`;
    }

    function ordinaInGruppi(challenges) {
        const gruppi = [];
        const usate = new Set();
        GRUPPI.forEach((g) => {
            const voci = challenges.filter((c) => c.type === g.type);
            voci.forEach((c) => usate.add(c.id));
            if (voci.length > 0) gruppi.push({ titolo: g.titolo, voci: voci });
        });
        const avanzate = challenges.filter((c) => !usate.has(c.id));
        if (avanzate.length > 0) gruppi.push({ titolo: '🎯 Altre sfide', voci: avanzate });
        return gruppi;
    }

    function mount(contenitore) {
        const root = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!root) return null;
        root.classList.add('sfide-vista');
        root.innerHTML = `
            <div class="sv-sezioni" role="tablist">
                ${SEZIONI.map((s, i) => `<button type="button" class="sv-tab${i === 0 ? ' is-attiva' : ''}" data-sezione="${s.id}" role="tab">${s.etichetta}</button>`).join('')}
            </div>
            <div class="sv-riepilogo">
                <span class="sv-riepilogo-etichetta" data-sv="etichetta">Sfide completate</span>
                <span class="sv-riepilogo-valore" data-sv="valore">0/0</span>
            </div>
            <div class="sv-rotazione" data-sv="rotazione" hidden>
                <span data-sv="rotazione-testo"></span>
                <span class="sv-rotazione-avviso" data-sv="rotazione-avviso" hidden>⚠️ Orario dal dispositivo: senza rete la rotazione potrebbe non essere quella giusta.</span>
            </div>
            <div class="sv-griglia" data-sv="griglia"></div>
            <p class="sv-nota">Ogni Sfida paga <strong>una volta sola</strong>, nel momento in cui la completi: il premio ti viene accreditato subito e te lo dice un avviso, ovunque tu sia quando succede.</p>
            <div class="sv-dettaglio-fondo" data-sv="dettaglio" hidden>
                <div class="sv-dettaglio" role="dialog" aria-modal="true">
                    <button type="button" class="sv-chiudi" data-sv="chiudi" aria-label="Chiudi">✕</button>
                    <div class="sv-dettaglio-testa">
                        <span class="sv-anello" data-sv="d-anello"><span class="sv-icona" data-sv="d-icona"></span></span>
                        <div>
                            <div class="sv-dettaglio-nome" data-sv="d-nome"></div>
                            <span class="sv-completata" data-sv="d-completata" hidden>✅ Completata</span>
                        </div>
                    </div>
                    <div class="sv-descrizione" data-sv="d-descrizione"></div>
                    <div class="sv-progresso">
                        <div class="sv-barra"><div class="sv-barra-riempi" data-sv="d-barra"></div></div>
                        <div class="sv-progresso-testo" data-sv="d-progresso"></div>
                    </div>
                    <div data-sv="d-premio"></div>
                </div>
            </div>`;
        const q = (nome) => root.querySelector(`[data-sv="${nome}"]`);
        let sezioneAttiva = 'giornaliere';

        function riepilogo(etichetta, fatte, totali) {
            q('etichetta').textContent = etichetta;
            q('valore').textContent = `${fatte}/${totali}`;
        }

        function renderRotazione() {
            const aRotazione = sezioneAttiva === 'giornaliere' || sezioneAttiva === 'settimanali';
            q('rotazione').hidden = !aRotazione;
            if (!aRotazione || !window.ServerDate) return;
            const ms = sezioneAttiva === 'giornaliere' ? ServerDate.msToNextDay() : ServerDate.msToNextWeek();
            q('rotazione-testo').textContent = sezioneAttiva === 'giornaliere'
                ? `Nuove missioni fra ${formattaAttesa(ms)}`
                : `Nuove missioni settimanali fra ${formattaAttesa(ms)}`;
            // Lo si DICE quando l'orario non viene dal server, invece di
            // fingere che sia tutto a posto: stessa onestà del Negozio.
            q('rotazione-avviso').hidden = ServerDate.isTrusted();
        }

        /**
         * Un riquadro minimo — icona con anello di progresso, nome,
         * conteggio — che al tocco apre il dettaglio con descrizione e
         * ricompensa. Il testo lungo NON sta sul riquadro: ripetuto una
         * sessantina di volte è quello che rendeva la lista troppo lunga.
         */
        function disegnaSfida(griglia, c) {
            const percento = Math.round((c.count / c.target) * 100);
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'sv-tile' + (c.completed ? ' is-completata' : '');
            tile.innerHTML = `
                <span class="sv-anello" style="--pct:${percento}"><span class="sv-icona">${c.icon || '🏆'}</span></span>
                <span class="sv-tile-nome">${escape(c.label)}</span>
                <span class="sv-tile-conta">${c.count}/${c.target}</span>
                ${c.completed ? '<span class="sv-spunta">✓</span>' : ''}`;
            tile.addEventListener('click', () => apriDettaglio(c));
            griglia.appendChild(tile);
        }

        /** Intestazione di gruppo + i suoi riquadri, nella STESSA griglia (niente fisarmonica). */
        function disegnaGruppi(griglia, gruppi) {
            gruppi.forEach((g) => {
                const fatte = g.voci.filter((c) => c.completed).length;
                const testa = document.createElement('div');
                testa.className = 'sv-gruppo';
                testa.textContent = `${g.titolo} · ${fatte}/${g.voci.length}`;
                griglia.appendChild(testa);
                g.voci.forEach((c) => disegnaSfida(griglia, c));
            });
        }

        function apriDettaglio(c) {
            const percento = Math.round((c.count / c.target) * 100);
            q('d-icona').textContent = c.icon || '🏆';
            q('d-anello').style.setProperty('--pct', percento);
            q('d-nome').textContent = c.label;
            q('d-completata').hidden = !c.completed;
            q('d-descrizione').textContent = c.description;
            q('d-barra').style.width = percento + '%';
            q('d-progresso').textContent = `${c.count}/${c.target}`;
            q('d-premio').innerHTML = premiHtml(c);
            root.querySelector('.sv-dettaglio').classList.toggle('is-completata', !!c.completed);
            q('dettaglio').hidden = false;
            if (window.NativeHaptics) NativeHaptics.light();
        }
        function chiudiDettaglio() { q('dettaglio').hidden = true; }
        q('chiudi').addEventListener('click', chiudiDettaglio);
        q('dettaglio').addEventListener('click', (e) => { if (e.target === q('dettaglio')) chiudiDettaglio(); });

        function renderMissioni(ambito) {
            const missioni = ChallengeTracker.getMissions(ambito);
            riepilogo(ambito === 'daily' ? 'Missioni di oggi' : 'Missioni della settimana',
                missioni.filter((m) => m.completed).length, missioni.length);
            const griglia = q('griglia');
            griglia.innerHTML = '';
            if (missioni.length === 0) {
                const vuoto = document.createElement('div');
                vuoto.className = 'sv-gruppo';
                vuoto.textContent = 'Nessuna missione disponibile.';
                griglia.appendChild(vuoto);
                return;
            }
            missioni.forEach((m) => disegnaSfida(griglia, m));
        }

        /** Una sezione per campagna, nell'ordine in cui le storie si giocano. */
        function renderStorie() {
            const perStoria = ChallengeTracker.getSezioni().storie;
            const campagne = (typeof storyCampaignsDatabase !== 'undefined') ? storyCampaignsDatabase : [];
            const griglia = q('griglia');
            griglia.innerHTML = '';
            let totali = 0;
            let fatte = 0;
            const ordinate = campagne.length
                ? campagne.map((c) => c.id).filter((id) => perStoria[id])
                : Object.keys(perStoria);
            const gruppi = ordinate.map((id) => {
                const voci = perStoria[id];
                const campagna = campagne.find((c) => c.id === id);
                totali += voci.length;
                fatte += voci.filter((c) => c.completed).length;
                return { titolo: `${(campagna && campagna.icona) || '📖'} ${(campagna && campagna.nome) || id}`, voci: voci };
            });
            disegnaGruppi(griglia, gruppi);
            riepilogo('Sfide delle storie', fatte, totali);
        }

        /** Una sezione per modalità (Puzzle, Rivincite, Torre). */
        function renderModalita() {
            const perModalita = ChallengeTracker.getSezioni().modalita || {};
            const ordine = MODALITA.map((m) => m.id).filter((id) => perModalita[id])
                .concat(Object.keys(perModalita).filter((id) => !MODALITA.some((m) => m.id === id)));
            let totali = 0;
            let fatte = 0;
            const gruppi = ordine.map((id) => {
                const voci = perModalita[id];
                const m = MODALITA.find((x) => x.id === id);
                totali += voci.length;
                fatte += voci.filter((c) => c.completed).length;
                return { titolo: m ? m.titolo : id, voci: voci };
            });
            const griglia = q('griglia');
            griglia.innerHTML = '';
            disegnaGruppi(griglia, gruppi);
            riepilogo('Sfide delle modalità', fatte, totali);
        }

        function refresh() {
            renderRotazione();
            if (sezioneAttiva === 'giornaliere' || sezioneAttiva === 'settimanali') {
                renderMissioni(sezioneAttiva === 'giornaliere' ? 'daily' : 'weekly');
                return;
            }
            if (sezioneAttiva === 'storie') { renderStorie(); return; }
            if (sezioneAttiva === 'modalita') { renderModalita(); return; }
            const sfide = ChallengeTracker.getSezioni().generiche;
            riepilogo('Sfide completate', sfide.filter((c) => c.completed).length, sfide.length);
            const griglia = q('griglia');
            griglia.innerHTML = '';
            disegnaGruppi(griglia, ordinaInGruppi(sfide));
        }

        root.querySelector('.sv-sezioni').addEventListener('click', (e) => {
            const tab = e.target.closest('.sv-tab');
            if (!tab) return;
            sezioneAttiva = tab.dataset.sezione;
            root.querySelectorAll('.sv-tab').forEach((b) => b.classList.toggle('is-attiva', b === tab));
            if (window.NativeHaptics) NativeHaptics.light();
            refresh();
        });

        // La rotazione si appoggia all'orario del SERVER: si chiede subito e
        // si ridisegna quando arriva — intanto la schermata mostra comunque
        // qualcosa, con l'orologio locale e dicendolo.
        refresh();
        if (window.ServerDate) ServerDate.sync().then(refresh).catch(() => {});
        return { refresh: refresh };
    }

    window.SfideView = { mount: mount };
})();
