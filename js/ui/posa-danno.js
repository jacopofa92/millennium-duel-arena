/**
 * posa-danno.js — la posa di "danno/sorpresa" del duellante quando perde Life Point.
 * =====================================================================
 * Quando un duellante (tu o l'avversario) subisce una perdita pesante di Life Point, per qualche secondo la sua pedina nel riquadro
 * ad angolo viene sostituita dalla posa "danno/sorpresa" (images/characters/pedine-danno-sorpresa/thumbs/<nome-file>.webp), con una
 * dissolvenza incrociata e un piccolo scatto di lato.
 *
 * SOLO GRAFICA: legge gameState.playerLP/botLP; la chiama renderLifePoints (game-flow.js) a ogni disegno dei Life Point (questo file\n * carica PRIMA di eventi-duello.js, quindi non puo' ascoltare gli eventi da solo); nessuna regola, il
 * motore e l'IA non sanno che esiste e in Multiplayer ogni client la disegna dai propri Life Point.
 *
 *  - SOGLIA: una perdita di almeno 1000 LP, oppure di almeno il 10% dei Life Point che si avevano un attimo prima (cosi' anche a
 *    pochi LP un colpo pesante si sente). Le perdite piccole non fanno niente.
 *  - DURATA 1,8 s (il conteggio dei LP dura 1,9 s). Un secondo colpo pesante mentre la posa c'e' gia' la tiene e riparte il tempo.
 *  - SE LA POSA NON ESISTE (alcune varianti non ne hanno una, vedi CLAUDE.md) non succede niente: la verifica e' un caricamento
 *    vero dell'immagine, ricordato per nome.
 *  - Spenta nel Tag Team: li' i Life Point cambiano anche per lo scambio fra compagni, e non sono un danno.
 */
(function () {
    'use strict';

    const CARTELLA = 'images/characters/pedine-danno-sorpresa/thumbs/';
    const SOGLIA_ASSOLUTA = 1000;
    const SOGLIA_RELATIVA = 0.10;
    const DURATA_MS = 1800;
    const DISSOLVENZA_ENTRATA_MS = 150;
    const DISSOLVENZA_USCITA_MS = 220;

    const SELETTORE = {
        player: '#playerInfo .duelist-avatar--corner',
        bot: '#botInfo .duelist-avatar--corner'
    };

    const params = new URLSearchParams(window.location.search);
    const spenta = params.get('mode') === 'tag' || params.get('tag') === '1' || window.POSA_DANNO_OFF === true;
    const riduciMovimento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /** nome file -> Promise<boolean>: la posa esiste? (un solo tentativo di caricamento per nome) */
    const esistenza = new Map();
    function esiste(nome) {
        if (!esistenza.has(nome)) {
            esistenza.set(nome, new Promise((risolvi) => {
                const prova = new Image();
                prova.onload = () => risolvi(true);
                prova.onerror = () => risolvi(false);
                prova.src = CARTELLA + nome + '.webp';
            }));
        }
        return esistenza.get(nome);
    }

    /** Il nome del file della pedina mostrata adesso nel riquadro (senza cartella ne' estensione), o null. */
    function nomeDelRiquadro(avatar) {
        const img = Array.from(avatar.querySelectorAll('img')).find((i) => !i.classList.contains('posa-danno'));
        const src = img && (img.getAttribute('src') || '');
        if (!src) return null;
        const file = decodeURIComponent(src.split('?')[0].split('/').pop() || '');
        return file.replace(/\.[a-z0-9]+$/i, '') || null;
    }

    /** @type {Record<string, { img: HTMLImageElement, timer: ReturnType<typeof setTimeout> } | undefined>} */
    const attive = {};

    function chiudi(lato) {
        const a = attive[lato];
        if (!a) return;
        attive[lato] = undefined;
        clearTimeout(a.timer);
        const avatar = a.img.parentElement;
        const finito = () => { a.img.remove(); if (avatar) avatar.classList.remove('posa-danno-attiva'); };
        if (!a.img.animate) { finito(); return; }
        const uscita = a.img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DISSOLVENZA_USCITA_MS, fill: 'forwards' });
        uscita.onfinish = finito;
        uscita.oncancel = finito;
    }

    function programmaFine(lato) {
        const a = attive[lato];
        if (a) { clearTimeout(a.timer); a.timer = setTimeout(() => chiudi(lato), DURATA_MS); }
    }

    function scatto(img) {
        if (!img.animate || riduciMovimento()) return;
        img.animate([
            { translate: '0 0' }, { translate: '-6px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' }
        ], { duration: 360, easing: 'ease-out' });
    }

    function mostra(lato) {
        const avatar = document.querySelector(SELETTORE[lato]);
        if (!avatar) return;
        const nome = nomeDelRiquadro(avatar);
        if (!nome) return;
        esiste(nome).then((ok) => {
            if (!ok) return;   // nessuna posa per questo personaggio: non si fa niente
            const riquadro = document.querySelector(SELETTORE[lato]);
            if (!riquadro) return;
            const gia = attive[lato];
            if (gia && gia.img.parentElement === riquadro) { programmaFine(lato); scatto(gia.img); return; }
            if (gia) chiudi(lato);
            const img = document.createElement('img');
            img.className = 'posa-danno';
            img.alt = '';
            img.src = CARTELLA + nome + '.webp';
            img.style.opacity = '0';
            riquadro.appendChild(img);
            riquadro.classList.add('posa-danno-attiva');
            attive[lato] = { img: img, timer: 0 };
            if (img.animate) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DISSOLVENZA_ENTRATA_MS, fill: 'forwards' });
            else img.style.opacity = '1';
            scatto(img);
            programmaFine(lato);
        });
    }

    /** Ultimi Life Point visti: la prima lettura di un duello non e' mai un danno. */
    let ultimo = null;

    function sync() {
        if (spenta || typeof gameState === 'undefined' || !gameState) return;
        const ora = { player: gameState.playerLP, bot: gameState.botLP };
        const prima = ultimo;
        ultimo = ora;
        if (!prima) return;
        ['player', 'bot'].forEach((lato) => {
            const era = prima[lato], adesso = ora[lato];
            if (typeof era !== 'number' || typeof adesso !== 'number' || adesso >= era) return;
            const persi = era - adesso;
            if (persi >= SOGLIA_ASSOLUTA || persi / Math.max(era, 1) >= SOGLIA_RELATIVA) mostra(lato);
        });
    }

    window.PosaDanno = { sync: sync, _soglia: { assoluta: SOGLIA_ASSOLUTA, relativa: SOGLIA_RELATIVA, durata: DURATA_MS } };
})();
