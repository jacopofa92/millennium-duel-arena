// La pagina di scelta del Tag Team (tag.html): un tabellone di posti invece di elenchi aperti.
// - una tessera per posto (tu, compagno, avversario/i o Boss), che cambia col formato;
// - toccando un posto si apre il pannello di scelta; un personaggio già in partita in un altro
//   posto non si può scegliere (niente doppioni);
// - nessuno scorrimento laterale, su desktop e telefono;
// - "Inizia" porta al duello con i parametri scelti.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const PAGINA = 'file:///' + path.join(RADICE, 'tag.html').replace(/\\/g, '/');

module.exports = {
    standalone: true,
    name: 'Tag Team: la pagina di scelta è un tabellone di posti, senza doppioni né scorrimento laterale',
    async run(t) {
        for (const [w, h, telefono] of [[1366, 900, false], [360, 740, true]]) {
            const ctx = await t.browser.newContext({ viewport: { width: w, height: h }, isMobile: telefono, hasTouch: telefono });
            const page = await ctx.newPage();
            const errori = [];
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            try {
                await page.goto(PAGINA);
                await page.waitForSelector('#postiAvv .tg-posto');
                const conta = () => page.evaluate(() => ({
                    tuoi: document.querySelectorAll('#postiTuoi .tg-posto').length,
                    avv: document.querySelectorAll('#postiAvv .tg-posto').length,
                    titolo: document.getElementById('titoloAvv').textContent,
                    largo: document.documentElement.scrollWidth - innerWidth
                }));
                const unoControUno = await conta();
                t.assert(unoControUno.tuoi === 2 && unoControUno.avv === 1, `${w}px, 2 contro 1: tu + compagno contro un avversario: ` + JSON.stringify(unoControUno));
                t.assert(unoControUno.largo <= 0, `${w}px: nessuno scorrimento laterale`);

                // 2 contro 2: due posti avversari, e nel pannello di uno i personaggi già in partita sono bloccati.
                await page.click('#formati button:nth-child(2)');
                const dueControDue = await conta();
                t.assert(dueControDue.avv === 2 && /squadra/i.test(dueControDue.titolo), `${w}px, 2 contro 2: due avversari: ` + JSON.stringify(dueControDue));
                await page.click('#postiAvv .tg-posto:nth-child(2)');
                await page.waitForSelector('#foglio:not([hidden])');
                const pannello = await page.evaluate(() => {
                    const voci = Array.from(document.querySelectorAll('#foglioLista .tg-voce'));
                    return {
                        bloccati: voci.filter((v) => v.disabled).map((v) => v.querySelector('.tg-voce-preso').textContent),
                        liberi: voci.filter((v) => !v.disabled && v.getAttribute('aria-pressed') !== 'true').length,
                        dentroLoSchermo: (() => { const r = document.querySelector('.tg-foglio-pannello').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })()
                    };
                });
                t.assert(pannello.bloccati.includes('Compagno') && pannello.bloccati.includes('Avversario'), `${w}px: nel pannello compagno e primo avversario sono bloccati: ` + JSON.stringify(pannello));
                t.assert(pannello.dentroLoSchermo, `${w}px: il pannello sta dentro lo schermo`);
                if (pannello.liberi > 0) {
                    const scelto = await page.evaluate(() => {
                        const v = Array.from(document.querySelectorAll('#foglioLista .tg-voce')).find((x) => !x.disabled && x.getAttribute('aria-pressed') !== 'true');
                        const nome = v.querySelector('.tg-voce-nome').textContent;
                        v.click();
                        return nome;
                    });
                    t.assert(await page.isHidden('#foglio'), `${w}px: scelto un personaggio, il pannello si chiude`);
                    t.assert((await page.textContent('#postiAvv .tg-posto:nth-child(2) .tg-posto-nome')) === scelto, `${w}px: il posto mostra chi hai scelto (${scelto})`);
                }

                // Boss: un posto solo, niente scelta del livello.
                await page.click('#formati button:nth-child(3)');
                const boss = await conta();
                t.assert(boss.avv === 1 && /Boss/.test(boss.titolo) && (await page.isHidden('#regolaLivello .tg-seg')), `${w}px, Boss: un posto e livello fisso: ` + JSON.stringify(boss));

                // Inizia: si va al duello con i parametri scelti.
                await page.click('#formati button:nth-child(1)');
                await Promise.all([
                    page.waitForURL(/duelMonstersCore\.html\?mode=tag/, { waitUntil: 'commit', timeout: 10000 }),
                    page.click('#vai')
                ]);
                const url = new URL(page.url());
                t.assert(url.searchParams.get('partner') && url.searchParams.get('character') && !url.searchParams.get('character2'),
                    `${w}px: "Inizia" porta al 2 contro 1 scelto: ` + url.search);
                t.assert(errori.length === 0, `${w}px: errori nella pagina: ` + errori.join(' | '));
            } finally {
                await ctx.close();
            }
        }
    }
};
