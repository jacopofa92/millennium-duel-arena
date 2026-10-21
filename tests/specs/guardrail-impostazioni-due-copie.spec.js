// Le Impostazioni hanno UNA sola copia: la pagina impostazioni.html.
// =====================================================================
// In passato vivevano anche come vista fusa dentro index.html, e le due
// copie andavano alla deriva (un'opzione aggiunta solo alla pagina, quindi
// introvabile dal menu). Ora il menu rimanda alla pagina e basta: questo
// controllo STATICO impedisce che una copia della schermata torni dentro
// index.html senza che nessuno se ne accorga.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Guardrail: le Impostazioni esistono in una sola copia (impostazioni.html)',
    standalone: true,
    async run({ assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const pagina = fs.readFileSync(path.join(RADICE, 'impostazioni.html'), 'utf8');
        const menu = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');

        const voci = (pagina.match(/class="settings-row-label"/g) || []).length;
        assert(voci >= 5, `Poche voci lette da impostazioni.html (${voci}): il controllo non proverebbe nulla`);
        assert(pagina.indexOf('Visualizzazione ologramma') !== -1, 'Manca "Visualizzazione ologramma" da impostazioni.html');

        assert(menu.indexOf('settings-row-label') === -1,
            'index.html contiene righe di impostazione: la schermata deve restare solo in impostazioni.html');
        assert(menu.indexOf('id="view-impostazioni"') === -1, 'index.html non deve ospitare una vista Impostazioni');
        assert(/impostazioni\.html/.test(menu), 'il menu deve rimandare a impostazioni.html');
    }
};
