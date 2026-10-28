/**
 * tavola-del-destino.js — Tavola del Destino (Destiny Board): campo nel Regno delle Ombre e lettere di FUMO.
 * ---------------------------------------------------------------------------------------------------------
 * Le 5 carte (id 866 Tavola del Destino + 867-870 Spirit Message "I"/"N"/"A"/"L") scoperte in zona Magia/Trappola
 * scrivono insieme la parola DEATH (D-E-A-T-H, come le lettere dipinte sulle carte: la stessa del banner di vittoria in game-flow.js). Qui si legge SOLO lo stato del
 * Terreno, a ogni ridisegno (`sync`, chiamato da ridisegnaDuello come DuelFeedback), e si disegna:
 *   - appena una delle cinque e' scoperta, il campo si oscura nel Regno delle Ombre: velo viola-nero con nebbia che
 *     scorre, SOTTO le carte (z-index 1; `.game-container` sta a 2), piu' fitto con l'aumentare delle carte;
 *   - sopra ogni carta scoperta, la sua lettera DISEGNATA DAL FUMO: non un ologramma, ma centinaia di sbuffi morbidi
 *     che dal basso si avvolgono e si raccolgono nei punti della lettera, poi la tengono viva (respira, si sfilaccia in
 *     volute che salgono e si dissolvono) finche' la carta resta scoperta.
 * Nessuna regola qui: carte e vittoria stanno nel motore (card-effects-7.js, hasDestinyBoardComplete in fasi.js).
 *
 * Il fumo e' una sola tela 2D a tutto schermo (nessun WebGL: i puntini morbidi sono sprite) con i Dettagli video "Alti" e
 * senza movimento ridotto; altrimenti restano il velo scuro e le lettere come testo sfumato. La tela esiste solo mentre
 * c'e' almeno una lettera.
 */
