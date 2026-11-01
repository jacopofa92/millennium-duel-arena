// Tag Team: la scena dello scambio fra compagni (blu) e fra avversari (rosso).
//
// SOLO GRAFICA: la regola dello scambio (TagTeam.scambia) e' gia' avvenuta quando questa scena parte, e nessuna regola
// aspetta che finisca. In rete ogni client la disegna da se' con gli stessi dati, senza messaggi (non cambia niente per
// il passo comune). Se la scena non c'e' o salta, il duello va avanti identico.
//
// Cosa si vede (circa 1,1 s, un tocco la salta):
//  - una fascia obliqua attraversa lo schermo nel colore del lato (blu il tuo, rosso l'avversario);
//  - il ritratto di chi esce scivola via verso il suo lato e si spegne, quello di chi entra arriva dal lato opposto;
//  - compare TAG! (o KO! se chi esce e' stato eliminato, e il suo ritratto si fa grigio con una X);
//  - il campo e la mano del lato che cambia restano nascosti finche' il nuovo membro e' entrato, poi si compongono con un
//    lampo (il campo vero e' gia' quello nuovo: si nasconde soltanto la sostituzione).
// Con Dettagli "Normali" o col movimento ridotto resta la sola fascia con i due ritratti, senza movimento e senza campo
// nascosto, per 0,7 s. Con `window.DUEL_FAST_OPENING` (la suite di test) la scena e' spenta, salvo `TAG_SCAMBIO_FORZA`.
(function () {
    'use strict';

    const DUR_PIENA = 1150;
    const DUR_LEGGERA = 700;

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

    function ritratto(dati, classe) {
        const r = document.createElement('div');
        r.className = 'tgs-ritr ' + classe;
        const f = document.createElement('div');
        f.className = 'tgs-foto';
        if (dati && dati.image) f.style.backgroundImage = 'url("' + String(dati.image).replace(/"/g, '%22') + '")';
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

    /**
     * @param {string} posto 'player' | 'bot'
     * @param {{ esce: { nome: string, image: string }, entra: { nome: string, image: string }, eliminato?: boolean }} dati
     */
    function mostra(posto, dati) {
        if (!dati || spenta() || typeof document === 'undefined') return;
        if (attiva) attiva.finisci();

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
        const esce = ritratto(dati.esce, 'tgs-esce');
        const entra = ritratto(dati.entra, 'tgs-entra');
        if (dati.eliminato) {
            const ko = document.createElement('span');
            ko.className = 'tgs-x';
            ko.textContent = '✕';
            esce.querySelector('.tgs-foto').appendChild(ko);
        }
        const testo = document.createElement('div');
        testo.className = 'tgs-testo';
        testo.textContent = dati.eliminato ? 'KO!' : 'TAG!';
        radice.append(lampo, fascia, esce, entra, testo);
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
        const tFine = setTimeout(finisci, durata + 400);
        attiva = { finisci };
        // Un tocco la salta, ma non subito: il tocco che ha causato lo scambio (fine turno) non deve chiuderla.
        setTimeout(() => { if (!chiuso) document.addEventListener('pointerdown', finisci, true); }, 250);

        if (!movimento || !radice.animate) {
            // Versione leggera: tutto fermo (chi esce a sinistra, chi entra a destra, la scritta sopra), sfuma dentro e fuori.
            esce.style.opacity = '1';
            esce.style.transform = 'translate(-125%,-50%)';
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
        // Chi esce: compare al centro, poi scivola via verso il suo lato e si spegne.
        const fuori = verso * 62;
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
        // TAG!/KO!: colpisce quando chi entra e' arrivato (senza rimbalzo: l'impatto lo fa il lampo).
        animazioni.push(testo.animate([
            { transform: 'translate(-50%,0) scale(1.5)', opacity: 0, offset: 0 },
            { transform: 'translate(-50%,0) scale(1.5)', opacity: 0, offset: at(420), easing: 'cubic-bezier(.2,.8,.2,1)' },
            { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: at(600) },
            { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: at(940) },
            { transform: 'translate(-50%,0) scale(1)', opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // Lampo all'arrivo di chi entra.
        animazioni.push(lampo.animate([
            { opacity: 0, offset: 0 }, { opacity: 0, offset: at(520) }, { opacity: .9, offset: at(600) }, { opacity: 0, offset: at(900) }, { opacity: 0, offset: 1 }
        ], { duration: T, easing: 'linear', fill: 'both' }));
        // Il campo del lato che cambia.
        animazioni = animazioni.concat(rivelaCampo(posto, 560, T));
    }

    window.TagScambio = { mostra, attiva: () => !!attiva };
})();
