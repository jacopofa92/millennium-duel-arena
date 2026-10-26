// Multiplayer: le MODALITA' della sala (?modo=duello|specchio|raid, dal sottomenu Multiplayer di index.html).
//
// La sala parte gia' con le regole della modalita' scelta e senza i selettori delle altre; senza ?modo= resta completa
// (e' quello che usano gli altri spec). Qui si controlla, con due client veri:
//  - titolo e regole di ogni modalita', e che l'host abbia la regola gia' accesa senza toccare nulla;
//  - l'ospite la vede arrivare (sola lettura) e, se entra da un'altra modalita', riceve un avviso e non un blocco;
//  - il sottomenu del menu punta alle tre modalita'.
const fs = require('fs');
const path = require('path');
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: la sala parte con le regole della modalita\' scelta dal menu',
    standalone: true,
    async run({ browser, assert }) {
        // Il menu: una voce per modalita', tutte verso la stessa sala.
        const indice = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
        assert(indice.includes("'multiplayer.html?modo=' + m.id"), 'Il menu Multiplayer ha una voce per modalita\'');

        const statics = await startStaticServer();
        const room = await startRoomServer();
        const errori = [];
        try {
            const apri = async (modo, etichetta) => {
                const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html' + (modo ? '?modo=' + modo : ''), { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const stato = (page) => page.evaluate(() => ({
                titolo: document.getElementById('mpTitolo').textContent,
                specchioVisibile: !document.getElementById('mpSpecchioGroup').hidden,
                raidVisibile: !document.getElementById('mpRaidGroup').hidden,
                specchioOn: document.getElementById('mpSpecchioOn').checked,
                raidOn: document.getElementById('mpRaidOn').checked
            }));
            const entrano = async (host, ospite) => {
                await host.click('#mpCreateBtn');
                await host.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
                const codice = (await host.textContent('#mpRoomCodeValue')).trim();
                await ospite.click('#mpTabJoin');
                await ospite.fill('#mpJoinCode', codice);
                await ospite.click('#mpJoinBtn');
                await host.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
                await ospite.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            };

            // --- Duello: nessuna regola speciale, nemmeno i selettori.
            const d = await apri('duello', 'duello');
            let s = await stato(d);
            assert(s.titolo === 'Duello Multiplayer' && !s.specchioVisibile && !s.raidVisibile, `Duello senza regole: ${JSON.stringify(s)}`);

            // --- Specchio: l'host ha la regola gia' accesa, l'ospite (entrato dalla stessa modalita') la vede.
            const sh = await apri('specchio', 'specchio-host');
            const so = await apri('specchio', 'specchio-ospite');
            s = await stato(sh);
            assert(s.titolo === 'Duello a Specchio' && s.specchioVisibile && !s.raidVisibile, `Specchio: gruppi: ${JSON.stringify(s)}`);
            await entrano(sh, so);
            s = await stato(sh);
            assert(s.specchioOn && !s.raidOn, `L'host ha lo specchio gia' acceso: ${JSON.stringify(s)}`);
            await so.waitForFunction(() => document.getElementById('mpSpecchioOn').checked, null, { timeout: 10000 });
            const rigaNascosta = await sh.evaluate(() => getComputedStyle(document.querySelector('#mpSpecchioGroup .mp-specchio-riga')).display === 'none');
            assert(rigaNascosta, 'La spunta della regola e\' nascosta: la modalita\' la fissa');

            // --- Raid: stessa cosa, e un ospite arrivato dal menu "Duello" riceve l'avviso.
            const rh = await apri('raid', 'raid-host');
            const ro = await apri('duello', 'raid-ospite-da-duello');
            s = await stato(rh);
            assert(s.titolo === 'Assalto al Boss' && s.raidVisibile && !s.specchioVisibile, `Raid: gruppi: ${JSON.stringify(s)}`);
            await entrano(rh, ro);
            s = await stato(rh);
            assert(s.raidOn && !s.specchioOn, `L'host ha il raid gia' acceso: ${JSON.stringify(s)}`);
            await ro.waitForFunction(() => document.getElementById('mpRaidOn').checked, null, { timeout: 10000 });
            const avviso = await ro.evaluate(() => document.body.textContent.includes('Questa stanza e\' in modalita\''));
            assert(avviso, 'Chi entra da un\'altra modalita\' riceve l\'avviso');

            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await room.close();
            await statics.close();
        }
    }
};
