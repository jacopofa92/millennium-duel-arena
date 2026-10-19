// Le mappe della Storia hanno i loro effetti ambientali WebGL (js/ui/ambiente-mappe-storia.js),
// accesi da NodeMap dentro il mondo della mappa. Qui si prova: (1) ogni immagine di images/maps
// ha una voce; (2) ogni voce compila e parte dentro NodeMap, con il canvas DENTRO il mondo
// (scorre e si ingrandisce con la mappa) e sotto le linee e i nodi; (3) con Dettagli "Normali"
// non nasce nulla; (4) si spegne quando la mappa viene ridisegnata.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Mappe della Storia: effetti WebGL per ogni mappa, dentro il mondo e sotto i nodi',
    standalone: true,
    async run({ browser, assert }) {
        const file = fs.readdirSync(path.join(RADICE, 'images', 'maps')).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, ''));
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); });
        const page = await ctx.newPage();
        try {
            await page.goto(url('storia.html'));
            await page.waitForFunction(() => !!(window.NodeMap && window.AmbienteWebGL && AmbienteWebGL.haMappa));
            const mancanti = await page.evaluate((nomi) => nomi.filter((n) => !AmbienteWebGL.haMappa(n)), file);
            assert(mancanti.length === 0, `Mappe senza effetti ambientali: ${mancanti.join(', ')}`);

            const giro = await page.evaluate(async (nomi) => {
                const out = [];
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;inset:0;z-index:99999';
                host.id = 'provaMappa';
                document.body.appendChild(host);
                for (const n of nomi) {
                    // Si parte da zero: l'accensione e' asincrona (aspetta lo sfondo) e senza questo
                    // si leggerebbe ancora il canvas della mappa precedente.
                    AmbienteWebGL.ferma();
                    const canvas = NodeMap.render(host, {
                        sfondo: ['images/maps/' + n + '.jpg'], larghezza: 1672, altezza: 941,
                        nodi: [{ id: 'a', x: 300, y: 300, stato: 'corrente', label: 'A' }]
                    });
                    // lo sfondo si risolve in modo asincrono: gli effetti partono dopo
                    for (let i = 0; i < 40 && !AmbienteWebGL.attivo(); i++) await new Promise((r) => setTimeout(r, 100));
                    const c = AmbienteWebGL.canvas()[0];
                    out.push({
                        n, attivo: AmbienteWebGL.attivo(), err: AmbienteWebGL.errore(),
                        dentro: !!c && c.parentElement === canvas,
                        sottoLeLinee: !!c && canvas.firstElementChild === c,
                        tocco: c ? getComputedStyle(c).pointerEvents : ''
                    });
                }
                // Normali: nessun canvas
                VideoQuality.set('normali');
                const canvas = NodeMap.render(host, { sfondo: ['images/maps/storia_anime_prologo.jpg'], larghezza: 1672, altezza: 941, nodi: [] });
                await new Promise((r) => setTimeout(r, 800));
                out.push({ n: '__normali', attivo: AmbienteWebGL.attivo(), canvas: canvas.querySelectorAll('canvas').length });
                return out;
            }, file);
            const rotte = giro.filter((g) => g.n !== '__normali' && (!g.attivo || g.err || !g.dentro || !g.sottoLeLinee || g.tocco !== 'none'));
            assert(rotte.length === 0, `Mappe con effetti rotti: ${JSON.stringify(rotte)}`);
            const normali = giro.find((g) => g.n === '__normali');
            assert(normali && !normali.attivo && normali.canvas === 0, `Con Normali nessun effetto sulla mappa: ${JSON.stringify(normali)}`);
        } finally {
            await ctx.close();
        }
    }
};
