/**
 * sfida-libera.js — la finestra "prepara la sfida" del Duello Libero.
 * =====================================================================
 * Gemello di js/ui/sfida-libera.css. Si apre cliccando un Duellante:
 * a sinistra l'avversario (ritratto scontornato delle pedine, nome,
 * record), a destra arena, musica e carte ammesse (js/ui/duel-setup.js) e
 * il livello, in fondo il pulsante che avvia il duello.
 *
 * PERCHÉ È UN COMPONENTE: il Duello Libero esiste in due posti — la vista
 * dentro index.html (quella che apre il menu) e la pagina standalone
 * duello-libero.html (quella a cui riporta "Continua" a fine duello, vedi
 * DuelSession.RETURN_URLS). Ognuno aveva la SUA copia di questa finestra,
 * scritta a mano, e le due si erano separate: l'utente vedeva una versione
 * a due colonne o quella vecchia a una colonna a seconda di come ci era
 * arrivato. Ora c'è un solo markup e un solo codice, montati su richiesta
 * nel <body>: le due pagine chiamano soltanto SfidaLibera.apri(personaggio).
 *
 * Il livello si SCEGLIE e poi si conferma con "Duella" (prima un click sul
 * livello faceva già partire il duello, senza una seconda occasione per
 * guardare arena e musica). L'ultimo livello scelto viene ricordato.
 *
 * Uso:
 *   SfidaLibera.apri(personaggio, { toast(testo) {...} });
 *   SfidaLibera.chiudi();
 *
 * Gli id #diffModal e le classi .diff-modal/.diff-btn restano quelli di
 * prima: li usano gli spec (tests/specs/duello-libero-config-responsive,
 * duellanti-da-sbloccare).
 */
