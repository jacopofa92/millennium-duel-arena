// @ts-check
/**
 * menu-mobile.js — il menu principale in versione "app" (nata su telefono, ora su ogni schermo).
 * ------------------------------------------------------------------------------------------------
 * Il menu a elenco verticale con sottomenu a scendere (Duelli > Campagna > Storia) e' fatto per un cursore: su un telefono costa
 * un tocco in piu' a ogni livello, e il pollice deve arrivare in alto per tornare indietro. Qui lo stesso contenuto e' una UI da
 * gioco mobile:
 *   - una BARRA DI TAB in basso (Duelli, Carte, Online, Altro) alla portata del pollice, sempre visibile; Sfide sta in testa a Duelli;
 *   - una barra giocatore in alto (nome, crediti, Stelle) che da' subito il senso dell'avanzamento;
 *   - niente drill-down: Duelli mostra i suoi gruppi (Campagna, Settimanali, Allenamento) come SEZIONI di tessere, la prima voce di
 *     ogni sezione e' una tessera larga "in evidenza";
 *   - "Altro" e' un foglio con Profilo, Impostazioni, (Admin) e Logout.
 *
 * NON ha dati suoi: legge le voci dello STESSO elenco del menu desktop (`voci`, FULL_MENU_ITEMS di index.html), quindi una voce nuova
 * compare qui da sola. Le uniche cose scritte qui sono i sottotitoli (`SOTTOTITOLI`, per etichetta) e quale voce sta in quale tab.
 * Vale su OGNI schermo (telefono e desktop): sul desktop ha piu' colonne e una larghezza massima, la barra di tab e' centrata.
 */
