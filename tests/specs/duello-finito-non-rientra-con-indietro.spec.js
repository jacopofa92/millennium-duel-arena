module.exports = {
    name: 'Cronologia: Indietro non riapre un duello concluso',
    async run(t) {
        const stato = await t.evaluate(() => ({
            guard: !!(history.state && history.state.duelGuard),
            returnUrl: DuelSession.returnUrl,
            currentPath: location.pathname
        }));
        t.assert(stato.guard, 'Durante il duello la voce corrente deve essere la sentinella duelGuard');
        t.assert(/duelMonstersCore\.html$/.test(stato.currentPath), `La voce corrente deve essere il duello, rilevato ${stato.currentPath}`);

        // Percorso reale segnalato su Android: fine duello, schermata
        // risultato e pressione su Continua. Prima location.replace
        // sostituiva soltanto la sentinella e lasciava il duello sotto.
        await t.evaluate(() => {
            gameState.gameOver = true;
            DuelSession.finish(true);
        });
        await t.page.waitForSelector('#duelOutcomeOverlay .do-continue');
        await t.page.click('#duelOutcomeOverlay .do-continue');
        await t.page.waitForURL((url) => !/duelMonstersCore\.html$/.test(url.pathname), { timeout: 5000 });
        const dopoUscita = new URL(t.page.url());
        t.assert(/index\.html$/.test(dopoUscita.pathname), `Il duello demo concluso deve tornare a index.html, rilevato ${dopoUscita.pathname}`);

        // La voce precedente non deve essere un'altra copia del duello.
        await t.page.goBack({ waitUntil: 'domcontentloaded' });
        t.assert(!/duelMonstersCore\.html/.test(t.page.url()), `Un secondo Indietro non deve riaprire il duello: ${t.page.url()}`);
    }
};
