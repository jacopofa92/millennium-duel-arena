// I test del motore e delle campagne devono poter usare tutti i cataloghi.
// Questo stub esplicito è SOLO una fixture; i test dei permessi non la usano.
async function consentiTuttiIContenuti(page) {
    await page.addInitScript(() => {
        let cloud;
        Object.defineProperty(window, 'CloudSync', {
            configurable: true,
            get: () => cloud,
            set: (value) => { cloud = value; cloud.hasContent = () => true; }
        });
    });
}
module.exports = { consentiTuttiIContenuti };
