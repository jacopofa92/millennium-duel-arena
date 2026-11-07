// Chat delle stanze Multiplayer (js/multiplayer/mp-chat.js): due client veri attraverso il relay.
// =====================================================================================
// Il messaggio viaggia come campo `chat` dentro un 'ready' (il relay in produzione scarta i tipi che non conosce): chi riceve lo
// smista PRIMA di leggerlo come "sono pronto", quindi una chat non deve MAI far risultare pronto chi scrive. Si controlla: il
// pulsante compare con la stanza, una frase rapida e un testo libero arrivano, il testo e' ripulito e mai interpretato come HTML,
// "Silenzia" ferma i messaggi in entrata, il limite di frequenza vale, e la forma e' validata da ProtocolloMP.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: chat di stanza fra due client (frasi rapide, testo, silenzia, niente falso "pronto")',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const errori = [];
        try {
            const apri = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${label}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, null, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const A = await apri('A');
            const B = await apri('B');
            const visibile = (p) => p.evaluate(() => { const b = document.getElementById('mpChatBtn'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; });
            assert(!(await visibile(A)), 'prima di entrare in una stanza il pulsante della chat non c\'e\'');

            await A.click('#mpCreateBtn');
            await A.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, null, { timeout: 20000 });
            const codice = (await A.textContent('#mpRoomCodeValue')).trim();
            await B.click('#mpTabJoin');
            await B.fill('#mpJoinCode', codice);
            await B.click('#mpJoinBtn');
            await A.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await B.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            assert(await visibile(A) && await visibile(B), 'in stanza il pulsante della chat compare per entrambi');

            // B apre il pannello e manda una frase rapida: A la riceve (badge + toast) e non risulta "pronto".
            await B.click('#mpChatBtn');
            await B.click('.mpchat-frase >> nth=0');
            await A.waitForFunction(() => /Buona partita!/.test(document.querySelector('.mpchat-log').textContent), null, { timeout: 10000 });
            const badgeA = await A.evaluate(() => { const b = document.querySelector('.mpchat-badge'); return b && !b.hidden ? b.textContent : null; });
            assert(badgeA === '1', `A vede 1 messaggio non letto: ${badgeA}`);
            await A.waitForTimeout(200);
            const ruoloAvv = await A.evaluate(() => document.getElementById('mpSeatOppRole').textContent.trim());
            const falsoPronto = ruoloAvv === 'Pronto';
            assert(!falsoPronto, `una chat non fa risultare pronto chi la manda (il posto dice: ${ruoloAvv})`);
            // Aperto il pannello il badge si azzera.
            await A.click('#mpChatBtn');
            const badgeDopo = await A.evaluate(() => { const b = document.querySelector('.mpchat-badge'); return b && !b.hidden; });
            assert(!badgeDopo, 'aprendo il pannello i non letti si azzerano');

            // Testo libero con HTML dentro: arriva ripulito (via < e >) e mai come elemento.
            await A.waitForTimeout(1300);   // limite di frequenza in uscita
            await A.fill('.mpchat-input', 'ciao <b onmouseover=alert(1)>mondo</b>  a   tutti');
            await A.click('.mpchat-invia');
            await B.waitForFunction(() => /ciao b onmouseover=alert\(1\)mondo\/b a tutti/.test(document.querySelector('.mpchat-log').textContent), null, { timeout: 10000 });
            const html = await B.evaluate(() => document.querySelector('.mpchat-log').querySelectorAll('b, script, img').length);
            assert(html === 0, 'il testo ricevuto non diventa mai HTML');

            // Limite di frequenza in uscita: un secondo invio immediato non parte.
            const doppio = await A.evaluate(() => {
                const a = MpChat.FRASI[0].id;
                const prima = document.querySelectorAll('.mpchat-log .mpchat-riga-msg').length;
                document.querySelectorAll('.mpchat-frase')[0].click();
                document.querySelectorAll('.mpchat-frase')[1].click();
                return document.querySelectorAll('.mpchat-log .mpchat-riga-msg').length - prima;
            });
            assert(doppio <= 1, `due invii a raffica: ne parte al piu' uno (${doppio})`);

            // Silenzia: B non vede piu' nulla.
            await B.click('.mpchat-silenzia');
            const righeB = await B.evaluate(() => document.querySelectorAll('.mpchat-log .mpchat-riga-msg').length);
            await A.waitForTimeout(1300);
            await A.fill('.mpchat-input', 'messaggio che B non deve vedere');
            await A.click('.mpchat-invia');
            await B.waitForTimeout(900);
            const righeB2 = await B.evaluate(() => document.querySelectorAll('.mpchat-log .mpchat-riga-msg').length);
            const visto = await B.evaluate(() => /non deve vedere/.test(document.querySelector('.mpchat-log').textContent));
            assert(!visto && righeB2 === righeB, `silenziata, la chat non mostra i messaggi in entrata (la nota di sistema c'e' gia' al momento di righeB): ${righeB} -> ${righeB2}`);

            // Tastiera del telefono: con il campo in focus e una tastiera che copre la parte bassa, il pannello (sala e duello) resta
            // tutto nell'area visibile e la riga di scrittura sta sopra la tastiera. La tastiera si finge con un visualViewport ridotto.
            for (const inDuello of [false, true]) {
                const r = await A.evaluate((duello) => {
                    document.body.classList.toggle('mp-in-duello', duello);
                    const finto = { height: 480, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
                    Object.defineProperty(window, 'visualViewport', { configurable: true, value: finto });
                    const input = document.querySelector('.mpchat-input');
                    input.focus();
                    MpChat._sistemaTastiera();
                    const p = document.getElementById('mpChatPanel').getBoundingClientRect();
                    const i = input.getBoundingClientRect();
                    const out = { fondoPannello: Math.round(p.bottom), cimaPannello: Math.round(p.top), fondoInput: Math.round(i.bottom), visibile: 480, frasiNascoste: getComputedStyle(document.querySelector('.mpchat-frasi')).display === 'none' };
                    input.blur();
                    MpChat._sistemaTastiera();
                    out.dopo = document.getElementById('mpChatPanel').style.bottom;
                    document.body.classList.remove('mp-in-duello');
                    return out;
                }, inDuello);
                assert(r.fondoInput <= r.visibile && r.fondoPannello <= r.visibile && r.cimaPannello >= 0, `${inDuello ? 'in duello' : 'in sala'}: con la tastiera il pannello sta nell'area visibile (${JSON.stringify(r)})`);
                assert(r.frasiNascoste, 'con la tastiera aperta le frasi rapide si nascondono per fare spazio');
                assert(r.dopo === '', 'chiusa la tastiera il pannello torna alla posizione di prima');
            }
            // Tastiera che NON riduce visualViewport (Chrome su Android con la tastiera sovrapposta, certe WebView: segnalato
            // dall'utente il 2026-11-07, la chat finiva dietro la tastiera). `visualViewport.height` resta quello dello schermo
            // intero, quindi il pannello non puo' fidarsi di lui per stare sul fondo: deve stare in ALTO, nella meta' che la
            // tastiera non copre mai.
            for (const inDuello of [false, true]) {
                const r = await A.evaluate((duello) => {
                    document.body.classList.toggle('mp-in-duello', duello);
                    const finto = { height: innerHeight, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
                    Object.defineProperty(window, 'visualViewport', { configurable: true, value: finto });
                    const input = document.querySelector('.mpchat-input');
                    input.focus();
                    MpChat._sistemaTastiera();
                    const p = document.getElementById('mpChatPanel').getBoundingClientRect();
                    const i = input.getBoundingClientRect();
                    const out = { schermo: innerHeight, fondoPannello: Math.round(p.bottom), cimaPannello: Math.round(p.top), fondoInput: Math.round(i.bottom) };
                    input.blur();
                    MpChat._sistemaTastiera();
                    document.body.classList.remove('mp-in-duello');
                    return out;
                }, inDuello);
                assert(r.fondoInput <= r.schermo * 0.5 && r.cimaPannello >= 0, `${inDuello ? 'in duello' : 'in sala'}: con una tastiera che non riduce il viewport la riga di scrittura deve stare nella meta' alta (${JSON.stringify(r)})`);
            }
            // Forma del messaggio: validata dal protocollo.
            const forma = await A.evaluate(() => ({
                ok: ProtocolloMP.motivoRifiuto({ kind: 'ready', pronto: true, chat: { frase: 'gg', nome: 'A' } }),
                lungo: ProtocolloMP.motivoRifiuto({ kind: 'ready', pronto: true, chat: { testo: 'x'.repeat(300), nome: 'A' } }),
                vuoto: ProtocolloMP.motivoRifiuto({ kind: 'ready', pronto: true, chat: { nome: 'A' } }),
                tipo: ProtocolloMP.motivoRifiuto({ kind: 'ready', pronto: true, chat: 'ciao' })
            }));
            assert(forma.ok === null, `una frase rapida e' valida: ${forma.ok}`);
            assert(forma.lungo && forma.vuoto && forma.tipo, `testo troppo lungo, vuoto o non oggetto sono rifiutati: ${JSON.stringify(forma)}`);
            assert(errori.length === 0, `nessun errore in pagina: ${errori.join(' | ')}`);
        } finally {
            await context.close();
            if (statics.close) await statics.close();
            if (room.close) await room.close();
        }
    }
};