(function () {
    'use strict';

    const QUERY = '(pointer: coarse) and (max-width: 1000px)';
    const CHIAVE_TAB = 'ygoMenuTab';

    /** Una frase corta sotto il nome di ogni voce: sul telefono una tessera senza spiegazione e' solo un'icona. */
    const SOTTOTITOLI = {
        'Storia': 'La saga, a capitoli',
        'Tornei': 'Scala la classifica',
        'Torre dei Duellanti': 'Venti piani, un solo percorso',
        'Rivincite': 'Rigioca i rivali battuti',
        'Duello della Settimana': 'Una regola nuova ogni lunedì',
        'Caccia al Boss': '8 turni per abbatterlo',
        'Duello Libero': 'Scegli avversario e arena',
        'Puzzle': 'Vinci con la mano data',
        'Tutorial': 'Impara a giocare',
        'Demo Duello Sandbox': 'Campo di prova (admin)',
        'Negozio': 'Pacchetti e mazzi',
        'Cartoteca': 'La tua collezione',
        'Creazione Deck': 'Costruisci il tuo mazzo',
        'Creazione': 'Inventa le tue carte',
        'Profilo': 'Statistiche e titoli',
        'Impostazioni': 'Audio, video, regole',
        'Admin': 'Pannello amministratore',
        'Logout': 'Cambia account'
    };

    /** @param {string} s */
    function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c)); }

    /** Ogni quanti millisecondi la barra giocatore passa alla schermata successiva (valute, altre valute, titolo). */
    const ROTAZIONE_MS = 3500;
    /** @type {any} */
    let rotazione = null;
    function fermaRotazione() { if (rotazione) { clearInterval(rotazione); rotazione = null; } }

    /** Verso dell'ultimo cambio di tab (+1 = verso destra): serve a far scorrere il contenuto nuovo dalla parte giusta. */
    let direzione = 0;

    const mq = window.matchMedia ? window.matchMedia(QUERY) : null;
    // Dopo la prova sul telefono (l'utente: "puo' andare anche per desktop") la veste app vale OVUNQUE: il menu e' lo stesso su ogni schermo,
    // cambiano solo le misure (colonne, larghezza massima). mq resta esposto: serve a tab-bar.js e ai ridisegni, non decide piu'.
    function attivo() { return true; }

    /** @param {any[]} voci @param {string} etichetta */
    function trova(voci, etichetta) { return voci.find((v) => v.label === etichetta) || null; }

    /**
     * Le tab. Ognuna ha un titolo, un'icona e come si riempie: `gruppi` = sezioni di tessere; `link` = la tab apre direttamente una
     * pagina; `foglio` = un elenco di voci semplici.
     * @param {any[]} voci @param {boolean} admin @param {any} adminItem
     */
    function costruisciTab(voci, admin, adminItem) {
        const duelli = trova(voci, 'Duelli');
        const carte = trova(voci, 'Carte');
        const online = trova(voci, 'Multiplayer');
        const sfide = trova(voci, 'Sfide');
        const altre = [trova(voci, 'Profilo'), trova(voci, 'Impostazioni')].filter(Boolean);
        if (admin && adminItem) altre.push(adminItem);
        const logout = trova(voci, 'Logout');
        /** @type {any[]} */
        const tab = [];
        if (duelli) {
            // Sfide NON e' una tab (la barra ne ha quattro): sta in testa a Duelli, la prima cosa che si vede, perche' sono le missioni da
            // rifare ogni giorno e il motivo per tornare nel gioco.
            const sfideEvidenza = sfide ? [{ titolo: 'Sfide', icona: sfide.icon, voci: [Object.assign({}, sfide, { sottotitolo: 'Missioni del giorno e traguardi' })] }] : [];
            // Un gruppo e' una voce con `children`; una voce semplice (la Demo del Sandbox) finisce in "Altri".
            const gruppi = (duelli.children || []).filter((c) => c.children).map((g) => ({ titolo: g.label, icona: g.icon, voci: g.children }));
            const sciolte = (duelli.children || []).filter((c) => !c.children && (!c.soloAdmin || admin));
            if (sciolte.length) gruppi.push({ titolo: 'Strumenti', icona: 'settings', voci: sciolte });
            tab.push({ id: 'duelli', titolo: 'Duelli', icona: duelli.icon, gruppi: sfideEvidenza.concat(gruppi) });
        }
        if (carte) tab.push({ id: 'carte', titolo: 'Carte', icona: carte.icon, gruppi: [{ titolo: 'La tua collezione', icona: carte.icon, voci: carte.children || [] }] });
        if (online) tab.push({ id: 'online', titolo: 'Online', icona: online.icon, gruppi: [{ titolo: 'Multiplayer', icona: online.icon, voci: online.children || [] }] });
        tab.push({ id: 'altro', titolo: 'Altro', icona: 'settings', foglio: altre, logout });
        return tab;
    }

    /** @param {any} ctx */
    function render(ctx) {
        const { shell, lista, voci, admin, adminItem, azione, stato, toast } = ctx;
        shell.classList.add('menu-shell--app');
        const tab = costruisciTab(voci, admin, adminItem);
        let corrente = 'duelli';
        try { corrente = sessionStorage.getItem(CHIAVE_TAB) || 'duelli'; } catch (e) { /* noop */ }
        if (!tab.some((t) => t.id === corrente && !t.link)) corrente = 'duelli';
        const attiva = tab.find((t) => t.id === corrente) || tab[0];

        /** @param {any} item @param {boolean} larga */
        function tessera(item, larga) {
            const acc = item.richiedeModalita && window.ModeUnlocks ? window.ModeUnlocks.stato(item.richiedeModalita) : { sbloccato: true, motivo: '' };
            const sotto = item.sottotitolo || SOTTOTITOLI[item.label] || '';
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mm-tessera' + (larga ? ' mm-tessera--larga' : '') + (!acc.sbloccato ? ' mm-tessera--bloccata' : '');
            b.innerHTML = `<span class="mm-tessera-icona" data-icon="${esc(item.icon)}"></span>`
                + `<span class="mm-tessera-testi"><span class="mm-tessera-nome">${esc(item.label)}</span>`
                + (sotto ? `<span class="mm-tessera-sotto">${esc(!acc.sbloccato ? '🔒 Da sbloccare' : sotto)}</span>` : '')
                + '</span>';
            b.addEventListener('click', () => {
                if (!acc.sbloccato) { toast('🔒 ' + acc.motivo); if (window.NativeHaptics) window.NativeHaptics.light(); return; }
                if (window.NativeHaptics) window.NativeHaptics.light();
                azione(item);
            });
            return b;
        }

        // ---- intestazione: nome, crediti, Stelle
        let nome = 'Duellante', cr = 0, st = 0, lo = 0, mi = 0, titolo = '';
        try {
            nome = window.SaveManager.getPlayerName() || nome;
            const c = window.SaveManager.getCurrency(); cr = c.credits || 0; st = c.starChips || 0; lo = c.locatorCards || 0; mi = c.millenniumCards || 0;
        } catch (e) { /* noop */ }
        try { if (window.ProfileHero) titolo = window.ProfileHero.calcola(window.SaveManager.load()).titolo || ''; } catch (e) { /* il titolo e' un di piu' */ }
        const fmt = (n) => (n >= 1e7 ? Math.round(n / 1e6) + 'M' : String(n));
        lista.innerHTML = '';
        lista.className = 'menu-list mm-lista';
        const testa = document.createElement('div');
        testa.className = 'mm-testa';
        testa.innerHTML = `<div class="mm-giocatore"><span class="mm-avatar" data-icon="profile"></span><span class="mm-nome">${esc(nome)}</span></div>`
            // A ROTAZIONE (ROTAZIONE_MS): Crediti e Stelle, poi Carte Locazione e Carte del Millennio, poi il titolo del giocatore. Le tre schermate
            // stanno una SOPRA l'altra nella stessa cella (grid), cosi' il box non cambia mai larghezza e non salta nulla.
            + '<div class="mm-valute">'
            + `<div class="mm-slide is-on"><span class="mm-valuta" title="Crediti"><span class="mm-vi" data-icon="coin"></span>${fmt(cr)}</span>`
            + `<span class="mm-valuta" title="Stelle"><span class="mm-vi" data-icon="star"></span>${fmt(st)}</span></div>`
            + `<div class="mm-slide"><span class="mm-valuta" title="Carte Locazione"><span class="mm-vi" data-icon="map"></span>${fmt(lo)}</span>`
            + `<span class="mm-valuta" title="Carte del Millennio"><span class="mm-vi" data-icon="eye"></span>${fmt(mi)}</span></div>`
            + (titolo ? `<div class="mm-slide"><span class="mm-titolo-giocatore">${esc(titolo)}</span></div>` : '')
            + '</div>';
        lista.appendChild(testa);
        fermaRotazione();
        const slide = testa.querySelectorAll('.mm-slide');
        if (slide.length > 1 && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            let k = 0;
            rotazione = setInterval(() => {
                if (!testa.isConnected) { fermaRotazione(); return; }   // il menu e' stato ridisegnato: questa copia non serve piu'
                slide[k].classList.remove('is-on');
                k = (k + 1) % slide.length;
                slide[k].classList.add('is-on');
            }, ROTAZIONE_MS);
        }

        // ---- contenuto della tab
        const corpo = document.createElement('div');
        corpo.className = 'mm-corpo' + (direzione ? (direzione > 0 ? ' mm-da-destra' : ' mm-da-sinistra') : '');
        direzione = 0;
        corpo.innerHTML = `<h2 class="mm-titolo">${esc(attiva.titolo)}</h2>`;
        if (attiva.gruppi) {
            attiva.gruppi.forEach((g) => {
                const sez = document.createElement('section');
                sez.className = 'mm-sezione';
                const visibili = g.voci.filter((v) => !v.soloAdmin || admin);
                if (attiva.gruppi.length > 1) sez.innerHTML = `<h3 class="mm-sezione-titolo"><span data-icon="${esc(g.icona)}"></span>${esc(g.titolo)}</h3>`;
                const griglia = document.createElement('div');
                griglia.className = 'mm-griglia';
                griglia.dataset.n = String(visibili.length);   // il CSS dei desktop sceglie le colonne dal numero di tessere (4 -> una riga sola)
                visibili.forEach((v, i) => {
                    const mp = v.href && v.href.indexOf('multiplayer.html') === 0 && window.MP_MODI
                        ? window.MP_MODI.find((m) => v.href.indexOf('modo=' + m.id) >= 0) : null;
                    const item = mp ? Object.assign({}, v, { sottotitolo: String(mp.descrizione || '').split(/[.:]/)[0] }) : v;
                    // Due colonne; con un numero DISPARI di voci la prima e' larga "in evidenza" (cosi' non resta mai un buco).
                    griglia.appendChild(tessera(item, visibili.length % 2 === 1 && i === 0));
                });
                sez.appendChild(griglia);
                corpo.appendChild(sez);
            });
        }
        if (attiva.foglio) {
            const griglia = document.createElement('div');
            griglia.className = 'mm-griglia mm-griglia--una';
            attiva.foglio.forEach((v) => griglia.appendChild(tessera(v, false)));
            corpo.appendChild(griglia);
            if (attiva.logout) {
                const esci = tessera(attiva.logout, false);
                esci.classList.add('mm-tessera--esci');
                corpo.appendChild(esci);
            }
            const ver = document.createElement('p');
            ver.className = 'mm-versione';
            ver.textContent = 'Versione ' + (window.GAME_VERSION || '');
            corpo.appendChild(ver);
        }
        lista.appendChild(corpo);

        // ---- barra delle tab, in basso
        const barra = document.createElement('nav');
        barra.className = 'mm-barra';
        barra.setAttribute('aria-label', 'Menu principale');
        tab.forEach((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mm-tab' + (t.id === corrente ? ' mm-tab--attiva' : '');
            b.innerHTML = `<span class="mm-tab-icona" data-icon="${esc(t.icona)}"></span><span class="mm-tab-nome">${esc(t.titolo)}</span>`;
            b.addEventListener('click', () => {
                if (window.NativeHaptics) window.NativeHaptics.light();
                if (t.link) { window.location.href = t.link; return; }
                try { sessionStorage.setItem(CHIAVE_TAB, t.id); } catch (e) { /* noop */ }
                stato.ridisegna();
            });
            barra.appendChild(b);
        });
        lista.appendChild(barra);
        if (window.Icons) window.Icons.hydrate(lista);

        // ---- SWIPE fra le tab: un gesto orizzontale deciso (almeno 60px, piu' largo che alto, entro 0,7 s) passa alla tab accanto, come in un'app.
        // Le proprieta' on... (e non addEventListener) perche' la lista e' LA STESSA a ogni ridisegno: i listener si accumulerebbero.
        const ordine = tab.map((t) => t.id);
        const vai = (verso) => {
            const i = ordine.indexOf(corrente) + verso;
            if (i < 0 || i >= ordine.length) return;
            direzione = verso;
            try { sessionStorage.setItem(CHIAVE_TAB, ordine[i]); } catch (e) { /* noop */ }
            if (window.NativeHaptics) window.NativeHaptics.light();
            stato.ridisegna();
        };
        let x0 = null, y0 = 0, t0 = 0;
        lista.ontouchstart = (e) => {
            if (e.touches.length !== 1) { x0 = null; return; }
            x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
        };
        lista.ontouchend = (e) => {
            if (x0 === null) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - x0, dy = t.clientY - y0;
            x0 = null;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - t0 < 700) vai(dx < 0 ? 1 : -1);
        };
        lista.ontouchcancel = () => { x0 = null; };
    }

    /** Spegne la veste "app" (il menu torna quello di sempre): serve quando la finestra esce dal telefono. */
    function spegni(shell, lista) {
        lista.ontouchstart = lista.ontouchend = lista.ontouchcancel = null;
        fermaRotazione();
        shell.classList.remove('menu-shell--app');
        lista.className = 'menu-list';
    }

    window.MenuMobile = { attivo, render, spegni, mq, tabCorrente: () => { try { return sessionStorage.getItem(CHIAVE_TAB) || 'duelli'; } catch (e) { return 'duelli'; } } };
})();
