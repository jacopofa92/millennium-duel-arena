// Le emoji di sistema delle schermate diventano icone del TEMA (js/ui/icon-library.js + js/ui/emoji-tema.js).
// Prova: le icone nuove esistono, la mappa le assegna, la modalita' automatica converte anche il testo scritto DOPO (e rispetta
// `escludi`/`solo`), la morra e il Tag non mostrano piu' glifi di sistema, e le pagine toccate si aprono senza errori.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Emoji a tema: icone nuove, mappa, modalita\' automatica, morra e pagine senza emoji mappate',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const file = (f) => 'file:///' + RADICE.replace(/\\/g, '/') + '/' + f;
        const errori = [];
        const page = await t.browser.newPage({ viewport: { width: 1100, height: 800 } });
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        // 1) Icone nuove e mappa.
        await page.goto(file('regole.html'));
        await page.waitForFunction(() => window.EmojiTema && window.Icons, null, { timeout: 15000 });
        const r = await page.evaluate(() => {
            const nuove = ['warning', 'info', 'lock', 'hourglass', 'heart', 'fist', 'hand', 'scissors', 'key', 'flag', 'plug', 'cart', 'list', 'tag', 'users', 'clock', 'minus', 'undo', 'ban'];
            const attese = { '⚠': 'warning', 'ℹ': 'info', '🔒': 'lock', '⏳': 'hourglass', '❤': 'heart', '✊': 'fist', '✋': 'hand', '✌': 'scissors', '🔑': 'key', '🏳': 'flag', '🔌': 'plug', '🛒': 'cart', '📋': 'list', '🏷': 'tag', '👥': 'users', '🕓': 'clock', '➖': 'minus', '↩': 'undo', '🚫': 'ban', '❌': 'close', '🗑': 'trash', '🚪': 'exit' };
            return {
                mancanti: nuove.filter((n) => Icons.NAMES.indexOf(n) === -1),
                sbagliate: Object.keys(attese).filter((e) => EmojiTema.MAPPA[e] !== attese[e]).map((e) => e + '->' + EmojiTema.MAPPA[e]),
                tutteDisegnate: nuove.every((n) => { const s = Icons.buildIcon(n); return !!s && s.innerHTML.trim().length > 20; })
            };
        });
        t.assert(r.mancanti.length === 0, `Icone mancanti nella libreria: ${r.mancanti}`);
        t.assert(r.sbagliate.length === 0, `Emoji mappate male: ${r.sbagliate}`);
        t.assert(r.tutteDisegnate, 'Ogni icona nuova ha un disegno');

        // 2) Automatico: converte il testo scritto dopo, rispetta escludi e solo.
        const a = await page.evaluate(async () => {
            document.body.insertAdjacentHTML('beforeend', '<div id="x1"><span id="t1"></span></div><div id="x2" class="card game-log"><span id="t2"></span></div>');
            EmojiTema.automatico({ escludi: '.game-log' });
            document.getElementById('t1').textContent = '⚠️ Attenzione ⏳';
            document.getElementById('t2').textContent = '⚠️ cronaca';
            await new Promise((ok) => setTimeout(ok, 250));
            return { t1: document.getElementById('t1').querySelectorAll('svg.emoji-tema').length, t2: document.getElementById('t2').querySelectorAll('svg').length, testo2: document.getElementById('t2').textContent };
        });
        t.assert(a.t1 === 2, `Il testo scritto dopo si converte (${a.t1} icone, attese 2)`);
        t.assert(a.t2 === 0 && a.testo2.includes('⚠'), 'Un sottoalbero escluso resta com\'era');

        // 3) Pagine toccate: si aprono senza errori e non restano emoji MAPPATE nel testo (fuori da registro e carte).
        const pagine = ['profilo.html', 'regole.html', 'impostazioni.html', 'tag.html', 'caccia-boss.html', 'rivincite.html', 'storia.html', 'tutorial-tag.html', 'crea-carta.html'];
        for (const p of pagine) {
            const pg = await t.browser.newPage({ viewport: { width: 1100, height: 800 } });
            pg.on('pageerror', (e) => errori.push(p + ': ' + e.message));
            await pg.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            await pg.goto(file(p));
            await pg.waitForTimeout(1500);
            const rimaste = await pg.evaluate(() => {
                if (!window.EmojiTema) return ['(EmojiTema non caricato)'];
                const out = [];
                const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                while (w.nextNode()) {
                    const n = w.currentNode;
                    if (/^(SCRIPT|STYLE|OPTION|TITLE|TEXTAREA|NOSCRIPT)$/.test(n.parentNode.nodeName)) continue;
                    if (n.parentElement && n.parentElement.closest('.game-log, .card')) continue;
                    for (const ch of n.nodeValue.replace(/️/g, '')) if (EmojiTema.MAPPA[ch]) out.push(ch + ' in "' + n.nodeValue.trim().slice(0, 30) + '"');
                }
                return out.slice(0, 5);
            });
            t.assert(rimaste.length === 0, `${p}: restano emoji mappate nel testo: ${rimaste.join(' | ')}`);
            await pg.close();
        }

        // 4) Morra: nessun glifo di sistema (mani, spade) nelle scelte e nei pulsanti.
        await page.goto(file('duelMonstersCore.html?mode=free&character=kaiba&difficulty=Facile'));
        await page.waitForFunction(() => window.DuelRPS || window.DuelRps || document.getElementById('duelRpsOverlay') || typeof gameState !== 'undefined', null, { timeout: 25000 });
        const rps = await page.evaluate(() => {
            const o = document.getElementById('duelRpsOverlay');
            return o ? { icone: o.querySelectorAll('svg.themed-icon').length, glifi: /[✊✋✌⚔]/.test(o.textContent) } : null;
        });
        if (rps) {
            t.assert(rps.icone >= 3 && !rps.glifi, `La morra usa le icone del tema: ${JSON.stringify(rps)}`);
        }
        t.assert(errori.length === 0, 'Errori JS: ' + errori.join(' | '));
        await page.close();
    }
};
