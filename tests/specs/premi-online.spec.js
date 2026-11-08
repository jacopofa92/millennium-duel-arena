const path = require('path');

// Premi delle battaglie online (Rewards.forOnline / forRaid): tetti giornalieri, soglie, Stella del Tag, premio per Boss.
// Si prova la funzione con uno stato nuovo per ogni caso (SaveManager.setModeState('online', null)): le cifre vengono da Rewards.
module.exports = {
    standalone: true,
    name: 'Premi online: Duello/Specchio, Tag Team con Stella e tetto, Raid per Boss con soglia del 25%',
    async run(t) {
        const url = 'file:///' + path.join(__dirname, '..', '..', 'multiplayer.html').replace(/\\/g, '/');
        const page = await t.browser.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; });
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.Rewards && window.SaveManager && window.RAID_BOSSES));
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Prova online');
                // Le Sfide si pagano da sole (crediti): qui si misura SOLO il premio, quindi si spegne il tracker.
                if (window.ChallengeTracker) ChallengeTracker.recordProgress = () => [];
                const reset = () => SaveManager.setModeState('online', null);
                const cr = () => SaveManager.getCurrency().credits;
                const st = () => SaveManager.getCurrency().starChips;
                const giorno = () => (window.ServerDate && ServerDate.dayKey()) || new Date().toISOString().slice(0, 10);
                const misura = (fn) => { const c = cr(), s = st(); const voci = fn(); return { crediti: cr() - c, stelle: st() - s, note: voci.filter((v) => v.nota).map((v) => v.rule) }; };
                const out = {};
                const duello = (extra) => Rewards.forOnline(Object.assign({ won: true, turniTuoi: 6, formato: 'duello' }, extra || {}));

                // --- Duello: 12 vittorie di fila ---
                reset();
                const winsPvEPrima = SaveManager.getDailyEconomy(giorno()).wins || 0;
                out.vittorie = Array.from({ length: 12 }, () => misura(() => duello()));
                out.pveIntatto = (SaveManager.getDailyEconomy(giorno()).wins || 0) === winsPvEPrima;
                // --- Troppo breve / abbandono / pareggio ---
                reset();
                out.breve = misura(() => duello({ turniTuoi: 3 }));
                out.abbandono = misura(() => duello({ abbandono: true }));
                out.pareggio = misura(() => duello({ won: false, pareggio: true }));
                // --- Sconfitte: 6 di fila, e la serie si azzera ---
                reset();
                out.sconfitte = Array.from({ length: 6 }, () => misura(() => duello({ won: false })));
                reset();
                duello(); duello();                     // due vittorie
                duello({ won: false });                 // la serie si rompe
                out.dopoSerieRotta = misura(() => duello());   // terza vittoria di un'altra serie: nessun bonus serie
                // --- Specchio: stessa tabella ---
                reset();
                out.specchio = misura(() => duello({ formato: 'specchio' }));

                // --- Tag online ---
                const tag = (tg, extra) => Rewards.forOnline(Object.assign({ won: true, turniTuoi: 6, formato: 'tag', tag: Object.assign({ formato: '2v2', iaAvversarie: [], alleatoIA: false }, tg || {}) }, extra || {}));
                reset(); out.tagPersone = misura(() => tag());
                reset(); out.tagIaDifficile = misura(() => tag({ iaAvversarie: ['hard'] }));
                reset(); out.tagIaFacile = misura(() => tag({ iaAvversarie: ['easy'] }));
                reset(); out.tagCompagnoIA = misura(() => tag({ alleatoIA: true }));
                reset(); out.tagBoss = Array.from({ length: 4 }, () => misura(() => tag({ formato: 'boss', iaAvversarie: ['boss'] })));
                reset(); out.tagStelle = Array.from({ length: 5 }, () => misura(() => tag()));
                reset(); out.tagSconfitta = misura(() => tag({}, { won: false }));

                // --- Raid ---
                const raid = (o) => Rewards.forRaid(Object.assign({ won: true, contributo: 1, bossNome: 'Boss' }, o));
                reset(); out.raidKaiba = misura(() => raid({ bossId: 'kaiba', lp: 16000 }));
                reset(); out.raidYami = misura(() => raid({ bossId: 'yamiYugi', lp: 18000 }));
                reset(); out.raidNitemare = misura(() => raid({ bossId: 'nitemare', lp: 20000 }));
                reset();
                out.raidTre = [raid({ bossId: 'kaiba', lp: 16000 }), raid({ bossId: 'marik', lp: 16000 }), raid({ bossId: 'pegasus', lp: 18000 })]
                    .map((voci) => ({ pagato: voci.some((v) => v.currency === 'credits' && v.amount >= 500), note: voci.filter((v) => v.nota).map((v) => v.rule) }));
                reset(); raid({ bossId: 'kaiba', lp: 16000 });
                out.raidStessoBoss = misura(() => raid({ bossId: 'kaiba', lp: 16000 }));
                reset(); out.raidPoco = misura(() => raid({ bossId: 'kaiba', lp: 16000, contributo: 0.1 }));
                reset(); out.raidPersaBene = misura(() => raid({ bossId: 'kaiba', won: false, contributo: 0.5 }));
                reset(); out.raidPersaPoco = misura(() => raid({ bossId: 'kaiba', won: false, contributo: 0.1 }));
                reset(); out.raidAbbandono = misura(() => raid({ abbandono: true }));
                // --- Riassunti in sala, con la scelta corrente ---
                out.sommari = {
                    duello: Rewards.sommarioOnline('duello'),
                    raid: Rewards.sommarioOnline('raid', { bossId: 'nitemare', bossNome: 'Nitemare' }),
                    tagIa: Rewards.sommarioOnline('tag', { iaAvversarie: ['hard'], alleatoIA: false }),
                    tagBoss: Rewards.sommarioOnline('tag', { iaAvversarie: ['boss'], alleatoIA: false })
                };
                reset();
                return out;
            });
            const V = r.vittorie.map((x) => x.crediti);
            // 1-5 pieni (la 3ª porta anche il bonus della serie, +50), 6-10 a meta', poi niente.
            t.assert(JSON.stringify(V) === JSON.stringify([50, 50, 100, 50, 50, 25, 25, 25, 25, 25, 0, 0]), `crediti per vittoria online: ${JSON.stringify(V)}`);
            t.assert(r.vittorie.reduce((a, x) => a + x.stelle, 0) === 1 && r.vittorie[9].stelle === 1, 'una Stella ogni 10 vittorie premiate, alla decima');
            t.assert(r.vittorie[10].note.length > 0, 'oltre il tetto lo dice');
            t.assert(r.pveIntatto, 'una vittoria online non deve consumare le vittorie del giorno del PvE (bonus prima vittoria, meta\' dopo la 5ª)');
            t.assert(r.breve.crediti === 0 && r.breve.note.length === 1, `duello troppo breve: ${JSON.stringify(r.breve)}`);
            t.assert(r.abbandono.crediti === 0 && r.pareggio.crediti === 0, 'abbandono e pareggio non pagano');
            t.assert(JSON.stringify(r.sconfitte.map((x) => x.crediti)) === JSON.stringify([15, 15, 15, 15, 15, 0]), `sconfitte: ${JSON.stringify(r.sconfitte.map((x) => x.crediti))}`);
            t.assert(r.dopoSerieRotta.crediti === 50, `dopo una sconfitta la serie riparte da zero: ${r.dopoSerieRotta.crediti}`);
            t.assert(r.specchio.crediti === 50, 'lo Specchio paga come il Duello');

            t.assert(r.tagPersone.crediti === 60 && r.tagPersone.stelle === 1, `Tag tra persone: ${JSON.stringify(r.tagPersone)}`);
            t.assert(r.tagIaDifficile.crediti === 80 && r.tagIaFacile.crediti === 30, `Tag contro IA Difficile/Facile: ${r.tagIaDifficile.crediti}/${r.tagIaFacile.crediti}`);
            t.assert(r.tagCompagnoIA.crediti === 45, `Tag con compagno IA (-25%): ${r.tagCompagnoIA.crediti}`);
            // 150 per le prime due; la terza non paga i crediti del Boss, ma e' la terza vittoria di fila: +50 di serie, una volta sola.
            t.assert(JSON.stringify(r.tagBoss.map((x) => x.crediti)) === JSON.stringify([150, 150, 50, 0]), `Tag contro il Boss, 2 al giorno: ${JSON.stringify(r.tagBoss.map((x) => x.crediti))}`);
            t.assert(r.tagStelle.map((x) => x.stelle).join() === '1,1,1,0,0', `una Stella per vittoria in Tag, tetto 3 al giorno: ${r.tagStelle.map((x) => x.stelle).join()}`);
            t.assert(r.tagStelle[3].note.some((n) => /Stelle del Tag/.test(n)), 'oltre il tetto delle Stelle lo dice');
            t.assert(r.tagSconfitta.crediti === 15 && r.tagSconfitta.stelle === 0, 'Tag perso: partecipazione, nessuna Stella');

            // Raid: premio del Boss + bonus della prima volta (+300 crediti, +1 Stella).
            t.assert(r.raidKaiba.crediti === 500 + 300 && r.raidKaiba.stelle === 2 + 1, `Raid Boss da 16.000: ${JSON.stringify(r.raidKaiba)}`);
            t.assert(r.raidYami.crediti === 600 + 300 && r.raidYami.stelle === 2 + 1, `Raid Boss da 18.000: ${JSON.stringify(r.raidYami)}`);
            t.assert(r.raidNitemare.crediti === 750 + 300 && r.raidNitemare.stelle === 3 + 1, `Raid Boss da 20.000: ${JSON.stringify(r.raidNitemare)}`);
            t.assert(r.raidTre[0].pagato && r.raidTre[1].pagato && !r.raidTre[2].pagato && r.raidTre[2].note.some((n) => /gi. riscosso/.test(n)), `Raid: 2 al giorno su Boss diversi: ${JSON.stringify(r.raidTre)}`);
            t.assert(r.raidStessoBoss.crediti === 0 && r.raidStessoBoss.note.some((n) => /Boss diverso/.test(n)), `Raid: lo stesso Boss due volte non paga: ${JSON.stringify(r.raidStessoBoss)}`);
            t.assert(r.raidPoco.crediti === 0 && r.raidPoco.note.some((n) => /meno del 25%/.test(n)), `Raid: sotto il 25% della barra niente premio: ${JSON.stringify(r.raidPoco)}`);
            t.assert(r.raidPersaBene.crediti === 15 && r.raidPersaPoco.crediti === 0, `Raid perso: partecipazione solo con il 25%: ${r.raidPersaBene.crediti}/${r.raidPersaPoco.crediti}`);
            t.assert(r.raidAbbandono.crediti === 0, 'Raid abbandonato: niente');

            t.assert(r.sommari.duello.includes('+50 crediti') && r.sommari.raid.includes('Nitemare') && r.sommari.raid.includes('+750') && r.sommari.raid.includes('3 Stelle'), `riassunti: ${JSON.stringify(r.sommari)}`);
            t.assert(r.sommari.tagIa.includes('+80 crediti') && r.sommari.tagBoss.includes('+150 crediti'), `riassunti Tag: ${JSON.stringify(r.sommari)}`);
            t.assert(errori.length === 0, `errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
