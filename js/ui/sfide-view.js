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
        { type: 'sfideCompletate', titolo: '⏳ Traguardo finale' },
        { type: 'winDuels', titolo: '🏆 Traguardi' },
        { type: 'defeatCharacter', titolo: '⚔️ Duellanti da battere' },
        { type: 'summonMonster', titolo: '✨ Mostri da evocare' },
        { type: 'activateCard', titolo: '🎴 Carte da attivare' },
        { type: 'perfectWin', titolo: '💎 Vittorie perfette' },
        { type: 'winLowLp', titolo: '🩸 Vittorie al limite' },
        { type: 'winFast', titolo: '⚡ Vittorie lampo' },
        { type: 'packOpened', titolo: '📦 Buste' },
        { type: 'tutorialLezione', titolo: '🎓 Tutorial' },
        { type: 'winInstantly', titolo: '🧩 Vittorie alternative' },
        { type: 'completeTournament', titolo: '🏟️ Tornei' },
        { type: 'winMillenniumItem', titolo: '🔱 Oggetti del Millennio' }
    ];

    const SEZIONI = [
        { id: 'giornaliere', etichetta: 'Oggi', icona: 'star' },
        { id: 'settimanali', etichetta: 'Settimana', icona: 'calendar' },
        { id: 'generiche', etichetta: 'Sfide', icona: 'tournament' },
        { id: 'storie', etichetta: 'Storie', icona: 'story' },
        { id: 'modalita', etichetta: 'Modalità', icona: 'sandbox' }
    ];

    // Titolo e ordine dei gruppi nella sezione "Modalità": la chiave è il
    // campo `modalita` delle sfide in challenges-db.js. Una modalità non
    // elencata qui compare comunque, in fondo, col suo id.
    const MODALITA = [
        { id: 'puzzle', titolo: '🧩 Puzzle' },
        { id: 'rivincite', titolo: '⚔️ Rivincite' },
        { id: 'torre', titolo: '🗼 Torre dei Duellanti' },
        { id: 'settimana', titolo: '📅 Duello della Settimana' },
        { id: 'caccia', titolo: '🏹 Caccia al Boss' },
        { id: 'tag', titolo: '🤝 Tag Team' },
        { id: 'online', titolo: '🌐 Battaglie online' }
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
            <div class="sv-fisso">
                <div class="sv-sezioni" role="tablist">
                    ${SEZIONI.map((s, i) => `<button type="button" class="sv-tab${i === 0 ? ' is-attiva' : ''}" data-sezione="${s.id}" role="tab"><span class="sv-tab-icona" data-icon="${s.icona}"></span><span class="sv-tab-nome">${s.etichetta}</span></button>`).join('')}
                    <span class="sv-tab-barra" aria-hidden="true"></span>
                </div>
            </div>
            <div class="sv-corpo">
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
            </div>
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

        function disegna() {
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
        // Le icone delle Sfide e i titoli dei gruppi nascono come emoji: si cambiano con le icone del tema (ogni emoji sconosciuta
        // diventa la medaglia), come le icone delle schede.
        function refresh() {
            disegna();
            if (window.EmojiTema) EmojiTema.idrata(root, { fallback: 'medal' });
        }

        // ---- Schede FISSE in alto (sotto la fotocamera) e SWIPE laterale sul contenuto, come nel menu principale.
        const ORDINE = SEZIONI.map((s) => s.id);
        const barra = root.querySelector('.sv-tab-barra');
        const corpo = root.querySelector('.sv-corpo');
        const riduciMovimento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        function posizionaBarra() {
            const tab = root.querySelector('.sv-tab.is-attiva');
            if (!tab || !tab.offsetWidth) return;
            barra.style.width = tab.offsetWidth + 'px';
            barra.style.transform = 'translateX(' + tab.offsetLeft + 'px)';
        }
        /** direzione: +1 la nuova sezione sta a destra (il contenuto entra da destra), -1 a sinistra, 0 senza animazione. */
        function vaiSezione(id, direzione) {
            if (id === sezioneAttiva) return;
            sezioneAttiva = id;
            root.querySelectorAll('.sv-tab').forEach((b) => {
                const attiva = b.dataset.sezione === id;
                b.classList.toggle('is-attiva', attiva);
                b.setAttribute('aria-selected', String(attiva));
            });
            posizionaBarra();
            refresh();
            if (direzione && !riduciMovimento) {
                try { corpo.animate([{ transform: 'translateX(' + (direzione * 46) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }); } catch (e) { /* cambia lo stesso */ }
            }
            const alto = root.querySelector('.sv-fisso').getBoundingClientRect().bottom;
            if (corpo.getBoundingClientRect().top < alto) corpo.scrollIntoView({ block: 'start' });
        }
        root.querySelector('.sv-sezioni').addEventListener('click', (e) => {
            const tab = e.target.closest('.sv-tab');
            if (!tab) return;
            const verso = ORDINE.indexOf(tab.dataset.sezione) > ORDINE.indexOf(sezioneAttiva) ? 1 : -1;
            if (window.NativeHaptics) NativeHaptics.light();
            vaiSezione(tab.dataset.sezione, verso);
        });
        (function swipe() {
            let x0 = null, y0 = 0, t0 = 0, orizzontale = false, verticale = false, dx = 0;
            corpo.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1 || !q('dettaglio').hidden) { x0 = null; return; }
                x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
                orizzontale = verticale = false; dx = 0;
            }, { passive: true });
            corpo.addEventListener('touchmove', (e) => {
                if (x0 === null || verticale) return;
                const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
                if (!orizzontale) {
                    if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { verticale = true; return; }
                    if (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.4) return;
                    orizzontale = true;
                }
                const i = ORDINE.indexOf(sezioneAttiva);
                const senzaVicina = (mx > 0 && i === 0) || (mx < 0 && i === ORDINE.length - 1);
                dx = senzaVicina ? mx * 0.25 : mx;
                corpo.style.transform = 'translateX(' + dx + 'px)';
                corpo.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (corpo.clientWidth * 1.1)));
            }, { passive: true });
            corpo.addEventListener('touchend', () => {
                if (x0 === null || !orizzontale) { x0 = null; return; }
                const veloce = Math.abs(dx) > 40 && Date.now() - t0 < 320;
                const lungo = Math.abs(dx) > corpo.clientWidth * 0.22;
                const i = ORDINE.indexOf(sezioneAttiva);
                const prossima = dx < 0 ? i + 1 : i - 1;
                corpo.style.transform = ''; corpo.style.opacity = '';
                x0 = null;
                if ((veloce || lungo) && prossima >= 0 && prossima < ORDINE.length) {
                    if (window.NativeHaptics) NativeHaptics.light();
                    vaiSezione(ORDINE[prossima], dx < 0 ? 1 : -1);
                } else if (Math.abs(dx) > 4 && !riduciMovimento) {
                    try { corpo.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }); } catch (e) { /* torna al posto */ }
                }
            }, { passive: true });
            corpo.addEventListener('touchcancel', () => { corpo.style.transform = ''; corpo.style.opacity = ''; x0 = null; }, { passive: true });
        })();
        if (window.Icons) Icons.hydrate(root.querySelector('.sv-sezioni'));
        const fissoSv = root.querySelector('.sv-fisso');

        // Barra agganciata: la fascia sopra di lei (la fotocamera) si copre solo da quel momento (classe is-agganciata).
        (function osservaAggancio() {
            let attesa = 0;
            const controlla = () => {
                attesa = 0;
                const alto = parseFloat(getComputedStyle(fissoSv).top) || 0;
                fissoSv.classList.toggle('is-agganciata', fissoSv.getBoundingClientRect().top <= alto + 0.5 && window.scrollY > 4);
            };
            window.addEventListener('scroll', () => { if (!attesa) attesa = requestAnimationFrame(controlla); }, { passive: true });
            controlla();
        })();
        window.addEventListener('resize', posizionaBarra);
        requestAnimationFrame(posizionaBarra);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(posizionaBarra);

        // La rotazione si appoggia all'orario del SERVER: si chiede subito e
        // si ridisegna quando arriva — intanto la schermata mostra comunque
        // qualcosa, con l'orologio locale e dicendolo.
        refresh();
        if (window.ServerDate) ServerDate.sync().then(refresh).catch(() => {});
        return { refresh: refresh };
    }

    window.SfideView = { mount: mount };
})();
