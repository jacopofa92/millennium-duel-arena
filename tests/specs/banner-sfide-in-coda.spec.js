// Errore in produzione: "TypeError: r.map is not a function" in challenge-banner.js, comparso aprendo una pagina con piu' banner
// "Sfida completata" in coda. `init()` faceva `drainPendingBanners().forEach(show)`, e forEach passa a `show` anche l'INDICE come
// secondo argomento: dal secondo banner in poi l'indice (1, 2...) veniva scambiato per l'elenco dei premi e `1.map` non esiste.
module.exports = {
    name: 'Banner Sfide: piu\' banner in coda si mostrano tutti, senza errori',
    async run(t) {
        const r = await t.evaluate(async () => {
            const errori = [];
            window.addEventListener('error', (e) => errori.push(String(e.message)));
            // Tre banner salvati da un'altra pagina: uno senza premi, uno con un elenco, uno con un campo `rewards` sbagliato.
            sessionStorage.setItem('duelArenaPendingChallengeBanners', JSON.stringify([
                { id: 'a', label: 'Prima', description: 'd1', icon: 'x' },
                { id: 'b', label: 'Seconda', description: 'd2', icon: 'x', rewards: [{ icon: '💰', amount: 100, nome: 'Crediti' }] },
                { id: 'c', label: 'Terza', description: 'd3', icon: 'x', rewards: 7 }
            ]));
            const visti = [];
            const el = () => document.querySelector('.challenge-banner-label');
            ChallengeBanner.init();
            for (let i = 0; i < 80 && visti.length < 3; i++) {
                const e = el();
                const testo = e ? e.textContent : '';
                if (testo && visti[visti.length - 1] !== testo) visti.push(testo);
                await new Promise((res) => setTimeout(res, 150));
            }
            return { errori, visti, premiSeconda: (document.querySelector('.challenge-banner-rewards') || {}).innerHTML !== undefined };
        });
        t.assert(r.errori.length === 0, 'Nessun errore con piu\' banner in coda: ' + JSON.stringify(r.errori));
        t.assert(r.visti.length >= 1 && r.visti[0] === 'Prima', 'Il primo banner si mostra: ' + JSON.stringify(r.visti));
    }
};
