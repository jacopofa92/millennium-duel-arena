// La schermata VS mostra tutte le pedine del Tag Team (2 contro 2 = 4, 2 contro 1 = 3).
// ====================================================================================
// Richiesta dell'utente: nei duelli a squadre la schermata VS non deve mostrare solo due pedine ma tutte,
// con chi sta davanti grande e gli altri dietro (js/ui/duel-cinematics.js, buildSquadBlock; le squadre le
// ricava js/duel-session.js, squadreDelDuello). Un 1 contro 1 resta com'e' sempre.
// `standalone`: serve l'intro VERA (il resto della suite la salta con DUEL_FAST_OPENING).
const path = require('path');

module.exports = {
    name: 'Schermata VS: tutte le pedine del Tag Team, il 1 contro 1 resta invariato',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const base = 'file:///' + RADICE.replace(/\\/g, '/') + '/duelMonstersCore.html?';
        const casi = [
            { nome: '2 contro 2', q: 'mode=tag&character=kaiba&character2=pegasus&partner=joey&difficulty=Medio', figure: 4, formato: '2 contro 2' },
            { nome: '2 contro 1', q: 'mode=tag&character=kaiba&partner=joey&difficulty=Medio', figure: 3, formato: '2 contro 1' },
            { nome: '1 contro 1', q: 'mode=free&character=kaiba&difficulty=Medio', figure: 2, formato: null }
        ];
        for (const viewport of [{ width: 393, height: 851 }, { width: 1280, height: 720 }]) {
            for (const caso of casi) {
                const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
                await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
                const page = await context.newPage();
                await page.goto(base + caso.q, { waitUntil: 'commit' });
                await page.waitForSelector('.di-stage', { timeout: 20000 });
                await page.waitForTimeout(1500);
                const r = await page.evaluate(() => {
                    const dentro = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.left >= -40 && b.right <= innerWidth + 40; };
                    return {
                        figure: document.querySelectorAll('.di-stage .di-figura').length,
                        formato: (document.querySelector('.di-formato') || {}).textContent || null,
                        pedineDentro: [...document.querySelectorAll('.di-ped')].every(dentro),
                        nomi: [...document.querySelectorAll('.di-duelist-name')].map((n) => n.textContent)
                    };
                });
                const dove = caso.nome + ' @' + viewport.width;
                assert(r.figure === caso.figure, dove + ': figure ' + r.figure + ' invece di ' + caso.figure);
                assert(r.formato === caso.formato, dove + ': striscia del formato = ' + r.formato);
                assert(r.pedineDentro, dove + ': le pedine escono dallo schermo');
                await context.close();
            }
        }
    }
};
