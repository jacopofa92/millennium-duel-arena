// Le icone dei pulsanti flottanti (Attacco/Difesa, Attiva effetto, Annulla, Conferma, Seleziona,
// Evocazione) sono scene WebGL animate (js/ui/icone-posizione-webgl.js), e sulla carta appena messa
// in Attacco/Difesa compare una scena singola. Qui: i pulsanti hanno un canvas e non l'emoji di prima,
// il click funziona ancora, la scena sulla carta parte e sparisce da sola, e con
// ICONE_POSIZIONE_WEBGL_OFF restano le icone di prima.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Icone flottanti in WebGL: pulsanti animati, scena sulla carta, ripiego sulle icone di prima',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.IconePosizione && typeof openQuickPopover === 'function');

        const r = await page.evaluate(async () => {
            const html = `<div class="quick-popover-actions">
                <button class="quick-popover-btn attack icon-round" id="t1"><span data-icon="attackPos"></span></button>
                <button class="quick-popover-btn defense icon-round" id="t2"><span data-icon="defensePos"></span></button>
                <button class="quick-popover-btn attack icon-round" id="t3"><span data-ico="spark">✨</span></button>
                <button class="quick-popover-btn cancel icon-round" id="t4"><span data-ico="cancel">✖</span></button>
                <button class="quick-popover-btn confirm icon-round" id="t5"><span data-ico="ok">✔</span></button>
                <button class="quick-popover-btn defense icon-round" id="t6"><span data-ico="card">🂠</span></button>
                <button class="quick-popover-btn attack icon-round" id="t7"><span data-ico="summon">🔺</span></button></div>`;
            let cliccato = 0;
            const pop = openQuickPopover(null, html, { bare: true });
            pop.querySelector('#t4').onclick = () => { cliccato++; };
            const canvas = pop.querySelectorAll('button canvas').length;
            const emoji = pop.textContent.replace(/\s+/g, '');
            pop.querySelector('#t4').click();
            const attive = IconePosizione.attive();
            closeQuickPopover();
            await new Promise((x) => setTimeout(x, 150));
            // Chiuso il popover le icone non devono continuare a girare.
            const dopoChiusura = IconePosizione.attive();

            // Scena sulla carta
            const card = document.querySelector('#playerFieldBoard .field-slot[data-type="monster"] .card') || document.querySelector('.card');
            // Si segue il canvas della scena per identita': altri canvas WebGL del duello (ambiente, ologrammi)
            // compaiono e spariscono da soli in body e falsavano il conteggio.
            const prima = document.querySelectorAll('body > canvas').length;
            const gia = new Set(document.querySelectorAll('body > canvas'));
            const ok = IconePosizione.sullaCarta(card, 'attack');
            const scena = [...document.querySelectorAll('body > canvas')].find((c) => !gia.has(c));
            const durante = prima + (scena && scena.isConnected ? 1 : 0);
            // La scena dura ~1,4 s: si aspetta che sparisca, con un tetto.
            for (let i = 0; i < 40 && scena && scena.isConnected; i++) await new Promise((x) => setTimeout(x, 100));
            const dopo = prima + (scena && scena.isConnected ? 1 : 0);

            // Ripiego
            window.ICONE_POSIZIONE_WEBGL_OFF = true;
            const pop2 = openQuickPopover(null, '<div class="quick-popover-actions"><button class="quick-popover-btn cancel icon-round"><span data-ico="cancel">✖</span></button></div>', { bare: true });
            const ripiego = { canvas: pop2.querySelectorAll('canvas').length, testo: pop2.textContent.trim() };
            closeQuickPopover(); window.ICONE_POSIZIONE_WEBGL_OFF = false;
            return { canvas, emoji, cliccato, attive, dopoChiusura, ok, prima, durante, dopo, ripiego };
        });
        assert(r.canvas === 7, `Tutte e sette le icone devono diventare un canvas: ${JSON.stringify(r)}`);
        assert(!/[✨✖✔🂠🔺]/u.test(r.emoji), `Le emoji di prima devono sparire dai pulsanti montati: ${r.emoji}`);
        assert(r.cliccato === 1, 'Il pulsante deve restare cliccabile');
        assert(r.attive >= 7 && r.dopoChiusura === 0, `Le icone girano finche' il popover c'e', poi si fermano: ${JSON.stringify(r)}`);
        assert(r.ok === true && r.durante === r.prima + 1 && r.dopo === r.prima, `La scena sulla carta parte e sparisce da sola: ${JSON.stringify(r)}`);
        assert(r.ripiego.canvas === 0 && r.ripiego.testo === '✖', `Con il WebGL spento resta l'emoji di prima: ${JSON.stringify(r.ripiego)}`);
    }
};
