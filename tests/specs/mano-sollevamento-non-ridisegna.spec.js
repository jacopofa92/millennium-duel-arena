// Sollevare e riabbassare una carta della mano deve riusare lo STESSO nodo: l'artwork non viene ricreato e
// la transizione CSS può animare (una carta nuova nascerebbe già alzata, e l'immagine ricaricherebbe).
module.exports = {
    name: 'UX mano: sollevare/abbassare una carta non ridisegna il nodo né l\'artwork',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [
                { ...cardDatabase.find((card) => card.id === 4), uid: 'riuso-a' },
                { ...cardDatabase.find((card) => card.id === 10), uid: 'riuso-b' }
            ];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI();
        });
        await t.page.waitForTimeout(400);
        await t.evaluate(() => {
            document.querySelectorAll('#playerHand .card').forEach((el, i) => {
                el.__marchio = 'nodo-' + i;
                const img = el.querySelector('img');
                if (img) img.__marchio = 'img-' + i;
            });
        });
        const stato = () => t.evaluate(() => [...document.querySelectorAll('#playerHand .card')].map((el) => ({
            marchio: el.__marchio, alta: el.classList.contains('selected'),
            img: (el.querySelector('img') || {}).__marchio || null
        })));
        const tocca = async (i) => {
            const c = await t.page.evaluate((n) => {
                const r = document.querySelectorAll('#playerHand .card')[n].getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }, i);
            await t.page.mouse.click(c.x, c.y);
            await t.page.waitForTimeout(300);
        };
        await tocca(0);
        let s = await stato();
        t.assert(s[0].alta && s[0].marchio === 'nodo-0', `La carta toccata si alza e resta lo stesso nodo: ${JSON.stringify(s)}`);
        t.assert(s[0].img === null || s[0].img === 'img-0', `L'immagine non deve essere ricreata: ${JSON.stringify(s)}`);
        await tocca(1);
        s = await stato();
        t.assert(s[1].alta && !s[0].alta, `Passando alla seconda la prima si abbassa: ${JSON.stringify(s)}`);
        t.assert(s[0].marchio === 'nodo-0' && s[1].marchio === 'nodo-1', `Nessun nodo sostituito: ${JSON.stringify(s)}`);
        t.assert((s[0].img === null || s[0].img === 'img-0') && (s[1].img === null || s[1].img === 'img-1'), `Nessuna immagine ricreata: ${JSON.stringify(s)}`);
    }
};
