// L'IA non usa una carta che distrugge UNA Magia/Trappola a bersaglio quando l'unica carta che potrebbe colpire e' una sua
// (segnalato giocando: Kaiba usava Tifone Spaziale Mistico per distruggere le proprie Spade Rivelatrici, piu' di una
// volta e con ogni Duellante). Due difese: l'IA non la attiva (AI_SHARED.distruggeSoloMagieTrappoleSue) e, se la carta
// parte lo stesso, il bot sceglie solo carte dell'avversario (607 Tifone, 195 Annulla Carta Magia, 417 Rimuovi Trappola,
// 647 Distruzione Schiacciante, 881 Nobiluomo dello Sterminio).
module.exports = {
    name: 'IA: mai distruggere le proprie Magie/Trappole con Tifone & co.',
    async run(t) {
        const r = await t.evaluate(async () => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const carta = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const slot = (id, uid, coperta) => ({ card: carta(id, uid), position: 'attack', isFaceDown: !!coperta });
            const vuoto = () => [null, null, null, null, null];
            const out = {};
            const fx = window.FX;
            window.FX = null; // niente animazioni: la distruzione di Tifone parte da una callback
            try {
                // Il bot ha le sue Spade Rivelatrici scoperte e una Trappola Set; l'avversario non ha niente.
                gameState.botSTField = [slot(8, 'sue-spade'), slot(10, 'sua-trappola', true), null, null, null];
                gameState.playerSTField = vuoto();
                const ok = (id) => AI_SHARED.attivazioneSensata(carta(id, 'x' + id), 'bot', 'hand');
                out.senzaBersaglio = [607, 195, 417, 647, 881].map(ok);

                // Se la carta parte lo stesso, il bot non tocca le sue.
                [607, 195, 417, 647, 881].forEach((id) => {
                    const ctx = DuelEngine.makeContext('bot', { card: carta(id, 'x' + id), zone: 'hand', index: 0 });
                    try { DuelEngine.getDefinition(id).activate(ctx); } catch (e) { out['errore' + id] = String(e); }
                });
                out.sueIntatte = gameState.botSTField.filter(Boolean).length === 2 && !gameState.botGraveyard.some((c) => c.uid === 'sue-spade' || c.uid === 'sua-trappola');

                // L'avversario ha una Trappola Set: Tifone (e i parenti che colpiscono anche le coperte) ora hanno un bersaglio.
                gameState.playerSTField = [slot(10, 'loro-trappola', true), null, null, null, null];
                out.conCoperta = { tifone: ok(607), annulla: ok(195), nobiluomo: ok(881), rimuoviTrappola: ok(417) };
                // Rimuovi Trappola vuole una Trappola SCOPERTA: una coperta non basta.
                gameState.playerSTField = [slot(10, 'loro-scoperta'), null, null, null, null];
                out.conScoperta = { rimuoviTrappola: ok(417), nobiluomo: ok(881) };

                // Il bot usa Tifone: colpisce la carta avversaria, non le sue.
                gameState.playerSTField = [slot(10, 'loro-trappola', true), null, null, null, null];
                const ctx = DuelEngine.makeContext('bot', { card: carta(607, 'tifone'), zone: 'hand', index: 0 });
                DuelEngine.getDefinition(607).activate(ctx);
                out.colpitaLoro = gameState.playerSTField[0] === null && gameState.playerGraveyard.some((c) => c.uid === 'loro-trappola');
                out.sueDopoTifone = gameState.botSTField.filter(Boolean).length === 2;
            } finally {
                window.FX = fx;
            }
            return out;
        });
        t.assert(r.senzaBersaglio.every((v) => v === false), 'Senza Magie/Trappole avversarie l\'IA non attiva nessuna delle cinque: ' + JSON.stringify(r.senzaBersaglio));
        t.assert(r.sueIntatte, 'Anche se la carta parte, il bot non distrugge le proprie: ' + JSON.stringify(r));
        t.assert(r.conCoperta.tifone && r.conCoperta.annulla && r.conCoperta.nobiluomo, 'Con una Trappola Set avversaria Tifone, Annulla Carta Magia e Nobiluomo tornano attivabili: ' + JSON.stringify(r.conCoperta));
        t.assert(r.conCoperta.rimuoviTrappola === false, 'Rimuovi Trappola non basta una Trappola coperta avversaria: ' + JSON.stringify(r.conCoperta));
        t.assert(r.conScoperta.rimuoviTrappola === true && r.conScoperta.nobiluomo === false, 'Con una Trappola scoperta serve Rimuovi Trappola, non Nobiluomo (vuole una coperta): ' + JSON.stringify(r.conScoperta));
        t.assert(r.colpitaLoro && r.sueDopoTifone, 'Tifone del bot colpisce la carta avversaria e lascia intatte le sue: ' + JSON.stringify(r));
    }
};
