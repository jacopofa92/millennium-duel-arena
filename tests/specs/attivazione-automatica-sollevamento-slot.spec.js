// I trigger automatici di carte ancora sul campo devono restare nel loro
// slot; l'attivazione scelta dal giocatore conserva invece il primo piano.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Attivazione automatica: solleva la carta nello slot e conserva suono/durata',
    async run({ page, assert }) {
        await openDuel(page);
        const risultato = await page.evaluate(async () => {
            const source = document.createElement('div');
            source.className = 'card';
            source.dataset.uid = 'auto-trigger-test';
            source.style.cssText = 'width:72px;height:100px';
            document.body.appendChild(source);
            const lookup = window.findFieldCardElementByUid;
            window.findFieldCardElementByUid = (uid) => uid === 'auto-trigger-test' ? source : null;
            let suono = 0;
            const audio = window.AudioLibrary;
            window.AudioLibrary = { tryPlayCardSound: () => { suono++; return true; } };

            const durata = FX.ACTIVATE_CENTER_DURATION_MS;
            const partito = FX.playAutomaticFieldActivation({ uid: 'auto-trigger-test', type: 'spell' });
            const wrapper = document.querySelector('.fx-auto-field-lift');
            const posizione = wrapper && { left: wrapper.style.left, top: wrapper.style.top, width: wrapper.style.width };
            const nessunPrimoPiano = !document.querySelector('.fx-activate-center-card, .fx-activate-center-backdrop');
            await new Promise((resolve) => setTimeout(resolve, 300));
            const suonoAlMomentoGiusto = suono === 1;
            await new Promise((resolve) => setTimeout(resolve, durata));
            const rimosso = !document.querySelector('.fx-auto-field-lift');

            let zoom = null;
            const hologramSetting = window.HologramSetting;
            const holograms = window.MonsterHolograms;
            window.HologramSetting = { isAttivo: () => true };
            window.MonsterHolograms = { zoom: (uid, ms) => { zoom = { uid, ms }; return true; } };
            const attivatoMostro = FX.playAutomaticFieldActivation({ uid: 'auto-trigger-test', type: 'monster' });
            const nienteSollevamento = !document.querySelector('.fx-auto-field-lift');
            await new Promise((resolve) => setTimeout(resolve, 300));
            const stessoSuono = suono === 2;

            window.findFieldCardElementByUid = lookup;
            window.AudioLibrary = audio;
            window.HologramSetting = hologramSetting;
            window.MonsterHolograms = holograms;
            source.remove();
            return { partito, posizione, nessunPrimoPiano, suonoAlMomentoGiusto, durata, rimosso,
                attivatoMostro, nienteSollevamento, stessoSuono, zoom };
        });
        assert(risultato.partito && risultato.posizione && risultato.nessunPrimoPiano,
            `Il trigger parte nello slot senza overlay centrale: ${JSON.stringify(risultato)}`);
        assert(risultato.suonoAlMomentoGiusto && risultato.durata === 2000 && risultato.rimosso,
            `Stesso suono e durata di 2 secondi: ${JSON.stringify(risultato)}`);
        assert(risultato.attivatoMostro && risultato.nienteSollevamento
            && risultato.zoom && risultato.zoom.ms === 2000 && risultato.stessoSuono,
        `Con l'ologramma attivo si ingrandisce la proiezione per 2 secondi: ${JSON.stringify(risultato)}`);
    }
};
