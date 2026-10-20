/**
 * scelta-duellante.js — La griglia dei Duellanti del Duello Libero, con la
 * barra di ricerca e filtri sopra.
 * =====================================================================
 * COMPONENTE condiviso fra duello-libero.html e la vista Duello Libero del
 * menu (index.html): prima ognuna aveva la sua copia di createCube /
 * renderCubes, già identiche ma pronte a divergere (vedi CLAUDE.md, "viste
 * fuse").
 *
 * Uso:
 *     const griglia = SceltaDuellante.mount(contenitore, {
 *         onScegli: (character) => ...,   // un Duellante sbloccato
 *         toast: (testo) => ...            // messaggio breve (bloccati)
 *     });
 *     griglia.refresh();                   // ridisegna, filtri compresi
 *
 * Richiesta dell'utente ("migliora la ui di duello libero"):
 *  - in cima quanti Duellanti si sono sbloccati, i filtri per serie e la
 *    ricerca per nome: all'inizio sono quasi tutti bloccati, e trovare
 *    qualcuno voleva dire scorrere decine di carte;
 *  - su ogni bloccato DOVE si sblocca (CharacterUnlocks.doveSiSblocca),
 *    invece della stessa frase generica su tutti;
 *  - il record leggibile, e una medaglia per il livello più alto a cui
 *    lo si è battuto (record.migliore, scritto da recordCharacterResult).
 * Le carte restano nello stesso ordine di sempre (per serie, sbloccati e
 * bloccati mescolati): spostare in alto gli sbloccati l'utente non lo ha
 * voluto.
 */
