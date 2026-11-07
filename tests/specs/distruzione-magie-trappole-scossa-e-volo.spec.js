// Richiesta dell'utente (2026-11-07): una Magia o Trappola piazzata sul Terreno, distrutta da un effetto, fa un'animazione di circa
// UN SECONDO di distruzione con effetto SCOSSA, e poi vola (animata) al Cimitero. La regola non aspetta: la carta e' gia' nel
// Cimitero quando l'animazione parte (e' solo grafica).
module.exports = {
    name: 'Distruzione Magia/Trappola: scossa di un secondo e poi volo animato al Cimitero',
    async run(t) {
        await t.evaluate(() => {
            const spell = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype !== 'field'), uid: 'scossa-spell' };
            gameState.playerSTField = [{ card: spell, isFaceDown: false, setOnTurn: 0 }, null, null, null, null];
            gameState.playerGraveyard = [];
            updateUI();
        });
        await t.page.waitForTimeout(400);
        const inizio = await t.evaluate(() => {
            DuelEngine.actions.destroySpellTrap.call({ owner: 'bot' }, 'player', 0);
            const carta = document.querySelector('.fx-st-shatter .fx-st-shatter-card');
            const cs = carta && getComputedStyle(carta);
            return {
                scena: !!document.querySelector('.fx-st-shatter'),
                animazione: cs && cs.animationName,
                durata: cs && cs.animationDuration,
                regolaGia: gameState.playerGraveyard.length === 1 && gameState.playerSTField[0] === null,
                voloSubito: !!document.querySelector('.fx-card-travel')
            };
        });
        t.assert(inizio.scena && inizio.animazione === 'fxStShake', 'La carta distrutta scuote sul posto: ' + JSON.stringify(inizio));
        t.assert(inizio.durata === '1s', 'La scossa dura un secondo: ' + JSON.stringify(inizio));
        t.assert(inizio.regolaGia, 'La regola non aspetta l\'animazione: carta gia\' nel Cimitero e casella vuota: ' + JSON.stringify(inizio));
        t.assert(!inizio.voloSubito, 'All\'inizio la carta scuote, non sta ancora volando: ' + JSON.stringify(inizio));

        // A meta' scossa (~500ms) ancora nessun volo.
        await t.page.waitForTimeout(450);
        const meta = await t.evaluate(() => ({ volo: !!document.querySelector('.fx-card-travel'), scena: !!document.querySelector('.fx-st-shatter') }));
        t.assert(meta.scena && !meta.volo, 'A meta\' scossa la carta e\' ancora li\': ' + JSON.stringify(meta));

        // Subito dopo il secondo la carta vola verso il Cimitero (un fantasma `fx-card-travel` diretto alla pila).
        const volo = await t.page.waitForFunction(() => {
            const g = document.querySelector('.fx-card-travel');
            return g ? { x: g.getBoundingClientRect().left } : null;
        }, null, { timeout: 2500 }).then((h) => h.jsonValue()).catch(() => null);
        t.assert(volo, 'Dopo la scossa la carta vola al Cimitero (fantasma fx-card-travel)');

        // Fine: nessun residuo a schermo.
        await t.page.waitForTimeout(2200);
        const fine = await t.evaluate(() => ({
            scena: document.querySelectorAll('.fx-st-shatter').length,
            volo: document.querySelectorAll('.fx-card-travel').length,
            shake: !!(document.querySelector('.game-container') || document.body).classList.contains('fx-shake')
        }));
        t.assert(fine.scena === 0 && fine.volo === 0 && !fine.shake, 'Finita l\'animazione non resta nulla a schermo: ' + JSON.stringify(fine));
    }
};
