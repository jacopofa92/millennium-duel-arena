/**
 * Indicatore dello stato del salvataggio nel menu: dice a colpo d'occhio se i
 * progressi sono al sicuro sul cloud o solo su questo dispositivo.
 *
 * Non decide e non scrive nulla: legge `AutoSync.stato()` (js/cloud/auto-sync.js)
 * e si aggiorna con `AutoSync.onStato`. Il testo è scritto per chi gioca, non
 * per chi sviluppa: ogni stato dice anche COSA fare (o che non c'è niente da fare).
 *
 * Uso: StatoSalvataggio.monta(elementoContenitore)
 */
(function () {
    'use strict';

    const TESTI = {
        'salvato': { icona: '☁️', testo: 'Progressi salvati sul cloud', classe: 'ok' },
        'in-attesa': { icona: '⏳', testo: 'Salvataggio in arrivo…', classe: 'attesa' },
        'in-corso': { icona: '🔄', testo: 'Salvataggio in corso…', classe: 'attesa' },
        'errore': { icona: '⚠️', testo: 'Cloud non raggiunto: riproverò da solo', classe: 'avviso' },
        'offline': { icona: '📴', testo: 'Sei offline: i progressi restano su questo dispositivo', classe: 'avviso' }
    };

    function iniettaStile() {
        if (document.getElementById('statoSalvataggioStile')) return;
        const s = document.createElement('style');
        s.id = 'statoSalvataggioStile';
        s.textContent = [
            '.stato-salvataggio{display:inline-flex;align-items:center;gap:6px;margin:6px auto 0;padding:4px 12px;',
            'border-radius:999px;font-size:.78rem;letter-spacing:.02em;color:var(--stato-colore,#d9c58a);',
            'background:rgba(10,12,24,.55);border:1px solid var(--stato-bordo,rgba(247,215,116,.28));}',
            '.stato-salvataggio[hidden]{display:none;}',
            '.stato-salvataggio--ok{--stato-colore:#bfe3b4;--stato-bordo:rgba(160,220,150,.3);}',
            '.stato-salvataggio--attesa{--stato-colore:#f7d774;}',
            '.stato-salvataggio--avviso{--stato-colore:#ffb878;--stato-bordo:rgba(255,160,90,.45);}',
            '@media (prefers-reduced-motion:no-preference){.stato-salvataggio--attesa .stato-salvataggio-icona{animation:statoSalvPulsa 1.2s ease-in-out infinite;}}',
            '@keyframes statoSalvPulsa{50%{opacity:.4;}}'
        ].join('');
        document.head.appendChild(s);
    }

    function monta(contenitore) {
        if (!contenitore || contenitore.__statoSalvataggio) return;
        contenitore.__statoSalvataggio = true;
        iniettaStile();
        const el = document.createElement('div');
        el.className = 'stato-salvataggio';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.hidden = true;
        el.innerHTML = '<span class="stato-salvataggio-icona" aria-hidden="true"></span><span class="stato-salvataggio-testo"></span>';
        contenitore.appendChild(el);

        function disegna(stato) {
            const d = TESTI[stato];
            // Senza account (o senza cloud) non c'è niente da raccontare: l'accesso è obbligatorio, quindi lo stato
            // compare appena si sa chi è l'utente.
            if (!d) { el.hidden = true; return; }
            el.hidden = false;
            el.className = 'stato-salvataggio stato-salvataggio--' + d.classe;
            el.querySelector('.stato-salvataggio-icona').textContent = d.icona;
            el.querySelector('.stato-salvataggio-testo').textContent = d.testo;
        }

        // AutoSync può arrivare dopo (ordine dei tag <script>) e l'utente è noto solo dopo la lettura della sessione.
        function aggancia() {
            if (!window.AutoSync || typeof AutoSync.onStato !== 'function') return false;
            AutoSync.onStato(disegna);
            disegna(AutoSync.stato());
            return true;
        }
        if (!aggancia()) window.addEventListener('load', aggancia, { once: true });
        if (window.CloudSync && typeof CloudSync.waitForUser === 'function') {
            CloudSync.waitForUser().then(() => { if (window.AutoSync) disegna(AutoSync.stato()); }).catch(() => { /* niente sessione */ });
        }
    }

    window.StatoSalvataggio = { monta: monta };
})();
