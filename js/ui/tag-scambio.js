// Tag Team: le scene dello scambio fra compagni (blu) e fra avversari (rosso).
//
// SOLO GRAFICA: la regola dello scambio (TagTeam.scambia) e' gia' avvenuta quando una scena parte, e nessuna regola aspetta
// che finisca. In rete ogni client la disegna da se' con gli stessi dati, senza messaggi (non cambia niente per il passo
// comune). Se una scena non c'e' o salta, il duello va avanti identico.
//
// DUE SCENE:
//  1) CAMBIO TURNO (mostra con dati.turno, la usa tag-mode.js al posto dell'annuncio standard): e' IL cambio turno classico
//     (showEpicSlamAnnouncement di game-flow.js: flash, due fasce oblique, "TURNO" + nome che si scontrano, numero del turno,
//     3 secondi) con il nome di chi gioca DAVVERO, e sopra le PEDINE che si scambiano: chi esce scivola via verso il suo lato,
//     chi entra arriva dal lato opposto (senza scambio compare la sola pedina di chi gioca). Con uno scambio il sottotitolo
//     dice "TAG! · Turno N". Il campo e la mano del lato che cambia restano nascosti finche' il nuovo membro e' entrato.
//     Dura come l'annuncio classico (3 s: il turno vero parte dopo 3 s).
//  2) SCAMBIO O KO FUORI DA UN CAMBIO TURNO (la scelta di chi affrontare, un membro appena caduto): una fascia obliqua nello
//     stesso stile, con la pedina e TAG! / KO! (circa 1,1 s, un tocco la salta).
// Con Dettagli "Normali" o col movimento ridotto le pedine non si muovono. Con `window.DUEL_FAST_OPENING` (la suite di test) le
// scene sono spente, salvo `TAG_SCAMBIO_FORZA`.
(function () {
    'use strict';

    const DUR_PIENA = 1150;
    const DUR_LEGGERA = 700;
    // Come l'annuncio di un cambio turno normale (showEpicSlamAnnouncement: 3 s, e il turno vero parte dopo 3 s).
    const DUR_TURNO = 3000;

    /** @type {{ finisci: () => void } | null} */
    let attiva = null;

    function ridotto() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function conMovimento() {
        if (ridotto()) return false;
        const vq = window.VideoQuality;
        return !(vq && typeof vq.isAlti === 'function' && !vq.isAlti());
    }

    function spenta() {
        if (window.TAG_SCAMBIO_OFF) return true;
        return !!window.DUEL_FAST_OPENING && !window.TAG_SCAMBIO_FORZA;
    }

    function suonoScambio() {
        try { if (window.SFX && typeof window.SFX.tagSwitch === 'function') window.SFX.tagSwitch(); } catch (e) { /* l'audio non deve fermare la scena */ }
    }

    /**
     * La PEDINA del personaggio (la figura scontornata di images/characters/pedine/, la stessa del riquadro dei Life Point), non
     * il ritratto in un cerchio. Se per quel personaggio non c'e' una pedina si ripiega sul ritratto che c'e'.
     */
    function ritratto(dati, classe) {
        const r = document.createElement('div');
        r.className = 'tgs-ritr ' + classe;
        const f = document.createElement('div');
        f.className = 'tgs-foto';
        const originale = dati && dati.image ? String(dati.image) : '';
        if (originale) {
            const pedina = typeof window.getCharacterPawnImage === 'function' ? window.getCharacterPawnImage(originale) : null;
            const img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            if (pedina && pedina !== originale) img.onerror = () => { img.onerror = null; img.src = originale; };
            img.src = pedina || originale;
            f.appendChild(img);
        }
        const n = document.createElement('div');
        n.className = 'tgs-nome';
        n.textContent = (dati && dati.nome) || '';
        r.append(f, n);
        return r;
    }

    /** Il campo e la mano del lato che cambia: nascosti fino all'ingresso, poi compongono con un lampo. */
    function rivelaCampo(posto, quando, durata) {
        const ids = posto === 'player' ? ['playerFieldBoard', 'playerHand'] : ['botFieldBoard', 'botHand'];
        const anim = [];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el || !el.animate) return;
            const p = quando / durata;
            anim.push(el.animate([
                { opacity: 0, filter: 'brightness(2.4) blur(3px)', offset: 0 },
                { opacity: 0, filter: 'brightness(2.4) blur(3px)', offset: p },
                { opacity: 1, filter: 'brightness(1.4) blur(0px)', offset: Math.min(.95, p + .22) },
                { opacity: 1, filter: 'none', offset: 1 }
            ], { duration: durata + 350, easing: 'linear' }));
        });
        return anim;
    }

    function croce(ritrattoEl) {
        const ko = document.createElement('span');
        ko.className = 'tgs-x';
        ko.textContent = '✕';
        ritrattoEl.querySelector('.tgs-foto').appendChild(ko);
    }

    /**
     * Lo spazio libero attorno alle scritte dell'annuncio classico (#battleStartOverlay), misurato sulle scritte vere:
     * { modo: 'lati', lato, xSin, xDes, y } se ai due lati del titolo c'e' margine per una pedina, altrimenti
     * { modo: 'centro', lato, x, y } con la pedina nello spazio fra il titolo e la riga "Turno N".
     */
    function misuraSpazio() {
        const W = window.innerWidth, H = window.innerHeight;
        const ov = document.getElementById('battleStartOverlay');
        const tit = ov && ov.querySelector('.battle-start-title');
        const sub = ov && ov.querySelector('.battle-start-sub');
        if (!tit || !sub) return { modo: 'centro', lato: Math.min(H * 0.18, 150), x: W / 2, y: H * 0.52 };
        let t = tit.getBoundingClientRect();
        let s = sub.getBoundingClientRect();
        // Margine a destra e a sinistra del titolo (e della riga sotto, che e' piu' stretta): vale il piu' piccolo.
        let margine = Math.min(t.left, W - t.right) - 12;
        // Un nome lungo (Maximillion Pegasus) riempie la larghezza e fra le due righe non resta posto (telefono in orizzontale):
        // si rimpicciolisce appena il titolo, SOLO in questa scena (lo skew sta sul contenitore, le parole si animano da sole),
        // quanto basta a liberare ~70 px per lato.
        if (margine < 60 && s.top - t.bottom < 70 && t.width > 0) {
            const f = Math.max(0.6, Math.min(1, (W - 2 * 82) / t.width));
            if (f < 1) {
                /** @type {HTMLElement} */ (tit).style.transform = 'translate(-50%, -50%) skewY(-3deg) scale(' + f.toFixed(3) + ')';
                t = tit.getBoundingClientRect();
                s = sub.getBoundingClientRect();
                margine = Math.min(t.left, W - t.right) - 12;
            }
        }
        const y = (t.top + s.bottom) / 2;
        // Anche un margine stretto basta (un telefono in orizzontale ne ha ~100 px): la pedina li' e' piccola ma non copre niente,
        // mentre nello spazio fra le due righe, in orizzontale, ci sono meno di 50 px.
        const vuoto = s.top - t.bottom - 12;
        // Si sceglie la posizione dove la pedina viene piu' GRANDE (desktop: ai lati; telefono in verticale: fra le due righe).
        const latoLati = margine >= 60 ? Math.max(56, Math.min(margine, H * 0.3, 230)) : 0;
        const latoCentro = vuoto >= 56 ? Math.min(vuoto, H * 0.2, 160) : 0;
        if (latoLati > 0 && latoLati >= latoCentro) {
            return { modo: 'lati', lato: latoLati, xSin: t.left / 2, xDes: (t.right + W) / 2, y };
        }
        return { modo: 'centro', lato: Math.max(56, latoCentro), x: W / 2, y: t.bottom + 6 + vuoto / 2 };
    }

    /**
     * 1) Il CAMBIO TURNO: l'annuncio classico (con il nome giusto) + le pedine che si scambiano.
     * @param {string} posto
     * @param {{ turno: number, sottotitolo?: string, nome: string, image?: string, esce?: any, entra?: any }} dati
     */
    function mostraTurno(posto, dati) {
        const scambio = !!(dati.esce && dati.entra);
        if (scambio) suonoScambio();
        // L'annuncio classico: stessi font, stesse fasce oblique, stessa durata. Il nome e' quello di chi gioca davvero.
        if (typeof window.showEpicSlamAnnouncement === 'function') {
            window.showEpicSlamAnnouncement('TURNO', dati.nome || '', (scambio ? 'TAG! · ' : '') + (dati.sottotitolo || ''));
        }

        const movimento = conMovimento();
        const T = DUR_TURNO;
        const verso = posto === 'player' ? -1 : 1;
        const radice = document.createElement('div');
        radice.id = 'tagScambio';
        radice.className = 'tgs tgs--turno tgs--' + (posto === 'player' ? 'mio' : 'avv');
        radice.setAttribute('aria-hidden', 'true');
        const esce = scambio ? ritratto(dati.esce, 'tgs-esce') : null;
        const entra = ritratto(scambio ? dati.entra : { nome: dati.nome, image: dati.image }, 'tgs-entra');
        if (esce) radice.appendChild(esce);
        radice.appendChild(entra);
        document.body.appendChild(radice);
        // DOVE stanno le pedine: dove le scritte dell'annuncio lasciano spazio, misurato sulle scritte vere (la loro misura
        // cambia con lo schermo: in verticale i due nomi vanno uno sopra l'altro, in orizzontale su una riga).
        //  - 'lati': c'e' margine ai due lati del titolo (desktop, telefono in orizzontale): chi esce sta da una parte, chi
        //    entra arriva dall'altra e resta li';
        //  - 'centro': i lati sono stretti (telefono in verticale): la pedina sta nello spazio fra il titolo e la riga "Turno N".
        const sp = misuraSpazio();
        const postoDi = (finale) => (sp.modo === 'lati' ? { x: (finale ? verso < 0 : verso > 0) ? sp.xDes : sp.xSin, y: sp.y } : { x: sp.x, y: sp.y });
        const pEntra = postoDi(true);
        const pEsce = postoDi(false);
        [[entra, pEntra], [esce, pEsce]].forEach(([el, p]) => {
            if (!el) return;
            el.style.left = Math.round(p.x) + 'px';
            el.style.top = Math.round(p.y) + 'px';
            el.style.setProperty('--tgs-lato', Math.round(sp.lato) + 'px');
        });
        // Mentre la scena e' a schermo la scelta di chi affrontare (che si apre all'inizio del turno) e l'avviso del compagno
        // restano invisibili: compaiono alla fine, non sopra la scena (vedi tag-scambio.css).
        document.body.classList.add('tgs-turno-attivo');

        /** @type {Animation[]} */
        let animazioni = [];
        let chiuso = false;
        const finisci = () => {
            if (chiuso) return;
            chiuso = true;
            animazioni.forEach((a) => { try { a.cancel(); } catch (e) { /* gia' finita */ } });
            clearTimeout(tFine);
            document.body.classList.remove('tgs-turno-attivo');
            radice.remove();
            if (attiva && attiva.finisci === finisci) attiva = null;
        };
        const tFine = setTimeout(finisci, T + 80);
        attiva = { finisci };

        if (!movimento || !radice.animate) {
            // Versione ferma: la pedina di chi gioca al centro (le due, affiancate, con uno scambio), sfuma dentro e fuori.
            entra.style.opacity = '1';
            const affiancate = sp.modo === 'centro' && scambio;
            entra.style.transform = affiancate ? 'translate(5%,-50%)' : 'translate(-50%,-50%)';
            if (esce) { esce.style.opacity = '1'; esce.style.transform = affiancate ? 'translate(-105%,-50%)' : 'translate(-50%,-50%)'; }
            animazioni.push(radice.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 2400, easing: 'linear', fill: 'forwards' }));
            return true;
        }

        const at = (ms) => ms / T;
        // Quanto scivolano: oltre il bordo dello schermo, in pixel (le pedine hanno ora una posizione loro, in pixel).
        const fuoriT = Math.round(verso * window.innerWidth * 0.6);
        if (scambio) {
            // Chi esce: appare, poi scivola via verso il suo lato.
            animazioni.push(esce.animate([
                { transform: 'translate(-50%,-50%) scale(.85)', opacity: 0, offset: 0 },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(300) },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(900), easing: 'cubic-bezier(.5,0,.3,1)' },
                { transform: 'translate(calc(-50% + ' + fuoriT + 'px),-50%) scale(.8)', opacity: 0, offset: at(1550) },
                { transform: 'translate(calc(-50% + ' + fuoriT + 'px),-50%) scale(.8)', opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
            // Chi entra: arriva dal lato opposto e resta fino alla fine.
            animazioni.push(entra.animate([
                { transform: 'translate(calc(-50% + ' + (-fuoriT) + 'px),-50%) scale(.9)', opacity: 0, offset: 0 },
                { transform: 'translate(calc(-50% + ' + (-fuoriT) + 'px),-50%) scale(.9)', opacity: 0, offset: at(800), easing: 'cubic-bezier(.2,.8,.2,1)' },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(1200) },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(2650) },
                { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
            // Il campo del lato cambiato resta nascosto fino all'ingresso, poi si ricompone.
            animazioni = animazioni.concat(rivelaCampo(posto, 1200, T));
        } else {
            // Nessuno scambio: la pedina di chi gioca compare al centro e resta.
            animazioni.push(entra.animate([
                { transform: 'translate(-50%,-50%) scale(.85)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(600) },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(2650) },
                { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
        }
        return true;
    }

    /**
     * 2) Uno scambio o un KO FUORI da un cambio turno (o con un cambio turno senza annuncio): una fascia nello stile del cambio
     * turno classico, la pedina e TAG! / KO!.
     * @param {string} posto 'player' | 'bot'
     * @param {{ esce: { nome: string, image: string }, entra?: { nome: string, image: string } | null, eliminato?: boolean, esceKO?: boolean }} dati
     *   `entra` assente = il solo KO; `eliminato` = la scritta dice KO!; `esceKO` = il ritratto di chi esce e' quello di un eliminato.
     */
    function mostraBreve(posto, dati) {
        suonoScambio();
        const movimento = conMovimento();
        const durata = movimento ? DUR_PIENA : DUR_LEGGERA;
        // Il lato del giocatore esce a sinistra (e' li' la pillola della sua squadra), quello avversario a destra.
        const verso = posto === 'player' ? -1 : 1;

        const radice = document.createElement('div');
        radice.id = 'tagScambio';
        radice.className = 'tgs tgs--' + (posto === 'player' ? 'mio' : 'avv') + (dati.eliminato ? ' tgs--ko' : '');
        radice.setAttribute('aria-hidden', 'true');
        const lampo = document.createElement('div');
        lampo.className = 'tgs-lampo';
        const fascia = document.createElement('div');
        fascia.className = 'tgs-fascia';
        // Senza `entra` e' il solo KO (il membro e' appena caduto, il compagno entrera' piu' tardi): un ritratto e la scritta.
        const soloKo = !dati.entra;
        const esceKO = !!(dati.esceKO || dati.eliminato || soloKo);
        const esce = ritratto(dati.esce || { nome: '', image: '' }, 'tgs-esce' + (esceKO ? ' tgs-esce--ko' : ''));
        const entra = ritratto(dati.entra, 'tgs-entra');
        if (esceKO) croce(esce);
        const testo = document.createElement('div');
        testo.className = 'tgs-testo';
        testo.textContent = (dati.eliminato || soloKo) ? 'KO!' : 'TAG!';
        radice.append(lampo, fascia, esce);
        if (!soloKo) radice.appendChild(entra);
        radice.appendChild(testo);
        document.body.appendChild(radice);

        /** @type {Animation[]} */
        let animazioni = [];
        let chiuso = false;
        const finisci = () => {
            if (chiuso) return;
            chiuso = true;
            animazioni.forEach((a) => { try { a.cancel(); } catch (e) { /* gia' finita */ } });
            document.removeEventListener('pointerdown', finisci, true);
            clearTimeout(tFine);
            radice.remove();
            if (attiva && attiva.finisci === finisci) attiva = null;
        };
        const tFine = setTimeout(finisci, durata + 80);
        attiva = { finisci };
        // Un tocco la salta, ma non subito: il tocco che ha causato lo scambio non deve chiuderla.
        setTimeout(() => { if (!chiuso) document.addEventListener('pointerdown', finisci, true); }, 250);

        if (!movimento || !radice.animate) {
            // Versione leggera: tutto fermo (chi esce a sinistra, chi entra a destra, la scritta sopra), sfuma dentro e fuori.
            esce.style.opacity = '1';
            esce.style.transform = soloKo ? 'translate(-50%,-50%)' : 'translate(-125%,-50%)';
            entra.style.opacity = '1';
            entra.style.transform = 'translate(25%,-50%)';
            testo.style.opacity = '1';
            animazioni.push(radice.animate([{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: durata, easing: 'linear', fill: 'forwards' }));
            return;
        }

        const T = durata;
        const at = (ms) => ms / T;
        // Fascia: si apre dal lato di chi esce verso l'altro.
        fascia.style.transformOrigin = verso < 0 ? 'left center' : 'right center';
        animazioni.push(fascia.animate([
            { transform: 'translateY(-50%) skewY(-3deg) scaleX(0)', opacity: 1, offset: 0, easing: 'cubic-bezier(.2,.7,.2,1)' },
            { transform: 'translateY(-50%) skewY(-3deg) scaleX(1)', opacity: 1, offset: at(220) },
            { transform: 'translateY(-50%) skewY(-3deg) scaleX(1)', opacity: 1, offset: at(900) },
            { transform: 'translateY(-50%) skewY(-3deg) scaleX(1)', opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // La scritta resta inclinata come le fasce (lo skew sta in ogni fotogramma: l'animazione sostituisce il transform).
        const SK = 'translate(-50%,0) skewY(-3deg) ';
        const fuori = verso * 62;
        if (soloKo) {
            // Il solo KO: il ritratto resta al centro (grigio, con la X) e si spegne, la scritta colpisce subito, niente campo nascosto.
            animazioni.push(esce.animate([
                { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(220) },
                { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(900) },
                { transform: 'translate(-50%,-50%) scale(.92)', opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
            animazioni.push(testo.animate([
                { transform: SK + 'scale(1.5)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
                { transform: SK + 'scale(1)', opacity: 1, offset: at(260) },
                { transform: SK + 'scale(1)', opacity: 1, offset: at(900) },
                { transform: SK + 'scale(1)', opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
            animazioni.push(lampo.animate([
                { opacity: 0, offset: 0 }, { opacity: .7, offset: at(150) }, { opacity: 0, offset: at(520) }, { opacity: 0, offset: 1 }
            ], { duration: T, easing: 'linear', fill: 'both' }));
            return;
        }
        animazioni.push(esce.animate([
            { transform: 'translate(-50%,-50%) scale(.85)', opacity: 0, offset: 0 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(200) },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(380), easing: 'cubic-bezier(.5,0,.3,1)' },
            { transform: 'translate(calc(-50% + ' + fuori + 'vw),-50%) scale(.8)', opacity: 0, offset: at(760) },
            { transform: 'translate(calc(-50% + ' + fuori + 'vw),-50%) scale(.8)', opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // Chi entra: arriva dal lato opposto e si ferma al centro.
        animazioni.push(entra.animate([
            { transform: 'translate(calc(-50% + ' + (-fuori) + 'vw),-50%) scale(.9)', opacity: 0, offset: 0 },
            { transform: 'translate(calc(-50% + ' + (-fuori) + 'vw),-50%) scale(.9)', opacity: 0, offset: at(300), easing: 'cubic-bezier(.2,.8,.2,1)' },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(560) },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: at(940) },
            { transform: 'translate(-50%,-50%) scale(1.06)', opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // TAG!: colpisce quando chi entra e' arrivato (senza rimbalzo: l'impatto lo fa il lampo).
        animazioni.push(testo.animate([
            { transform: SK + 'scale(1.5)', opacity: 0, offset: 0 },
            { transform: SK + 'scale(1.5)', opacity: 0, offset: at(420), easing: 'cubic-bezier(.2,.8,.2,1)' },
            { transform: SK + 'scale(1)', opacity: 1, offset: at(600) },
            { transform: SK + 'scale(1)', opacity: 1, offset: at(940) },
            { transform: SK + 'scale(1)', opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // Lampo all'arrivo di chi entra.
        animazioni.push(lampo.animate([
            { opacity: 0, offset: 0 }, { opacity: 0, offset: at(520) }, { opacity: .9, offset: at(600) }, { opacity: 0, offset: at(900) }, { opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // Il campo del lato che cambia.
        animazioni = animazioni.concat(rivelaCampo(posto, 560, T));
    }

    /**
     * Con `dati.turno` e' la scena del cambio turno; altrimenti uno scambio o un KO fuori da un cambio turno.
     * @param {string} posto 'player' | 'bot'
     * @param {any} dati
     */
    function mostra(posto, dati) {
        if (!dati || spenta() || typeof document === 'undefined') return;
        if (attiva) attiva.finisci();
        if (dati.turno != null) { mostraTurno(posto, dati); return; }
        mostraBreve(posto, dati);
    }

    window.TagScambio = { mostra, attiva: () => !!attiva, spenta };
})();