(function () {
    'use strict';

    // Una serie che non è qui finisce comunque in fondo, col suo id grezzo
    // come nome: un personaggio non deve mai sparire per una serie
    // dimenticata.
    const SERIES_ORDER = ['main', 'forbiddenMemories', 'ww1', 'extra', 'special'];
    const SERIES_LABELS = { main: 'Serie Principale', forbiddenMemories: 'Forbidden Memories', ww1: 'Grande Guerra', extra: 'Extra', special: 'Speciali' };
    const MEDAGLIE = {
        Facile: { classe: 'bronzo', testo: 'Battuto a Facile' },
        Medio: { classe: 'argento', testo: 'Battuto a Normale' },
        Difficile: { classe: 'oro', testo: 'Battuto a Difficile' }
    };

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    // Ricerca senza accenti e senza maiuscole: "tea" trova "Téa".
    function normale(t) {
        return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    const roster = () => (typeof characterDatabase !== 'undefined' ? characterDatabase : []);
    const sbloccato = (c) => !(window.CharacterUnlocks && !CharacterUnlocks.sbloccato(c.id));

    function miniaturaRitratto(percorso) {
        const parti = String(percorso || '').split('/');
        const nome = (parti.pop() || '').replace(/\.[^.]+$/, '');
        return nome ? `images/characters/thumbs/${nome}.webp` : percorso;
    }

    function creaCarta(character, opzioni, prioritaria) {
        const record = (typeof getCharacterRecord === 'function') ? getCharacterRecord(character.id) : { wins: 0, losses: 0 };
        const bloccato = !sbloccato(character);
        const cube = document.createElement('div');
        cube.className = 'cube' + (bloccato ? ' cube--bloccato' : '');
        cube.dataset.id = character.id;
        cube.setAttribute('role', 'button');
        cube.tabIndex = 0;

        let sotto;
        if (bloccato) {
            const luoghi = window.CharacterUnlocks && CharacterUnlocks.doveSiSblocca ? CharacterUnlocks.doveSiSblocca(character) : [];
            const primo = luoghi[0] || 'Torneo o Storia';
            const altri = luoghi.length > 1 ? ` <span class="sd-altri">+${luoghi.length - 1}</span>` : '';
            sotto = `<div class="cube-locked"><span class="sd-dove">Si sblocca in</span> ${esc(primo)}${altri}</div>`;
        } else {
            const medaglia = MEDAGLIE[record.migliore];
            sotto = `<div class="sd-record">
                    <span class="sd-v">${record.wins || 0}<small>V</small></span>
                    <span class="sd-s">${record.losses || 0}<small>S</small></span>
                    ${medaglia ? `<span class="sd-medaglia sd-medaglia--${medaglia.classe}" title="${medaglia.testo}">${medaglia.testo.replace('Battuto a ', '')}</span>` : ''}
                </div>`;
        }
        cube.innerHTML = `
            <div class="cube-portrait">
                <span class="cube-portrait-fallback">🧑‍🎤</span>
                <div class="cube-name"></div>
            </div>
            <div class="cube-info">
                <div class="cube-title"></div>
                ${sotto}
            </div>`;
        cube.querySelector('.cube-name').textContent = character.name;
        cube.querySelector('.cube-title').textContent = character.title || '';

        const img = document.createElement('img');
        img.alt = character.name;
        // I primi ritratti sono gia' dentro il viewport: marcarli lazy fa
        // comparire per un istante il fallback anche con una rete veloce.
        // Tutti gli altri restano pigri e vengono decodificati fuori dal
        // thread che sta costruendo la griglia.
        img.loading = prioritaria ? 'eager' : 'lazy';
        img.fetchPriority = prioritaria ? 'high' : 'low';
        img.decoding = 'async';
        img.width = 512;
        img.height = 512;
        img.onload = () => { const f = cube.querySelector('.cube-portrait-fallback'); if (f) f.remove(); };
        img.onerror = () => {
            // Compatibilita' con salvataggi/personaggi custom o una nuova
            // immagine aggiunta prima di rigenerare le miniature.
            if (img.dataset.originalFallback !== '1' && character.image) {
                img.dataset.originalFallback = '1';
                img.src = character.image;
            } else img.remove();
        };
        img.src = miniaturaRitratto(character.image);
        cube.querySelector('.cube-portrait').insertBefore(img, cube.querySelector('.cube-name'));

        const scegli = () => {
            if (bloccato) {
                if (opzioni.toast && window.CharacterUnlocks) opzioni.toast('🔒 ' + CharacterUnlocks.comeSbloccare(character));
                return;
            }
            if (opzioni.onScegli) opzioni.onScegli(character);
        };
        cube.onclick = scegli;
        cube.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegli(); } };
        return cube;
    }

    function mount(contenitore, opzioni) {
        const el = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!el) return { refresh() {} };
        opzioni = opzioni || {};
        const stato = { serie: 'tutte', cerca: '' };
        el.classList.add('scelta-duellante');

        el.innerHTML = `
            <div class="sd-barra">
                <div class="sd-conta" data-sd="conta"></div>
                <div class="sd-filtri" data-sd="filtri" role="group" aria-label="Filtra per serie"></div>
                <label class="sd-cerca">
                    <span class="sd-cerca-ic" aria-hidden="true">⌕</span>
                    <input type="search" data-sd="cerca" placeholder="Cerca un Duellante" aria-label="Cerca un Duellante per nome">
                </label>
            </div>
            <div data-sd="griglia"></div>
            <div class="sd-vuoto" data-sd="vuoto" hidden>Nessun Duellante con questo nome.</div>`;

        const input = el.querySelector('[data-sd="cerca"]');
        input.addEventListener('input', () => { stato.cerca = input.value; applicaFiltri(); });

        function perSerie() {
            const mappa = new Map();
            roster().forEach((c) => {
                const k = c.series || 'main';
                if (!mappa.has(k)) mappa.set(k, []);
                mappa.get(k).push(c);
            });
            const chiavi = SERIES_ORDER.concat([...mappa.keys()].filter((k) => SERIES_ORDER.indexOf(k) === -1));
            return chiavi.filter((k) => mappa.has(k)).map((k) => ({ chiave: k, nome: SERIES_LABELS[k] || k, elenco: mappa.get(k) }));
        }

        function disegna() {
            const gruppi = perSerie();
            const tutti = roster();
            const liberi = tutti.filter(sbloccato).length;
            const pct = tutti.length ? Math.round((liberi / tutti.length) * 100) : 0;
            el.querySelector('[data-sd="conta"]').innerHTML =
                `<strong>${liberi}</strong><span>/ ${tutti.length} sbloccati</span><span class="sd-conta-barra"><span style="width:${pct}%"></span></span>`;

            const filtri = el.querySelector('[data-sd="filtri"]');
            filtri.innerHTML = '';
            [{ chiave: 'tutte', nome: 'Tutte', n: tutti.length }].concat(gruppi.map((g) => ({ chiave: g.chiave, nome: g.nome, n: g.elenco.length })))
                .forEach((f) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'sd-chip' + (stato.serie === f.chiave ? ' is-on' : '');
                    b.setAttribute('aria-pressed', stato.serie === f.chiave ? 'true' : 'false');
                    b.innerHTML = `${esc(f.nome)} <span>${f.n}</span>`;
                    b.onclick = () => { stato.serie = f.chiave; disegna(); };
                    filtri.appendChild(b);
                });

            const griglia = el.querySelector('[data-sd="griglia"]');
            griglia.innerHTML = '';
            let indiceRitratto = 0;
            gruppi.forEach((g) => {
                const sezione = document.createElement('div');
                sezione.className = 'series-section';
                sezione.dataset.serie = g.chiave;
                const liberiQui = g.elenco.filter(sbloccato).length;
                sezione.innerHTML = `<div class="series-title"><span>${esc(g.nome)}</span><span class="series-count">${liberiQui}/${g.elenco.length}</span></div>`;
                const grid = document.createElement('div');
                grid.className = 'cube-grid';
                g.elenco.forEach((c, k) => {
                    const cubo = creaCarta(c, opzioni, indiceRitratto < 8);
                    if (window.Fluido && indiceRitratto < 28) Fluido.rivela(cubo, k);   // solo i primi (quelli in vista): il resto compare e basta
                    grid.appendChild(cubo);
                    indiceRitratto++;
                });
                sezione.appendChild(grid);
                griglia.appendChild(sezione);
            });
            applicaFiltri();
        }

        function applicaFiltri() {
            const testo = normale(stato.cerca.trim());
            let visibili = 0;
            el.querySelectorAll('.series-section').forEach((sezione) => {
                const serieOk = stato.serie === 'tutte' || sezione.dataset.serie === stato.serie;
                let quiVisibili = 0;
                sezione.querySelectorAll('.cube').forEach((cube) => {
                    const c = roster().find((x) => x.id === cube.dataset.id);
                    const ok = serieOk && (!testo || normale(c && c.name).indexOf(testo) !== -1);
                    cube.hidden = !ok;
                    if (ok) quiVisibili++;
                });
                sezione.hidden = quiVisibili === 0;
                visibili += quiVisibili;
            });
            el.querySelector('[data-sd="vuoto"]').hidden = visibili > 0;
        }

        disegna();
        return { refresh: disegna };
    }

    window.SceltaDuellante = { mount: mount };
})();
