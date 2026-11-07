/**
 * tavola-del-destino.js — Tavola del Destino (Destiny Board): campo nel Regno delle Ombre e SEDUTA SPIRITICA.
 * ------------------------------------------------------------------------------------------------------------
 * Le 5 carte (id 866 Tavola del Destino + 867-870 Spirit Message) scoperte in zona Magia/Trappola scrivono insieme la
 * parola DEATH (D-E-A-T-H, come le lettere dipinte sulle illustrazioni delle carte; il banner di vittoria dice lo stesso).
 * Qui si legge SOLO lo stato del Terreno, a ogni ridisegno (`sync`, chiamato da ridisegnaDuello come DuelFeedback), e si disegna:
 *   - appena una delle cinque e' scoperta, il campo si oscura nel Regno delle Ombre: velo viola-nero con nebbia che
 *     scorre, SOTTO le carte (z-index 1; `.game-container` sta a 2), piu' fitto con l'aumentare delle carte;
 *   - sopra ogni carta scoperta si INCIDE un sigillo di luce spettrale: un anello che si traccia attorno alla carta, un
 *     secondo anello tratteggiato che gira al contrario, le tacche, e al centro la sua lettera che si accende con un lampo;
 *   - le carte scoperte sono unite da FILI DI LUCE nell'ordine della parola (D-E-A-T-H), come una costellazione: a ogni
 *     carta in piu' il filo si allunga fino a lei;
 *   - un FUOCO FATUO (la "planchette" di una seduta spiritica) percorre i fili avanti e indietro lasciando una scia, e
 *     ogni volta che raggiunge una carta il suo sigillo pulsa; con una carta sola le gira attorno;
 *   - dai sigilli cadono lente braci viola.
 * Nessuna regola qui: carte e vittoria stanno nel motore (card-effects-7.js, hasDestinyBoardComplete in fasi.js).
 *
 * (Dal 2026-11-07 al posto delle lettere di fumo WebGL: l'utente voleva un effetto che dicesse "tavola e spiriti".)
 * E' una tela 2D a tutto schermo SOPRA le carte (sotto modali e annunci), con i Dettagli video "Alti" e senza movimento
 * ridotto; altrimenti restano il velo scuro e, per ogni carta, la lettera dentro un anello (CSS), ferma. Esiste solo mentre
 * c'e' almeno una delle cinque carte.
 */
