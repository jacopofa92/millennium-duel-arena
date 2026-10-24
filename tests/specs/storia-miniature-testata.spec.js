// Menu della Storia: le testate delle campagne usano le miniature (images/thumbs-banner), non le mappe intere.
//
// La testata e' alta 128px ma le mappe pesano fino a 2 MB e il browser scarica TUTTI i livelli di un
// background multiplo: su rete lenta la pagina finiva di caricarsi dopo 17 s. Qui si controlla che:
//   - ogni candidato di `sfondo` di una campagna che ESISTE come file abbia la sua miniatura (stesso nome file);
//   - le miniature siano davvero leggere (< 150 KB);
//   - storia.html costruisca la testata dalle miniature e non scarichi piu' la musica in anticipo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');

module.exports = {
    name: 'Storia: le testate delle campagne usano miniature leggere',
    async run({ assert }) {
        const contesto = { window: {}, console: console };
        vm.createContext(contesto);
        vm.runInContext(fs.readFileSync(path.join(RADICE, 'js', 'data', 'story-campaigns.js'), 'utf8') + '\nthis.__c = typeof storyCampaignsDatabase !== "undefined" ? storyCampaignsDatabase : (window.storyCampaignsDatabase || null);', contesto);
        const campagne = contesto.__c;
        assert(Array.isArray(campagne) && campagne.length > 0, 'catalogo delle campagne letto');

        let controllati = 0;
        campagne.forEach((c) => {
            [].concat(c.sfondo || []).filter(Boolean).forEach((s) => {
                if (!fs.existsSync(path.join(RADICE, s))) return; // un candidato mancante non ha miniatura: e' il comportamento di sempre
                const mini = path.join(RADICE, 'images', 'thumbs-banner', path.basename(s));
                assert(fs.existsSync(mini), `${c.id}: manca la miniatura di ${s} (images/thumbs-banner/${path.basename(s)})`);
                assert(fs.statSync(mini).size < 150 * 1024, `${c.id}: la miniatura di ${s} pesa troppo (${Math.round(fs.statSync(mini).size / 1024)} KB)`);
                controllati++;
            });
        });
        assert(controllati >= 5, `Ho controllato almeno 5 sfondi (controllati: ${controllati})`);

        const html = fs.readFileSync(path.join(RADICE, 'storia.html'), 'utf8');
        assert(/images\/thumbs-banner\//.test(html), 'storia.html costruisce la testata dalle miniature');
        assert(!/rel="preload"[^>]*\.mp3/.test(html), 'storia.html non scarica la musica in anticipo (4,5 MB prima di tutto il resto)');
    }
};
