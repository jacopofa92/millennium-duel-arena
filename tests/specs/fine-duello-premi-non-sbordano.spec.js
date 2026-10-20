// La schermata di fine duello regge anche con molti premi.
// =====================================================================
// Segnalato dall'utente: con parecchie ricompense gli elementi uscivano
// dallo schermo, pulsante "Continua" compreso — cioè l'unico modo di
// uscire dalla schermata. Misurato prima di correggere: dieci premi su
// una finestra alta 900px producevano un contenuto di 965px col pulsante
// a 879-932 (fuori), e su un telefono in orizzontale (852x393) il
// contenuto era alto 955px e il pulsante finiva 280px sopra il bordo.
//
// Quello che il test sorveglia è la PROPRIETÀ, non i numeri: il pulsante
// dev'essere davvero cliccabile. Non "esiste nel DOM" e nemmeno "ha le
// coordinate giuste" — si chiede al browser CHI c'è in quel punto, che è
// l'unico modo di accorgersi anche di un elemento coperto da un altro.
//
// I premi sono inventati qui e non presi da js/economy/rewards.js: serve
// un numero ALTO per esercitare il caso, e legarsi ai premi veri
// significherebbe che il test smette di provare qualcosa il giorno in
// cui quei premi cambiano.
const PREMI = [
    { icon: '💰', amount: 850, nome: 'Crediti', rule: 'Vittoria contro un Duellante della Storia.' },
    { icon: '⭐', amount: 12, nome: 'Stelle', rule: 'Bonus del torneo: hai vinto senza perdere Life Point.' },
    { icon: '🃏', amount: 3, nome: 'Carte rare', rule: 'Ritrovamento: una carta rara ogni tre duelli vinti di fila.' },
    { icon: '🏺', amount: 1, nome: 'Oggetto del Millennio', rule: 'Premio di fine capitolo della campagna.' },
    { icon: '🎖️', amount: 2, nome: 'Carte Localizzatrici', rule: 'Il tuo avversario le ha cedute perdendo.' },
    { icon: '📈', amount: 40, nome: 'Punti esperienza', rule: 'Duello portato a termine senza abbandonare.' },
    { icon: '🔥', amount: 200, nome: 'Crediti bonus', rule: 'Serie di cinque vittorie consecutive.' },
    { icon: '💎', amount: 1, nome: 'Busta rara', rule: 'Prima vittoria contro questo Duellante.' },
    { icon: '🛡️', amount: 60, nome: 'Crediti', rule: 'Hai chiuso il duello con più di 6000 Life Point.' },
    { icon: '📜', amount: 1, nome: 'Sfida completata', rule: 'Sconfiggi Kaiba tre volte: 3 su 3.' }
];

