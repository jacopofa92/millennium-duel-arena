/**
 * sala-ingresso.js — la schermata PRIMA della sala: aprire una stanza o entrare con un codice (anteprima, nessuna rete).
 * ----------------------------------------------------------------------------------------------------------------------
 * Come la sala a tavolo e' un componente CONTROLLATO: disegna lo stato (`imposta`) ed emette i gesti (`su`).
 * Le due azioni sono due porte affiancate (impilate su telefono): "Apri una stanza" (sei l'host) ed "Entra con un codice" (cinque
 * caselle, come il codice che si vede in sala; incolla e Invio funzionano). Il server e' una pillola di stato, con l'indirizzo
 * dentro un riquadro "Avanzate": chi non ne ha bisogno non lo vede nemmeno.
 *
 * Forma dello stato:
 *   {
 *     modo: { titolo, descrizione, icona? }, premi?: 'riga di riepilogo dei premi',
 *     server: { stato: 'online' | 'sveglia' | 'offline', url },
 *     fase: 'riposo' | 'collego' | 'errore', azione?: 'crea' | 'entra', messaggio?: string
 *   }
 * Eventi: 'crea'() · 'entra'(codice) · 'server'(url) · 'annulla'() · 'riprova'()
 */
(function () {
    'use strict';

    const el = (tag, classe, testo) => {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (testo != null) e.textContent = testo;
        return e;
    };
    const LUNGHEZZA = 5;
    const ALFABETO = /[A-Z0-9]/;
    const tocco = () => { try { if (window.NativeHaptics && window.NativeHaptics.light) window.NativeHaptics.light(); } catch (e) { /* senza vibrazione */ } };

    function icona(nome) {
        return (nome && window.Icons && window.Icons.buildIcon) ? window.Icons.buildIcon(nome) : null;
    }

    function monta(radice) {
        const gestori = {};
        const emetti = (nome, dato) => (gestori[nome] || []).forEach((fn) => fn(dato));
        let stato = null;
        let caselle = [];
        let costruito = false;

        radice.classList.add('si-ingresso');

        // Le parti che non cambiano mai si costruiscono una volta sola, cosi' il fuoco sulle caselle non salta ad ogni disegno.
        const hero = el('header', 'si-hero');
        const sigillo = el('div', 'si-sigillo');
        const titolo = el('h1', 'si-titolo');
        const descr = el('p', 'si-descr');
        const premi = el('p', 'si-premi');
        hero.append(sigillo, titolo, descr, premi);

        const porte = el('div', 'si-porte');

        // Porta 1: apri una stanza
        const portaCrea = el('section', 'si-porta si-porta--crea');
        portaCrea.innerHTML = '<h2>Apri una stanza</h2><p>Sei l\'host: scegli le regole e invita chi vuoi con il codice.</p>';
        const btnCrea = el('button', 'si-btn si-btn--oro', 'Apri la stanza');
        btnCrea.type = 'button';
        btnCrea.onclick = () => { tocco(); emetti('crea'); };
        portaCrea.append(btnCrea);

        // Porta 2: entra con un codice
        const portaEntra = el('section', 'si-porta si-porta--entra');
        portaEntra.innerHTML = '<h2>Entra con un codice</h2><p>Hai ricevuto un codice da un amico? Scrivilo qui.</p>';
        const riga = el('div', 'si-codice');
        riga.setAttribute('role', 'group');
        riga.setAttribute('aria-label', 'Codice della stanza');
        const btnEntra = el('button', 'si-btn si-btn--ciano', 'Entra');
        btnEntra.type = 'button';
        btnEntra.disabled = true;
        /**
         * Scrivendo il codice compare la tastiera, che su telefono copre il fondo dello schermo: la scheda con le caselle deve restare in
         * vista. Non ci si fida di `visualViewport` (su alcuni Chrome/WebView la tastiera non lo riduce): si da' alla pagina spazio sotto
         * (`is-tastiera`) e si porta la scheda in CIMA alla vista, dove nessuna tastiera arriva. Si ripete un paio di volte perche'
         * la tastiera impiega un attimo ad aprirsi e ridimensiona la pagina mentre lo fa.
         */
        let timerVista = [];
        const tastieraAperta = (aperta) => {
            timerVista.forEach(clearTimeout);
            timerVista = [];
            radice.classList.toggle('is-tastiera', aperta);
            if (!aperta) return;
            const portaInVista = () => { if (radice.classList.contains('is-tastiera')) portaEntra.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
            [60, 350, 800].forEach((ms) => timerVista.push(setTimeout(portaInVista, ms)));
        };
        const codiceCorrente = () => caselle.map((c) => c.value).join('');
        const aggiornaBottone = () => { btnEntra.disabled = codiceCorrente().length < LUNGHEZZA; };
        const entra = () => { if (codiceCorrente().length === LUNGHEZZA) { tocco(); emetti('entra', codiceCorrente()); } };
        for (let i = 0; i < LUNGHEZZA; i++) {
            const c = el('input', 'si-casella');
            c.type = 'text';
            c.inputMode = 'text';
            c.maxLength = 1;
            c.autocomplete = 'off';
            c.autocapitalize = 'characters';
            c.spellcheck = false;
            c.setAttribute('aria-label', `Carattere ${i + 1} del codice`);
            c.addEventListener('input', () => {
                const v = c.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                c.value = v.slice(-1);
                if (c.value && i < LUNGHEZZA - 1) caselle[i + 1].focus();
                aggiornaBottone();
            });
            c.addEventListener('keydown', (ev) => {
                if (ev.key === 'Backspace' && !c.value && i > 0) { caselle[i - 1].focus(); caselle[i - 1].value = ''; aggiornaBottone(); ev.preventDefault(); }
                else if (ev.key === 'ArrowLeft' && i > 0) caselle[i - 1].focus();
                else if (ev.key === 'ArrowRight' && i < LUNGHEZZA - 1) caselle[i + 1].focus();
                else if (ev.key === 'Enter') entra();
            });
            c.addEventListener('focus', () => { c.select(); tastieraAperta(true); });
            c.addEventListener('blur', () => {
                // Passando da una casella alla successiva il fuoco esce e rientra: si chiude solo se non rientra in nessuna.
                setTimeout(() => { if (!caselle.includes(/** @type {any} */ (document.activeElement))) tastieraAperta(false); }, 160);
            });
            // Incollare un codice intero lo distribuisce sulle caselle.
            c.addEventListener('paste', (ev) => {
                const testo = ((ev.clipboardData && ev.clipboardData.getData('text')) || '').toUpperCase().split('').filter((x) => ALFABETO.test(x)).slice(0, LUNGHEZZA);
                if (!testo.length) return;
                ev.preventDefault();
                caselle.forEach((x, k) => { x.value = testo[k] || ''; });
                caselle[Math.min(testo.length, LUNGHEZZA - 1)].focus();
                aggiornaBottone();
            });
            caselle.push(c);
            riga.append(c);
        }
        btnEntra.onclick = entra;
        portaEntra.append(riga, btnEntra);
        porte.append(portaCrea, portaEntra);

        // Stato di collegamento: sostituisce le porte mentre si collega o se qualcosa va storto.
        const collegamento = el('section', 'si-collegamento');
        const giro = el('span', 'si-giro');
        giro.setAttribute('aria-hidden', 'true');
        const msg = el('p', 'si-msg');
        const azioni = el('div', 'si-azioni');
        collegamento.append(giro, msg, azioni);

        // Server: pillola di stato e, sotto "Avanzate", l'indirizzo.
        const piede = el('footer', 'si-piede');
        const pillola = el('span', 'si-pillola');
        const avanzate = el('details', 'si-avanzate');
        const sommario = el('summary', null, 'Avanzate');
        const urlInput = el('input', 'si-url');
        urlInput.type = 'text';
        urlInput.setAttribute('aria-label', 'Indirizzo del server');
        urlInput.spellcheck = false;
        urlInput.addEventListener('change', () => emetti('server', urlInput.value.trim()));
        avanzate.append(sommario, urlInput);
        piede.append(pillola, avanzate);

        radice.append(hero, porte, collegamento, piede);
        costruito = true;

        function disegna() {
            titolo.textContent = stato.modo.titolo;
            descr.textContent = stato.modo.descrizione || '';
            premi.textContent = stato.premi || '';
            premi.hidden = !stato.premi;
            sigillo.replaceChildren();
            const svg = icona(stato.modo.icona);
            if (svg) sigillo.append(svg); else sigillo.textContent = '◈';
            const s = stato.server || { stato: 'online', url: '' };
            // Senza uno stato noto (la sala vera non lo sa prima di collegarsi) la pillola non c'e': meglio niente di una bugia.
            pillola.hidden = !s.stato;
            pillola.className = 'si-pillola si-pillola--' + s.stato;
            pillola.hidden = !s.stato;
            pillola.textContent = s.stato === 'online' ? 'Server online' : (s.stato === 'sveglia' ? 'Server in risveglio…' : 'Server non raggiungibile');
            if (document.activeElement !== urlInput) urlInput.value = s.url || '';

            const occupato = stato.fase === 'collego' || stato.fase === 'errore';
            porte.hidden = occupato;
            collegamento.hidden = !occupato;
            radice.classList.toggle('is-collego', stato.fase === 'collego');
            collegamento.classList.toggle('is-errore', stato.fase === 'errore');
            azioni.replaceChildren();
            if (stato.fase === 'collego') {
                msg.textContent = stato.messaggio || 'Collego al server…';
                const a = el('button', 'si-btn si-btn--tenue', 'Annulla');
                a.type = 'button';
                a.onclick = () => emetti('annulla');
                azioni.append(a);
            } else if (stato.fase === 'errore') {
                msg.textContent = stato.messaggio || 'Non riesco a collegarmi.';
                const r = el('button', 'si-btn si-btn--oro', 'Riprova');
                r.type = 'button';
                r.onclick = () => emetti('riprova');
                const i = el('button', 'si-btn si-btn--tenue', 'Indietro');
                i.type = 'button';
                i.onclick = () => emetti('annulla');
                azioni.append(r, i);
            }
        }

        return {
            imposta(nuovo) { stato = nuovo; if (costruito) disegna(); },
            /** Svuota le caselle e mette il fuoco sulla prima (per un nuovo tentativo). */
            azzera() { caselle.forEach((c) => { c.value = ''; }); aggiornaBottone(); if (caselle[0]) caselle[0].focus(); },
            su(nome, fn) { (gestori[nome] = gestori[nome] || []).push(fn); }
        };
    }

    window.SalaIngresso = { monta };
})();