(function () {
    'use strict';

    const LETTERE = { 866: 'D', 867: 'E', 868: 'A', 869: 'T', 870: 'H' };
    const ORDINE = ['D', 'E', 'A', 'T', 'H'];   // l'ordine della parola: e' anche l'ordine in cui i fili collegano le carte

    const VIOLA = [172, 122, 255];
    const AZZURRO = [130, 205, 255];
    const BIANCO = [246, 242, 255];
    const BRACE = [255, 168, 96];
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    const DURATA_ANELLO_S = 1.1;     // tempo per tracciare l'anello del sigillo
    const DURATA_FILO_S = 1.4;       // tempo per allungare un filo fino alla carta nuova
    const SECONDI_PER_TRATTO = 2.4;  // il fuoco fatuo impiega tanto per andare da una carta alla successiva
    const MAX_BRACI = 90;
    const MAX_SCIA = 30;

    let layer = null;        // il velo scuro (div)
    let testi = null;        // i sigilli di ripiego (solo senza tela)
    let tela = null;
    let x2 = null;           // contesto 2D della tela
    let rid = 0;
    let ultimoT = 0;
    const lettere = new Map();   // uid -> { uid, lettera, nato, x, y, s, visibile }
    const impulsi = new Map();   // uid -> istante dell'ultimo passaggio del fuoco fatuo
    const braci = [];
    const scia = [];
    let qPrec = -1;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function animazioneConsentita() {
        // TAVOLA_DESTINO_FUMO_OFF e' il vecchio nome dell'interruttore (gli spec lo usano ancora), SEDUTA_OFF quello nuovo.
        if (window.TAVOLA_DESTINO_FUMO_OFF || window.TAVOLA_DESTINO_SEDUTA_OFF || menoMovimento()) return false;
        return !!(window.VideoQuality && typeof window.VideoQuality.isAlti === 'function' && window.VideoQuality.isAlti());
    }

    /** Le carte delle cinque scoperte nelle zone Magia/Trappola di entrambi i lati: [{ uid, id }]. */
    function carteInGioco() {
        const out = [];
        if (typeof gameState === 'undefined' || !gameState) return out;
        ['player', 'bot'].forEach((posto) => {
            let st = [];
            try { st = Tavolo.magieTrappole(posto) || []; } catch (e) { st = []; }
            st.forEach((slot) => {
                if (slot && slot.card && !slot.isFaceDown && LETTERE[slot.card.id]) out.push({ uid: slot.card.uid, id: slot.card.id });
            });
        });
        return out;
    }

    // ---------- Il velo: Regno delle Ombre ----------
    function montaVelo() {
        if (layer) return;
        layer = document.createElement('div');
        layer.id = 'tavolaDestinoLayer';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = '<div class="td-buio"></div><div class="td-nebbia td-nebbia-a"></div><div class="td-nebbia td-nebbia-b"></div><div class="td-nebbia td-nebbia-c"></div>';
        document.body.appendChild(layer);
    }

    // ---------- La seduta spiritica (tela 2D) ----------
    function smoothstep(a) { const t = Math.max(0, Math.min(1, a)); return t * t * (3 - 2 * t); }
    const limita = (v) => Math.max(0, Math.min(1, v));

    function montaTela() {
        if (tela) return true;
        try {
            const c = document.createElement('canvas');
            c.id = 'tavolaDestinoSeduta';
            c.setAttribute('aria-hidden', 'true');
            const ctx = c.getContext('2d');
            if (!ctx) return false;
            x2 = ctx;
            document.body.appendChild(c);
            tela = c;
            misuraTela();
            window.addEventListener('resize', onResize);
            ultimoT = performance.now() / 1000;
            rid = requestAnimationFrame(ciclo);
            return true;
        } catch (e) {
            smontaTela();
            return false;
        }
    }

    function misuraTela() {
        if (!tela) return;
        const w = Math.max(32, window.innerWidth); const h = Math.max(32, window.innerHeight);
        // Fino a 2x (i fili sottili restano nitidi), con un tetto di pixel per i telefoni grandi.
        const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3000000 / (w * h)));
        tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
        x2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onResize() { misuraTela(); posiziona(); }

    function smontaTela() {
        if (rid) cancelAnimationFrame(rid);
        rid = 0;
        window.removeEventListener('resize', onResize);
        if (tela && tela.parentNode) tela.parentNode.removeChild(tela);
        tela = null; x2 = null;
        braci.length = 0; scia.length = 0; impulsi.clear(); qPrec = -1;
    }

    /** Le carte visibili nell'ordine della parola. */
    function ordinate() {
        return Array.from(lettere.values()).filter((L) => L.visibile)
            .sort((a, b) => ORDINE.indexOf(a.lettera) - ORDINE.indexOf(b.lettera));
    }

    /** Il punto di un filo curvo (leggero arco) da A a B al parametro u (0..1). */
    function puntoFilo(A, B, u) {
        const mx = (A.x + B.x) / 2; const my = (A.y + B.y) / 2;
        const dx = B.x - A.x; const dy = B.y - A.y;
        const cx = mx - dy * 0.14; const cy = my + dx * 0.14;   // controllo spostato di lato: il filo non e' una retta
        const v = 1 - u;
        return { x: v * v * A.x + 2 * v * u * cx + u * u * B.x, y: v * v * A.y + 2 * v * u * cy + u * u * B.y };
    }

    function disegnaFilo(A, B, grow, t) {
        if (grow <= 0.001) return;
        const passi = 36;
        const fine = Math.round(passi * grow);
        const percorso = () => {
            x2.beginPath();
            for (let i = 0; i <= fine; i++) {
                const p = puntoFilo(A, B, i / passi);
                if (i === 0) x2.moveTo(p.x, p.y); else x2.lineTo(p.x, p.y);
            }
        };
        x2.lineCap = 'round'; x2.lineJoin = 'round';
        x2.setLineDash([]);
        percorso(); x2.strokeStyle = rgba(VIOLA, 0.16); x2.lineWidth = 8; x2.stroke();
        percorso(); x2.strokeStyle = rgba(AZZURRO, 0.35); x2.lineWidth = 3; x2.stroke();
        // Il filo "scorre": tratti luminosi che avanzano
        x2.setLineDash([5, 15]); x2.lineDashOffset = -t * 36;
        percorso(); x2.strokeStyle = rgba(BIANCO, 0.85); x2.lineWidth = 1.4; x2.stroke();
        x2.setLineDash([]);
        if (grow < 1) {
            // La punta in crescita brilla
            const p = puntoFilo(A, B, grow);
            const g = x2.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
            g.addColorStop(0, rgba(BIANCO, 0.95)); g.addColorStop(1, rgba(AZZURRO, 0));
            x2.fillStyle = g; x2.beginPath(); x2.arc(p.x, p.y, 9, 0, Math.PI * 2); x2.fill();
        }
    }

    function disegnaSigillo(L, t) {
        const eta = t - L.nato;
        const r = L.s * 0.62;
        const anello = smoothstep(eta / DURATA_ANELLO_S);
        const brilla = 0.75 + 0.25 * Math.sin(t * 2.1 + L.x * 0.01);

        // Anello esterno che si TRACCIA (poi resta intero) e alone
        x2.setLineDash([]); x2.lineCap = 'round';
        x2.beginPath(); x2.arc(L.x, L.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * anello);
        x2.strokeStyle = rgba(VIOLA, 0.28 * brilla); x2.lineWidth = 6; x2.stroke();
        x2.beginPath(); x2.arc(L.x, L.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * anello);
        x2.strokeStyle = rgba(BIANCO, 0.9 * brilla); x2.lineWidth = 1.6; x2.stroke();
        if (anello < 1) {
            // La punta che incide
            const a = -Math.PI / 2 + Math.PI * 2 * anello;
            const px = L.x + Math.cos(a) * r; const py = L.y + Math.sin(a) * r;
            const g = x2.createRadialGradient(px, py, 0, px, py, 8);
            g.addColorStop(0, rgba(BIANCO, 1)); g.addColorStop(1, rgba(VIOLA, 0));
            x2.fillStyle = g; x2.beginPath(); x2.arc(px, py, 8, 0, Math.PI * 2); x2.fill();
        }
        if (anello > 0.3) {
            const aa = smoothstep((anello - 0.3) / 0.7);
            // Secondo anello tratteggiato che gira al contrario
            x2.save(); x2.translate(L.x, L.y); x2.rotate(-t * 0.35);
            x2.setLineDash([2, 7]);
            x2.beginPath(); x2.arc(0, 0, r * 0.82, 0, Math.PI * 2);
            x2.strokeStyle = rgba(AZZURRO, 0.55 * aa); x2.lineWidth = 1.3; x2.stroke();
            // Le tacche del cerchio esterno
            x2.setLineDash([]); x2.rotate(t * 0.35 + t * 0.12);
            x2.strokeStyle = rgba(VIOLA, 0.7 * aa); x2.lineWidth = 1.2;
            for (let i = 0; i < 24; i++) {
                const a = (Math.PI * 2 * i) / 24;
                const lun = i % 6 === 0 ? 7 : 3.5;
                x2.beginPath(); x2.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)); x2.lineTo(Math.cos(a) * (r + 3 + lun), Math.sin(a) * (r + 3 + lun)); x2.stroke();
            }
            x2.restore();
        }

        // La lettera: si accende dopo l'anello, con un lampo
        const la = smoothstep((eta - DURATA_ANELLO_S * 0.75) / 0.7);
        if (la > 0) {
            const fs = Math.round(L.s * 0.92);
            x2.save();
            x2.font = `700 ${fs}px "Cinzel Decorative", "Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif`;
            x2.textAlign = 'center'; x2.textBaseline = 'middle';
            x2.shadowColor = rgba(VIOLA, 0.95); x2.shadowBlur = L.s * 0.55;
            x2.fillStyle = rgba(VIOLA, 0.55 * la); x2.fillText(L.lettera, L.x, L.y + fs * 0.04);
            x2.shadowColor = rgba(AZZURRO, 0.9); x2.shadowBlur = L.s * 0.18;
            x2.fillStyle = rgba(BIANCO, 0.95 * la * brilla); x2.fillText(L.lettera, L.x, L.y + fs * 0.04);
            x2.restore();
            // Il lampo dell'accensione
            const f = 1 - limita((eta - DURATA_ANELLO_S * 0.75) / 0.45);
            if (f > 0.01) {
                const g = x2.createRadialGradient(L.x, L.y, 0, L.x, L.y, r * 1.5);
                g.addColorStop(0, rgba(BIANCO, 0.8 * f)); g.addColorStop(0.5, rgba(VIOLA, 0.35 * f)); g.addColorStop(1, rgba(VIOLA, 0));
                x2.fillStyle = g; x2.beginPath(); x2.arc(L.x, L.y, r * 1.5, 0, Math.PI * 2); x2.fill();
            }
        }

        // L'onda quando il fuoco fatuo passa di qui
        const tp = impulsi.get(L.uid);
        if (tp !== undefined) {
            const p = (t - tp) / 0.9;
            if (p >= 0 && p < 1) {
                x2.beginPath(); x2.arc(L.x, L.y, r * (1 + 0.9 * p), 0, Math.PI * 2);
                x2.strokeStyle = rgba(BIANCO, 0.7 * (1 - p)); x2.lineWidth = 2.2 * (1 - p) + 0.5; x2.stroke();
            }
        }
    }

    function aggiornaBraci(ord, dt) {
        // Dai sigilli cadono lente braci viola (piu' carte, piu' braci)
        ord.forEach((L) => {
            if (t0(L) < 0.9) return;
            if (Math.random() < dt * 5 && braci.length < MAX_BRACI) {
                braci.push({
                    x: L.x + (Math.random() - 0.5) * L.s * 0.9, y: L.y + L.s * 0.25 + Math.random() * L.s * 0.2,
                    vx: (Math.random() - 0.5) * 10, vy: 14 + Math.random() * 22,
                    vita: 0, max: 1.6 + Math.random() * 1.4, r: 0.8 + Math.random() * 1.5, caldo: Math.random() < 0.3
                });
            }
        });
        for (let i = braci.length - 1; i >= 0; i--) {
            const b = braci[i];
            b.vita += dt; b.x += (b.vx + Math.sin(b.vita * 3 + i) * 8) * dt; b.y += b.vy * dt;
            if (b.vita >= b.max) braci.splice(i, 1);
        }
    }
    function t0(L) { return performance.now() / 1000 - L.nato; }

    function disegnaBraci() {
        braci.forEach((b) => {
            const a = 1 - b.vita / b.max;
            x2.fillStyle = rgba(b.caldo ? BRACE : VIOLA, 0.75 * a);
            x2.beginPath(); x2.arc(b.x, b.y, b.r, 0, Math.PI * 2); x2.fill();
        });
    }

    /** Il fuoco fatuo: percorre avanti e indietro i fili gia' completi; da solo, gira attorno alla carta. Torna { x, y } o null. */
    function fuocoFatuo(ord, tratti, t) {
        if (!ord.length) return null;
        // Tratti COMPLETI di fila a partire dalla prima carta
        let completi = 0;
        while (completi < tratti.length && tratti[completi].grow >= 1) completi++;
        if (completi === 0) {
            const L = ord[ord.length - 1];
            const a = t * 1.5;
            qPrec = -1;
            return { x: L.x + Math.cos(a) * L.s * 0.95, y: L.y + Math.sin(a * 1.3) * L.s * 0.7 };
        }
        const ph = (t / SECONDI_PER_TRATTO) % (2 * completi);
        const q = ph < completi ? ph : 2 * completi - ph;
        // A ogni carta raggiunta il suo sigillo pulsa
        if (qPrec >= 0 && Math.floor(q + 0.5) !== Math.floor(qPrec + 0.5)) {
            const k = Math.floor(q + 0.5);
            if (ord[k]) impulsi.set(ord[k].uid, t);
        }
        qPrec = q;
        const i = Math.min(Math.floor(q), completi - 1);
        const u = smoothstep(q - i);
        return puntoFilo(ord[i], ord[i + 1], u);
    }

    function disegnaFuoco(p, t) {
        scia.push({ x: p.x, y: p.y, t: t });
        while (scia.length > MAX_SCIA) scia.shift();
        for (let i = 0; i < scia.length; i++) {
            const s = scia[i];
            const k = i / scia.length;
            const g = x2.createRadialGradient(s.x, s.y, 0, s.x, s.y, 2 + 6 * k);
            g.addColorStop(0, rgba(AZZURRO, 0.55 * k)); g.addColorStop(1, rgba(VIOLA, 0));
            x2.fillStyle = g; x2.beginPath(); x2.arc(s.x, s.y, 2 + 6 * k, 0, Math.PI * 2); x2.fill();
        }
        const tremolio = 0.85 + 0.15 * Math.sin(t * 17);
        const g = x2.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20 * tremolio);
        g.addColorStop(0, rgba(BIANCO, 1)); g.addColorStop(0.25, rgba(AZZURRO, 0.8)); g.addColorStop(1, rgba(VIOLA, 0));
        x2.fillStyle = g; x2.beginPath(); x2.arc(p.x, p.y, 20 * tremolio, 0, Math.PI * 2); x2.fill();
    }

    function ciclo(ts) {
        if (!tela || !x2) return;
        const t = ts / 1000;
        const dt = Math.max(0, Math.min(0.05, t - ultimoT));
        ultimoT = t;
        x2.clearRect(0, 0, window.innerWidth, window.innerHeight);
        const ord = ordinate();
        if (ord.length) {
            x2.save();
            x2.globalCompositeOperation = 'lighter';
            // I fili fra carte consecutive della parola
            const tratti = [];
            for (let i = 0; i + 1 < ord.length; i++) {
                const A = ord[i]; const B = ord[i + 1];
                const grow = limita((t - Math.max(A.nato, B.nato) - 0.5) / DURATA_FILO_S);
                tratti.push({ A: A, B: B, grow: smoothstep(grow) });
            }
            tratti.forEach((s) => disegnaFilo(s.A, s.B, s.grow, t));
            ord.forEach((L) => disegnaSigillo(L, t));
            aggiornaBraci(ord, dt);
            disegnaBraci();
            const p = fuocoFatuo(ord, tratti, t);
            if (p) disegnaFuoco(p, t);
            x2.restore();
        }
        rid = requestAnimationFrame(ciclo);
    }

    /** Rilegge dove sta ogni carta (rettangolo a schermo) e ci appoggia il sigillo: centrato SULLA carta (sta dentro il suo riquadro: non copre le altre caselle). */
    function posiziona() {
        lettere.forEach((L) => {
            const el = document.querySelector(`#playerFieldBoard [data-uid="${L.uid}"], #botFieldBoard [data-uid="${L.uid}"]`);
            if (!el) { L.visibile = false; return; }
            const q = el.getBoundingClientRect();
            if (q.width < 2) { L.visibile = false; return; }
            L.visibile = true;
            const lato = Math.min(q.width, q.height);
            L.s = lato * 0.9;
            L.x = q.left + q.width / 2;
            L.y = q.top + q.height / 2;
        });
    }

    /** Sigilli di ripiego (senza tela): la lettera dentro un anello, fermi. */
    function sincronizzaTesto(carte) {
        // I sigilli stanno in un contenitore PROPRIO sul body: il velo e' uno strato a z-index 1 (sotto le carte) e il suo
        // z-index interno non uscirebbe da li'.
        if (!testi) { testi = document.createElement('div'); testi.id = 'tavolaDestinoTesti'; testi.setAttribute('aria-hidden', 'true'); document.body.appendChild(testi); }
        testi.querySelectorAll('.td-lettera').forEach((e) => { if (!carte.some((c) => c.uid === e.dataset.uid)) e.remove(); });
        carte.forEach((c) => {
            const L = lettere.get(c.uid);
            let el = testi.querySelector(`.td-lettera[data-uid="${c.uid}"]`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'td-lettera'; el.dataset.uid = c.uid; el.textContent = LETTERE[c.id];
                testi.appendChild(el);
            }
            if (L && L.visibile) {
                const d = L.s * 1.24;
                el.style.left = L.x + 'px'; el.style.top = L.y + 'px';
                el.style.width = d + 'px'; el.style.height = d + 'px';
                el.style.fontSize = (L.s * 0.78) + 'px';
                el.style.display = '';
            } else el.style.display = 'none';
        });
    }

    function rimuoviTutto() {
        smontaTela();
        lettere.clear();
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
        layer = null;
        if (testi) { testi.remove(); testi = null; }
    }

    /**
     * Allinea quello che si vede alle carte scoperte. Sicuro a ogni ridisegno: senza nessuna delle cinque toglie ogni
     * traccia (anche cambiando duello: `gameState` nuovo).
     */
    function sync() {
        const carte = carteInGioco();
        if (!carte.length) { if (layer || tela) rimuoviTutto(); return; }
        montaVelo();
        // Piu' carte della parola sono in gioco, piu' fitto e' il buio (0,55 con una, 1 con tutte e cinque).
        layer.style.setProperty('--td-intensita', String(0.55 + 0.1125 * Math.min(5, carte.length)));
        const ora = performance.now() / 1000;
        const uids = new Set(carte.map((c) => c.uid));
        lettere.forEach((_, uid) => { if (!uids.has(uid)) { lettere.delete(uid); impulsi.delete(uid); } });
        carte.forEach((c) => {
            if (!lettere.has(c.uid)) lettere.set(c.uid, { uid: c.uid, lettera: LETTERE[c.id], nato: ora, x: 0, y: 0, s: 80, visibile: false });
        });
        posiziona();
        if (animazioneConsentita() && montaTela()) {
            if (testi) { testi.remove(); testi = null; }
        } else {
            smontaTela();
            sincronizzaTesto(carte);
        }
    }

    window.TavolaDestino = { sync: sync, rimuovi: rimuoviTutto, lettere: () => Array.from(lettere.values()).map((L) => ({ uid: L.uid, lettera: L.lettera, visibile: L.visibile })) };
})();