module.exports = {
    name: 'Fine duello: con molti premi il pulsante Continua resta raggiungibile',
    freeze: false,
    async run(t) {
        const page = t.page;
        const originale = page.viewportSize();

        async function misura(larghezza, altezza, quanti) {
            await page.setViewportSize({ width: larghezza, height: altezza });
            await page.evaluate((d) => {
                const vecchio = document.getElementById('duelOutcomeOverlay');
                if (vecchio) vecchio.remove();
                DuelCinematics.showOutcome({
                    playerWon: true,
                    // Come nel gioco vero: sotto la schermata c'e' la pedina del vincitore (e il duello legge i duellanti da session).
                    session: { player: { name: 'Tu', image: 'images/characters/yugiMuto.jpg' }, opponent: { name: 'Seto Kaiba', title: 'Il Presidente', image: 'images/characters/setoKaiba.jpg', icon: '🧊' } },
                    record: { wins: 12, losses: 3 },
                    rewards: d.premi.slice(0, d.quanti),
                    onContinue: () => {}
                });
            }, { premi: PREMI, quanti: quanti });
            // Il pulsante entra con una dissolvenza ritardata: misurarlo
            // prima vorrebbe dire misurare dove NON è ancora.
            await page.waitForTimeout(1700);
            return page.evaluate(() => {
                const btn = document.querySelector('.do-continue');
                if (!btn) return { pulsante: false };
                const r = btn.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                const sotto = (y >= 0 && y <= window.innerHeight) ? document.elementFromPoint(x, y) : null;
                return {
                    pulsante: true,
                    dentro: r.top >= 0 && r.bottom <= window.innerHeight + 1,
                    cliccabile: !!(sotto && (sotto === btn || btn.contains(sotto))),
                    riquadro: { top: Math.round(r.top), bottom: Math.round(r.bottom) },
                    schermo: window.innerHeight,
                    // Con molti premi si deve poter scorrere, ed è il
                    // CONTENUTO INTERO a farlo — non un riquadro interno.
                    // La differenza conta: con lo scroll dentro il solo
                    // elenco dei premi funzionava solo col dito esattamente
                    // là dentro, e partendo dal titolo sembrava una
                    // schermata bloccata.
                    siScorre: (() => {
                        const box = document.querySelector('.do-content');
                        return box ? box.scrollHeight > box.clientHeight + 1 : false;
                    })(),
                    // E a scorrere dev'essere UNO solo: due contenitori
                    // annidati entrambi scorrevoli si rubano la rotellina a
                    // vicenda.
                    scrollAnnidati: (() => {
                        const c = document.querySelector('.do-content');
                        const r = document.querySelector('.do-rewards');
                        return !!(c && r && c.scrollHeight > c.clientHeight + 1
                            && r.scrollHeight > r.clientHeight + 1);
                    })(),
                    // LA FASCIA SFUMATA NON DEVE COPRIRE IL PULSANTE.
                    // Difetto vero, sfuggito a ogni misura precedente: la
                    // fascia stava sul pulsante come ::before con
                    // `z-index: -1`, ma il pulsante è `position: sticky`
                    // CON `z-index`, quindi apre un contesto di
                    // impilamento e il -1 finisce SOPRA il suo sfondo
                    // invece che sotto. Il pulsante dorato spariva sotto
                    // una fascia quasi opaca.
                    // Perché nessun controllo lo vedeva: geometria giusta,
                    // e `elementFromPoint` tornava comunque il pulsante
                    // perché la fascia ha `pointer-events: none` — copre
                    // il colore, non il tocco. Si controlla quindi la
                    // CAUSA, che è ispezionabile, invece del colore dipinto.
                    fasciaSulPulsante: (() => {
                        const p = getComputedStyle(btn, '::before');
                        if (p.content === 'none' || p.content === 'normal') return false;
                        const dipinge = p.backgroundImage !== 'none' || p.backgroundColor !== 'rgba(0, 0, 0, 0)';
                        const dietro = parseInt(p.zIndex, 10) < 0;
                        const s = getComputedStyle(btn);
                        const apreContesto = s.position !== 'static' && s.zIndex !== 'auto';
                        return dipinge && dietro && apreContesto;
                    })(),
                    // L'invito a scorrere c'è quando (e solo quando) resta
                    // davvero qualcosa sotto: altrimenti è un invito a fare
                    // una cosa che non si può fare.
                    invitoAScorrere: (() => {
                        const hint = document.querySelector('.do-scroll-hint');
                        return !!(hint && getComputedStyle(hint).display !== 'none');
                    })(),
                    // CHI HAI BATTUTO SI DEVE VEDERE, e non è scontato: su
                    // un telefono girato la schermata passa a due colonne,
                    // e in una griglia un elemento alto allarga le righe
                    // che attraversa. Col riquadro dei premi a fianco di
                    // titolo/sottotitolo/record come figli sciolti, il
                    // titolo finiva spinto a 435px in una finestra alta
                    // 393 — fuori schermo, e senza niente sopra da
                    // scorrere per risalirci. Si misura il titolo perché è
                    // la prima riga dell'intestazione: se ci sta lui,
                    // l'intestazione comincia dentro lo schermo.
                    //
                    // Si guardano TUTTE E TRE le parti fisse e non il solo
                    // titolo: provato al contrario dissolvendo
                    // l'intestazione nei suoi pezzi, il titolo restava a
                    // 251px (dentro) mentre il record scivolava a 604 in
                    // una finestra alta 393. Un controllo sul solo titolo
                    // sarebbe rimasto verde davanti a una schermata mezza
                    // fuori dallo schermo.
                    intestazioneFuori: ['.do-title', '.do-sub', '.do-record'].filter((sel) => {
                        const e = document.querySelector(sel);
                        if (!e) return false;
                        const r = e.getBoundingClientRect();
                        return r.height > 0 && (r.top < -1 || r.bottom > window.innerHeight + 1);
                    })
                };
            });
        }

        try {
            // Pochi premi: la schermata dev'essere quella di sempre, senza
            // scorrimenti — se il fix avesse rotto il caso normale, si
            // vedrebbe qui.
            const pochi = await misura(1400, 900, 3);
            t.assert(pochi.pulsante && pochi.dentro && pochi.cliccabile,
                `Con pochi premi il pulsante deve stare dentro: ${JSON.stringify(pochi)}`);
            t.assert(!pochi.siScorre,
                'Con tre premi non ci dev\'essere niente da scorrere: la schermata normale non va toccata');
            t.assert(!pochi.invitoAScorrere,
                'Senza niente da scorrere non si deve invitare a scorrere');

            // I tre casi che si rompevano, uno per forma di schermo.
            for (const [nome, w, h] of [
                ['desktop', 1400, 900],
                ['telefono in verticale', 393, 852],
                ['telefono in orizzontale', 852, 393]
            ]) {
                const m = await misura(w, h, PREMI.length);
                t.assert(m.pulsante, `Nessun pulsante Continua (${nome})`);
                t.assert(m.dentro,
                    `Con ${PREMI.length} premi il pulsante Continua esce dallo schermo (${nome}): `
                    + `${m.riquadro.top}-${m.riquadro.bottom} su ${m.schermo}px`);
                t.assert(m.cliccabile,
                    `Il pulsante Continua non è cliccabile (${nome}): ${JSON.stringify(m)}`);
                t.assert(m.siScorre,
                    `Con ${PREMI.length} premi si deve poter scorrere per leggerli tutti (${nome})`);
                t.assert(!m.scrollAnnidati,
                    `A scorrere dev'essere un contenitore solo, non due annidati (${nome})`);
                t.assert(!m.fasciaSulPulsante,
                    'La fascia sfumata sta sul pulsante con uno z-index negativo, ma il pulsante apre un contesto '
                    + `di impilamento: gli finisce SOPRA e lo copre (${nome})`);
                t.assert(m.invitoAScorrere,
                    `Con ${PREMI.length} premi solo i primi si vedono: va detto che l'elenco continua (${nome})`);
                t.assert(m.intestazioneFuori.length === 0,
                    `Parti dell'intestazione finite fuori dallo schermo (${nome}): ${m.intestazioneFuori.join(', ')} — `
                    + 'con molti premi la riga della griglia si allarga e spinge giù chi le sta accanto');
            }
        } finally {
            await page.evaluate(() => {
                const ov = document.getElementById('duelOutcomeOverlay');
                if (ov) ov.remove();
            });
            if (originale) await page.setViewportSize(originale);
        }
    }
};
