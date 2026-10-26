// La celebrazione di una tappa appena completata sulle mappe a nodi (js/ui/mappa-percorso-webgl.js + node-map.js):
// un'onda dorata corre sul sentiero fino al nodo e sul nodo scoppiano un lampo, due onde e scintille.
//
// Cosa si controlla (il disegno vero si guarda a occhio: qui si tiene ferma la REGOLA):
//  - la PRIMA volta che si vede una mappa non si festeggia niente (le tappe gia' fatte non sono "appena" fatte);
//  - quando una tappa diventa 'fatta' tra un disegno e l'altro se ne festeggia UNA, e solo una volta;
//  - un ridisegno identico non festeggia di nuovo;
//  - troppe tappe nuove insieme (un'avanzamento migrato, non un duello vinto) non fanno festa;
//  - con i Dettagli "Normali" non c'e' il canvas, quindi niente effetto; il ricordo resta comunque aggiornato.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Mappe a nodi: la tappa appena completata si festeggia una volta sola, mai la prima visita',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        page.on('console', (m) => { if (m.type() === 'warning' && /mappa percorso WebGL/i.test(m.text())) errori.push('console: ' + m.text()); });
        try {
            await page.goto(url('storia.html'));
            await page.waitForFunction(() => !!(window.NodeMap && window.MappaPercorsoGL && window.VideoQuality));
            const r = await page.evaluate(async () => {
                localStorage.removeItem('ygoMappaFatti:a:6');
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;inset:0;z-index:99999';
                document.body.appendChild(host);
                const base = (stati) => ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, x: 160 + i * 230, y: 650 - i * 80, stato: stati[i], label: id.toUpperCase() }));
                const quante = (nodi) => {
                    const mondo = NodeMap.render(host, { sfondo: [], larghezza: 1600, altezza: 900, nodi });
                    const gl = mondo.querySelector('canvas.nm-percorso-gl');
                    return gl ? Number(gl.dataset.celebrazioni) : -1;
                };
                const out = {};
                // 1) prima visita: due tappe gia' fatte, niente festa
                out.prima = quante(base(['fatta', 'fatta', 'corrente', 'bloccata', 'bloccata', 'bloccata']));
                // 2) la terza diventa 'fatta': una festa
                out.nuova = quante(base(['fatta', 'fatta', 'fatta', 'corrente', 'bloccata', 'bloccata']));
                // 3) stesso disegno: niente
                out.ripetuto = quante(base(['fatta', 'fatta', 'fatta', 'corrente', 'bloccata', 'bloccata']));
                // 4) cinque tappe nuove insieme (il ricordo e' fermo alla prima): niente festa, e restano segnate come viste
                localStorage.setItem('ygoMappaFatti:a:6', JSON.stringify(['a']));
                out.troppe = quante(base(['fatta', 'fatta', 'fatta', 'fatta', 'fatta', 'fatta']));
                out.dopoTroppe = quante(base(['fatta', 'fatta', 'fatta', 'fatta', 'fatta', 'fatta']));
                // 5) Normali: niente canvas, ma il ricordo si aggiorna comunque
                VideoQuality.set('normali');
                localStorage.setItem('ygoMappaFatti:a:6', JSON.stringify(['a']));
                out.normali = quante(base(['fatta', 'fatta', 'corrente', 'bloccata', 'bloccata', 'bloccata']));
                out.ricordo = JSON.parse(localStorage.getItem('ygoMappaFatti:a:6'));
                VideoQuality.set('alti');
                return out;
            });
            assert(r.prima === 0, `La prima visita non festeggia: ${JSON.stringify(r)}`);
            assert(r.nuova === 1, `Una tappa appena completata si festeggia: ${JSON.stringify(r)}`);
            assert(r.ripetuto === 0, `Un ridisegno identico non festeggia di nuovo: ${JSON.stringify(r)}`);
            assert(r.troppe === 0 && r.dopoTroppe === 0, `Troppe tappe insieme non fanno festa: ${JSON.stringify(r)}`);
            assert(r.normali === -1 && r.ricordo.length === 2, `Con Normali niente canvas e ricordo aggiornato: ${JSON.stringify(r)}`);
        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Errori: ${errori.join(' | ')}`);
    }
};
