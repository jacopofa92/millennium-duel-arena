/**
 * bacino-effetti.js — adattatore per tools/cernita-effetti.js (--verifica). NON e' codice di gioco.
 *
 * Si carica con `scriptAggiuntivi` dentro il contesto del duello senza testa (tools/duello-senza-testa.js), dopo motore,
 * regole e IA e PRIMA che parta la partita. Legge `window.__BACINO`, scritto dal preludio:
 *
 *   { modo: 'originale',  pool: [id...] }
 *       il gioco com'e': si limita a CONTARE quante volte parte l'effetto di ogni carta del bacino.
 *   { modo: 'travestito', pool: [id...], mappa: { idVecchio: idNuovo }, nomi: { idVecchio: 'nome neutro' } }
 *       il MONDO DEL CLONE: restano nel database SOLO le carte del bacino, ciascuna con un id nuovo e un nome inventato.
 *       Le carte Yu-Gi-Oh only non esistono piu'. Se l'effetto di una carta del bacino dipendeva di nascosto da un id o da
 *       un nome (o da una carta che non c'e' piu'), qui si comporta in modo diverso, o non parte piu'.
 *
 * PERCHE' si registra la STESSA definizione sotto l'id nuovo invece di riscriverla: e' proprio il codice vero della carta
 * che vogliamo mettere alla prova.
 *
 * Il conteggio (`window.__conta`, chiave 'idOriginale:gancio') avvolge solo i ganci che ESEGUONO un effetto (activate e
 * i on*), non i predicati (canActivate, static): serve a sapere se un effetto e' davvero partito, e a confrontare i due mondi.
 */
(function () {
    'use strict';
    const B = window.__BACINO;
    if (!B) return;
    window.__conta = {};
    const esegue = (k) => k === 'activate' || /^on[A-Z]/.test(k);

    function strumenta(idOriginale, def) {
        if (def.__strumentata) return;
        Object.defineProperty(def, '__strumentata', { value: true, enumerable: false });
        Object.keys(def).forEach((k) => {
            if (typeof def[k] !== 'function' || !esegue(k)) return;
            const originale = def[k];
            def[k] = function () {
                const chiave = idOriginale + ':' + k;
                window.__conta[chiave] = (window.__conta[chiave] || 0) + 1;
                return originale.apply(this, arguments);
            };
        });
    }

    // resetGameState costruisce PRIMA un mazzo dimostrativo pescando a caso dal database (buildBalancedDemoDeckSpec) e solo dopo
    // il simulatore lo sostituisce col mazzo vero: quel pescaggio consuma numeri casuali in quantita' che dipende da QUANTE carte ci
    // sono nel database, quindi nei due mondi le mani iniziali uscirebbero diverse per colpa del simulatore, non delle carte.
    // Un mazzo dimostrativo fisso (e uguale nei due mondi) non consuma nulla.
    const demo = B.pool.slice(0, 40);
    buildBalancedDemoDeckSpec = function () {
        return { main: demo.map((id) => ({ id: B.modo === 'travestito' ? B.mappa[id] : id, qty: 1 })), extra: [] };
    };

    const pool = new Set(B.pool);
    const nuove = [];
    cardDatabase.slice().forEach((c) => {
        if (!pool.has(c.id)) return;
        const def = DuelEngine.getDefinition(c.id);
        if (def) strumenta(c.id, def);
        if (B.modo !== 'travestito') return;
        const idNuovo = B.mappa[c.id];
        if (def) CardEffects.register(idNuovo, def);
        nuove.push(Object.assign({}, c, { id: idNuovo, name: B.nomi[c.id] }));
    });
    if (B.modo === 'travestito') {
        cardDatabase.length = 0;
        nuove.forEach((c) => cardDatabase.push(c));
    }
})();