(function () {
    'use strict';

    const LIVELLI = [
        // `key` è il valore INTERNO passato nell'URL e letto da
        // js/duel-session.js (DIFFICULTY_LABEL_TO_KEY): "Medio" resta Medio
        // anche se a schermo si chiama Normale.
        { key: 'Facile', label: 'Facile', desc: 'Mazzo più accessibile', classe: 'easy', pallini: 1 },
        { key: 'Medio', label: 'Normale', desc: 'Sfida equilibrata', classe: 'medium', pallini: 2 },
        { key: 'Difficile', label: 'Difficile', desc: 'Mazzo e IA al massimo', classe: 'hard', pallini: 3 }
    ];
    const CHIAVE_LIVELLO = 'ygoSfidaLiberaLivello';

    let radice = null;
    let setup = null;
    let personaggio = null;
    let opzioni = {};
    let livello = 'Medio';
    let partenza = null;

    function leggiLivello() {
        try {
            const v = localStorage.getItem(CHIAVE_LIVELLO);
            if (LIVELLI.some((l) => l.key === v)) return v;
        } catch (e) { /* noop */ }
        return 'Medio';
    }
    function scriviLivello(v) {
        try { localStorage.setItem(CHIAVE_LIVELLO, v); } catch (e) { /* noop */ }
    }

    // Il ritratto scontornato vive in images/characters/pedine/ col nome del
    // FILE del ritratto, non con l'id del personaggio (stessa regola di
    // js/duel-session.js e della mappa di Battle City).
    function percorsoPedina(immagine) {
        const nome = String(immagine || '').split(/[\\/]/).pop().replace(/\.[a-z0-9]+(\?.*)?$/i, '');
        return nome ? 'images/characters/pedine/' + nome + '.png' : null;
    }

    function escape(testo) {
        return String(testo == null ? '' : testo).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function costruisci() {
        radice = document.createElement('div');
        radice.className = 'sl-sfondo diff-modal-backdrop';
        radice.id = 'diffModal';
        radice.setAttribute('role', 'dialog');
        radice.setAttribute('aria-modal', 'true');
        radice.setAttribute('aria-labelledby', 'slNome');
        radice.innerHTML = `
            <div class="sl-modale diff-modal">
                <button type="button" class="sl-chiudi" aria-label="Chiudi">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                </button>
                <section class="sl-avversario">
                    <div class="sl-occhiello">La tua sfida</div>
                    <div class="sl-ritratto" data-sl="ritratto"></div>
                    <div class="sl-identita">
                        <h2 class="sl-nome" id="slNome" data-sl="nome"></h2>
                        <div class="sl-titolo" data-sl="titolo"></div>
                        <div class="sl-record" data-sl="record"></div>
                    </div>
                </section>
                <section class="sl-corpo">
                    <div class="sl-setup" data-sl="setup"></div>
                    <div class="sl-livello">
                        <div class="sl-sezione">Livello dell'avversario</div>
                        <div class="sl-livelli" role="radiogroup" aria-label="Livello dell'avversario">
                            ${LIVELLI.map((l) => `
                                <button type="button" class="diff-btn sl-liv sl-liv--${l.classe}" role="radio" data-livello="${l.key}">
                                    <span class="sl-liv-pallini" aria-hidden="true">${'<i></i>'.repeat(l.pallini)}</span>
                                    <span class="sl-liv-testo"><b>${l.label}</b><small>${l.desc}</small></span>
                                </button>`).join('')}
                        </div>
                        <details class="sl-premi" data-sl="premi">
                            <summary data-sl="premiSommario"></summary>
                            <div data-sl="premiCorpo"></div>
                        </details>
                    </div>
                </section>
                <footer class="sl-piede">
                    <div class="sl-avviso" data-sl="avviso" role="alert"></div>
                    <button type="button" class="sl-annulla">Annulla</button>
                    <button type="button" class="sl-duella" data-sl="duella">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l7-7M14.5 3.5l6 6-9.5 9.5-6-6zM3 21l2.5-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <span>Duella</span>
                    </button>
                </footer>
            </div>`;
        document.body.appendChild(radice);

        radice.querySelector('.sl-chiudi').onclick = chiudi;
        radice.querySelector('.sl-annulla').onclick = chiudi;
        radice.addEventListener('click', (ev) => { if (ev.target === radice) chiudi(); });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && radice.classList.contains('open')) chiudi();
        });
        radice.querySelectorAll('.sl-liv').forEach((btn) => {
            btn.onclick = () => {
                livello = btn.dataset.livello;
                scriviLivello(livello);
                segnaLivello();
                if (window.NativeHaptics) NativeHaptics.light();
            };
        });
        radice.querySelector('[data-sl="duella"]').onclick = avvia;
    }

    function el(nome) { return radice.querySelector(`[data-sl="${nome}"]`); }

    function segnaLivello() {
        radice.querySelectorAll('.sl-liv').forEach((btn) => {
            const scelto = btn.dataset.livello === livello;
            btn.setAttribute('aria-checked', String(scelto));
            btn.classList.toggle('is-scelto', scelto);
        });
        mostraPremi();
    }

    // I premi della vittoria al livello scelto. I numeri li legge Rewards
    // (js/economy/rewards.js): questa finestra non ne ricopia nessuno.
    function mostraPremi() {
        const box = el('premi');
        if (!box) return;
        if (!window.Rewards || !Rewards.preview) { box.hidden = true; return; }
        box.hidden = false;
        const p = Rewards.preview(livello);
        const nome = (LIVELLI.find((l) => l.key === livello) || {}).label || '';
        el('premiSommario').innerHTML = `${Rewards.icona('🎁')} Premi della vittoria a ${escape(nome)}: +${p.crediti} crediti${p.primaDelGiorno ? ` (+${p.bonusPrimaDelGiorno} oggi)` : ''}`;
        el('premiCorpo').innerHTML = Rewards.previewHtml(livello, '', true);
        Rewards.idrata(box);
    }

    function mostraRitratto(character) {
        const box = el('ritratto');
        box.className = 'sl-ritratto';
        box.innerHTML = '<span class="sl-ritratto-ripiego" aria-hidden="true">🂠</span>';
        const pedina = percorsoPedina(character.image);
        const img = new Image();
        img.alt = character.name;
        img.onload = () => {
            box.querySelector('.sl-ritratto-ripiego')?.remove();
            box.appendChild(img);
        };
        img.onerror = () => {
            // Nessuna pedina per questo personaggio: il ritratto normale,
            // sfumato ai bordi invece che chiuso in un cerchio.
            if (img.dataset.ripiego === '1' || !character.image) return;
            img.dataset.ripiego = '1';
            box.classList.add('is-ritratto');
            img.src = character.image;
        };
        if (pedina) { box.classList.add('is-pedina'); img.src = pedina; }
        else if (character.image) { box.classList.add('is-ritratto'); img.src = character.image; }
    }

    function apri(character, opts) {
        if (!character) return;
        if (window.Contenuti && !Contenuti.personaggio(character)) return;
        if (!radice) costruisci();
        personaggio = character;
        opzioni = opts || {};
        livello = leggiLivello();
        clearTimeout(partenza);

        const record = typeof getCharacterRecord === 'function' ? getCharacterRecord(character.id) : { wins: 0, losses: 0 };
        el('nome').textContent = character.name;
        el('titolo').textContent = character.title || '';
        el('record').innerHTML =
            `<div class="sl-stat sl-stat--v"><b>${Number(record.wins) || 0}</b><span>Vittorie</span></div>`
            + `<div class="sl-stat sl-stat--s"><b>${Number(record.losses) || 0}</b><span>Sconfitte</span></div>`;
        mostraRitratto(character);
        el('avviso').textContent = '';
        el('duella').disabled = false;
        el('duella').querySelector('span').textContent = 'Duella';
        segnaLivello();

        radice.classList.add('open');
        document.documentElement.classList.add('sl-aperta');

        // Il selettore si monta alla PRIMA apertura: i mazzi possono essere
        // cambiati nel frattempo, e fino a qui era tutto invisibile.
        if (!setup && window.DuelSetup) {
            // Niente `decks`: il mazzo si sceglie dalla barra in alto
            // (js/ui/deck-switcher.js), dove resta sempre visibile.
            setup = DuelSetup.mount(el('setup'), { compact: true });
        }
        // A finestra ormai aperta le scatole hanno una larghezza vera: solo
        // adesso si può sapere quali nomi non ci stanno.
        if (setup) setup.refresh();
        setTimeout(() => el('duella').focus({ preventScroll: true }), 30);
    }

    function chiudi() {
        if (!radice) return;
        clearTimeout(partenza);
        radice.classList.remove('open');
        document.documentElement.classList.remove('sl-aperta');
        // Un assaggio musicale non deve sopravvivere alla chiusura (e il
        // sottofondo deve ripartire).
        if (setup) setup.stopPreview();
    }

    function avvia() {
        if (!personaggio) return;
        const scelta = setup ? setup.getSelection() : {};
        // "Casuale" diventa un'arena e una traccia vere qui, non nel duello:
        // il duello riceve sempre un nome di file preciso.
        const campo = window.ArenaOptions ? ArenaOptions.risolviCampo(scelta.field) : '';
        const musica = window.ArenaOptions ? ArenaOptions.risolviTraccia(scelta.music) : '';
        const provenienza = scelta.origin || 'yu-gi-oh';

        // Mazzo contro "Carte ammesse", QUI: il motore lo ricontrolla
        // all'avvio del duello, ma a quel punto l'arena è già caricata e la
        // musica partita — scoprirlo lì è tardi (richiesta dell'utente).
        // Detto DENTRO la finestra, accanto al pulsante, non in un toast che
        // sparisce. Vedi js/data/deck-legality.js.
        const fuori = window.DeckLegality ? DeckLegality.mazzoCorrenteNonAmmesso(provenienza) : [];
        if (fuori.length > 0) {
            const elenco = fuori.slice(0, 3).join(', ');
            const altre = fuori.length - Math.min(3, fuori.length);
            el('avviso').innerHTML = `Il tuo mazzo ha ${fuori.length} cart${fuori.length === 1 ? 'a' : 'e'} non ammess${fuori.length === 1 ? 'a' : 'e'}: `
                + `${escape(elenco)}${altre > 0 ? ` e altre ${altre}` : ''}. Cambia mazzo dalla barra in alto o scegli "Tutte le provenienze".`;
            return;
        }

        if (setup) setup.stopPreview(); // mai un assaggio che continua dentro il duello
        const info = LIVELLI.find((l) => l.key === livello) || LIVELLI[1];
        el('avviso').textContent = '';
        el('duella').disabled = true;
        el('duella').querySelector('span').textContent = 'Si parte…';
        if (typeof opzioni.toast === 'function') opzioni.toast(`⚔️ Duello contro ${personaggio.name} (${info.label})...`);

        const url = 'duelMonstersCore.html?mode=free'
            + '&character=' + encodeURIComponent(personaggio.id)
            + '&difficulty=' + encodeURIComponent(info.key)
            + '&field=' + encodeURIComponent(campo)
            + '&music=' + encodeURIComponent(musica)
            + '&origin=' + encodeURIComponent(provenienza);
        partenza = setTimeout(() => { window.location.href = url; }, 450);
    }

    window.SfidaLibera = { apri: apri, chiudi: chiudi, LIVELLI: LIVELLI };
})();