(function () {
    'use strict';

    const LETTERE = { 866: 'D', 867: 'E', 868: 'A', 869: 'T', 870: 'H' };
    const PUNTI_PER_LETTERA = 420;     // sbuffi che compongono il corpo della lettera
    const VOLUTE_PER_LETTERA = 45;     // sbuffi che salgono e si dissolvono

    let layer = null;        // il velo scuro (div)
    let testi = null;        // le lettere di ripiego (solo senza tela)
    let tela = null;         // la tela del fumo
    let ctx = null;
    let rid = 0;
    let sprite = null;       // lo sbuffo morbido, disegnato una volta
    const lettere = new Map();   // uid -> { uid, lettera, nato, x, y, s, punti[], volute[] }
    const glifi = new Map();     // 'F' -> punti campionati dal glifo (-.5..+.5)

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function fumoConsentito() {
        if (window.TAVOLA_DESTINO_FUMO_OFF || menoMovimento()) return false;
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

    // ---------- Il fumo ----------
    function creaSprite() {
        if (sprite) return sprite;
        sprite = document.createElement('canvas');
        sprite.width = sprite.height = 64;
        const c = sprite.getContext('2d');
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(240,228,255,1)');
        g.addColorStop(0.35, 'rgba(190,165,235,.55)');
        g.addColorStop(1, 'rgba(120,90,190,0)');
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
        return sprite;
    }

    /** I punti (da -.5 a +.5) che coprono il glifo della lettera: si campiona un testo grosso su una tela di servizio. */
    function punti(lettera) {
        if (glifi.has(lettera)) return glifi.get(lettera);
        const N = 120;
        const c = document.createElement('canvas'); c.width = c.height = N;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `900 ${Math.round(N * 0.92)}px Impact, "Arial Black", "Segoe UI Black", sans-serif`;
        x.fillText(lettera, N / 2, N / 2 + N * 0.04);
        const d = x.getImageData(0, 0, N, N).data;
        const tutti = [];
        for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 2) if (d[(j * N + i) * 4 + 3] > 128) tutti.push({ x: i / N - 0.5, y: j / N - 0.5 });
        glifi.set(lettera, tutti);
        return tutti;
    }

    function nuovaLettera(uid, lettera, ora) {
        const base = punti(lettera);
        const pts = [];
        for (let k = 0; k < PUNTI_PER_LETTERA; k++) {
            const h = base[Math.floor(Math.random() * base.length)] || { x: 0, y: 0 };
            pts.push({ hx: h.x, hy: h.y, rit: Math.random() * 1.9, fase: Math.random() * 6.28, vel: 0.6 + Math.random() * 0.9, r: 0.8 + Math.random() * 0.7, sx: (Math.random() - 0.5) * 1.6, sy: 0.7 + Math.random() * 0.9 });
        }
        const vol = [];
        for (let k = 0; k < VOLUTE_PER_LETTERA; k++) vol.push({ vita: Math.random(), pt: base[Math.floor(Math.random() * base.length)] || { x: 0, y: 0 }, d: (Math.random() - 0.5) * 0.5, v: 0.12 + Math.random() * 0.14, fase: Math.random() * 6.28 });
        return { uid: uid, lettera: lettera, nato: ora, x: 0, y: 0, s: 80, punti: pts, volute: vol, visibile: false };
    }

    /** Rilegge dove sta ogni carta (rettangolo a schermo) e ci appoggia la lettera: centrata SOPRA la carta, non sulla sua illustrazione (che ha gia' la sua lettera dipinta). */
    function posiziona() {
        lettere.forEach((L) => {
            const el = document.querySelector(`#playerFieldBoard [data-uid="${L.uid}"], #botFieldBoard [data-uid="${L.uid}"]`);
            if (!el) { L.visibile = false; return; }
            const q = el.getBoundingClientRect();
            if (q.width < 2) { L.visibile = false; return; }
            L.visibile = true;
            const lato = Math.max(q.width, q.height);
            L.s = lato * 1.3;
            L.x = q.left + q.width / 2;
            L.y = q.top - q.height * 0.38;
        });
    }

    function misuraTela() {
        if (!tela) return;
        tela.width = Math.max(32, window.innerWidth); tela.height = Math.max(32, window.innerHeight);
    }

    function ciclo(ts) {
        if (!tela || !ctx) return;
        const t = ts / 1000;
        ctx.clearRect(0, 0, tela.width, tela.height);
        ctx.globalCompositeOperation = 'lighter';
        const spr = creaSprite();
        lettere.forEach((L) => {
            if (!L.visibile) return;
            const eta = t - L.nato;
            const S = L.s;
            // Corpo: ogni sbuffo parte sotto, in spirale, e si raccoglie nel suo punto della lettera
            for (let k = 0; k < L.punti.length; k++) {
                const p = L.punti[k];
                const f = Math.min(1, Math.max(0, (eta - p.rit) / 1.5));
                if (f <= 0) continue;
                const e = 1 - Math.pow(1 - f, 3);
                const vx = (1 - e) * (p.sx * 0.9 + Math.sin(eta * 2 + p.fase) * 0.25);
                const vy = (1 - e) * p.sy;
                const respiro = Math.sin(t * p.vel + p.fase);
                const x = L.x + (p.hx + vx + respiro * 0.012) * S;
                const y = L.y + (p.hy + vy + Math.cos(t * p.vel * 0.8 + p.fase) * 0.012) * S;
                const r = S * 0.034 * p.r * (0.85 + 0.25 * respiro);
                ctx.globalAlpha = Math.min(0.42, 0.42 * e) * (0.75 + 0.25 * respiro);
                ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
            }
            // Volute: fili di fumo che si staccano dalla lettera, salgono ondeggiando e si dissolvono
            const nato = Math.min(1, Math.max(0, (eta - 0.8) / 1.2));
            for (let k = 0; k < L.volute.length; k++) {
                const v = L.volute[k];
                const vita = (v.vita + t * v.v * 0.5) % 1;
                const alza = vita * 0.55;
                const x = L.x + (v.pt.x + v.d * vita + Math.sin(t * 1.4 + v.fase + vita * 5) * 0.05 * vita) * S;
                const y = L.y + (v.pt.y - alza) * S;
                const r = S * (0.03 + 0.05 * vita);
                ctx.globalAlpha = 0.13 * nato * Math.sin(Math.PI * vita);
                ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
            }
        });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        rid = requestAnimationFrame(ciclo);
    }

    function montaTela() {
        if (tela) return;
        tela = document.createElement('canvas');
        tela.id = 'tavolaDestinoFumo';
        tela.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tela);
        ctx = tela.getContext('2d');
        misuraTela();
        window.addEventListener('resize', onResize);
        rid = requestAnimationFrame(ciclo);
    }
    function onResize() { misuraTela(); posiziona(); }

    function smontaTela() {
        if (rid) cancelAnimationFrame(rid);
        rid = 0;
        window.removeEventListener('resize', onResize);
        if (tela && tela.parentNode) tela.parentNode.removeChild(tela);
        tela = null; ctx = null;
    }

    /** Lettere di ripiego (senza tela): testo sfumato, una per carta, che respira. */
    function sincronizzaTesto(carte) {
        // Le lettere stanno in un contenitore PROPRIO sul body: il velo e' uno strato a z-index 1 (sotto le carte) e il suo
        // z-index interno non uscirebbe da li'.
        if (!testi) { testi = document.createElement('div'); testi.id = 'tavolaDestinoTesti'; testi.setAttribute('aria-hidden', 'true'); document.body.appendChild(testi); }
        const volute = testi.querySelectorAll('.td-lettera');
        volute.forEach((e) => { if (!carte.some((c) => c.uid === e.dataset.uid)) e.remove(); });
        carte.forEach((c) => {
            const L = lettere.get(c.uid);
            let el = testi.querySelector(`.td-lettera[data-uid="${c.uid}"]`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'td-lettera'; el.dataset.uid = c.uid; el.textContent = LETTERE[c.id];
                testi.appendChild(el);
            }
            if (L && L.visibile) {
                el.style.left = L.x + 'px'; el.style.top = L.y + 'px'; el.style.fontSize = (L.s * 0.9) + 'px';
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
        lettere.forEach((_, uid) => { if (!uids.has(uid)) lettere.delete(uid); });
        carte.forEach((c) => { if (!lettere.has(c.uid)) lettere.set(c.uid, nuovaLettera(c.uid, LETTERE[c.id], ora)); });
        posiziona();
        if (fumoConsentito()) {
            if (testi) { testi.remove(); testi = null; }
            montaTela();
        } else {
            smontaTela();
            sincronizzaTesto(carte);
        }
    }

    window.TavolaDestino = { sync: sync, rimuovi: rimuoviTutto, lettere: () => Array.from(lettere.values()).map((L) => ({ uid: L.uid, lettera: L.lettera, visibile: L.visibile })) };
})();
