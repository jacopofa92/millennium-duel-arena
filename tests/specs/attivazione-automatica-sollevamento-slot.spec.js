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
            // Conserva gli altri metodi usati dal normale ciclo del duello
            // (es. annunci di fase), sostituendo solo la riproduzione carta.
            window.AudioLibrary = Object.assign(Object.create(audio), {
                tryPlayCardSound: () => { suono++; return true; }
            });

            const durata = FX.ACTIVATE_CENTER_DURATION_MS;
            const cardBefore = document.querySelectorAll('.card[data-uid="auto-trigger-test"]').length;
            const partito = FX.playAutomaticFieldActivation({ uid: 'auto-trigger-test', type: 'spell' });
            const stessoNodoAnimato = source.getAnimations().length > 0;
            const nessunClone = document.querySelectorAll('.card[data-uid="auto-trigger-test"]').length === cardBefore;
            const nessunPrimoPiano = !document.querySelector('.fx-activate-center-card, .fx-activate-center-backdrop');
            await new Promise((resolve) => setTimeout(resolve, 300));
            const suonoAlMomentoGiusto = suono === 1;
            await new Promise((resolve) => setTimeout(resolve, durata));
            const animazioneTerminata = source.getAnimations().length === 0;

            let zoom = null;
            const hologramSetting = window.HologramSetting;
            const holograms = window.MonsterHolograms;
            window.HologramSetting = { isAttivo: () => true };
            window.MonsterHolograms = { zoom: (uid, ms) => { zoom = { uid, ms }; return true; } };
            const attivatoMostro = FX.playAutomaticFieldActivation({ uid: 'auto-trigger-test', type: 'monster' });
            const nienteSollevamento = source.getAnimations().length === 0;
            await new Promise((resolve) => setTimeout(resolve, 300));
            const stessoSuono = suono === 2;

            window.findFieldCardElementByUid = lookup;
            window.AudioLibrary = audio;
            window.HologramSetting = hologramSetting;
            window.MonsterHolograms = holograms;
            source.remove();
            return { partito, stessoNodoAnimato, nessunClone, nessunPrimoPiano, suonoAlMomentoGiusto, durata, animazioneTerminata,
                attivatoMostro, nienteSollevamento, stessoSuono, zoom };
        });
        assert(risultato.partito && risultato.stessoNodoAnimato && risultato.nessunClone && risultato.nessunPrimoPiano,
            `Si anima la carta reale senza clone né overlay centrale: ${JSON.stringify(risultato)}`);
        assert(risultato.suonoAlMomentoGiusto && risultato.durata === 2000 && risultato.animazioneTerminata,
            `Stesso suono e durata di 2 secondi: ${JSON.stringify(risultato)}`);
        assert(risultato.attivatoMostro && risultato.nienteSollevamento
            && risultato.zoom && risultato.zoom.ms === 2000 && risultato.stessoSuono,
        `Con l'ologramma attivo si ingrandisce la proiezione per 2 secondi: ${JSON.stringify(risultato)}`);
    }
};
