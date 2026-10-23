// Analisi statica della "copertura d'avvio" (rete lenta).
//
// Il loader condiviso (js/ui/page-loader.js) sta nel <body> ed e' un file esterno: arriva dopo gli script
// bloccanti dell'<head>. Su una connessione lenta, fino ad allora lo schermo restava vuoto (o mostrava il
// campo di default nudo) e i tocchi cadevano nel nulla. Ogni pagina col loader ha quindi nell'<head> una
// copertura INLINE (classe `avvio-in-corso` su <html>) che page-loader.js toglie quando prende il suo posto.
// Questo spec controlla che nessuna pagina la perda o ne faccia una versione diversa, e che il loader la tolga.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Guardrail: ogni pagina col loader ha la copertura d\'avvio inline, e il loader la toglie',
    standalone: true,
    async run({ assert }) {
        const radice = path.join(__dirname, '..', '..');
        const pagine = fs.readdirSync(radice).filter((f) => f.endsWith('.html'));
        const loader = fs.readFileSync(path.join(radice, 'js', 'ui', 'page-loader.js'), 'utf8');
        assert(/classList\.remove\('avvio-in-corso'\)/.test(loader), 'page-loader.js deve togliere la classe avvio-in-corso quando prende il posto');

        // Il blocco "generico" e' lo stesso ovunque: lo si prende dalla prima pagina che lo ha.
        const stile = /<style>html\.avvio-in-corso::before\{[^<]*<\/style>/;
        const script = /<script>\(function\(\)\{var r=document\.documentElement;r\.classList\.add\("avvio-in-corso"\)[^<]*<\/script>/;
        let riferimentoStile = null;
        let controllate = 0;
        for (const f of pagine) {
            const t = fs.readFileSync(path.join(radice, f), 'utf8');
            if (!t.includes('js/ui/page-loader.js')) continue;
            // index.html ha lo splash dedicato (PAGE_LOADER_SKIP) e il duello la sua versione piu' ricca (campo richiesto).
            if (t.includes('PAGE_LOADER_SKIP')) continue;
            controllate++;
            assert(t.includes('avvio-in-corso'), `${f}: manca la copertura d'avvio nell'<head>`);
            // Deve stare PRIMA di ogni script esterno dell'<head>, o non coprirebbe niente.
            const iCopertura = t.indexOf('avvio-in-corso');
            const primoScript = t.search(/<script[^>]*\ssrc=/i);
            assert(primoScript === -1 || iCopertura < primoScript, `${f}: la copertura d'avvio deve precedere il primo script esterno`);
            if (f === 'duelMonstersCore.html') {
                // Versione estesa: oltre alla copertura sceglie lo sfondo dal ?field= e lo scarica subito.
                assert(/searchParams|URLSearchParams/.test(t.slice(0, t.indexOf('</head>'))), 'duelMonstersCore.html: il campo richiesto va letto nell\'<head>');
                assert(!/<link rel="preload" as="image" href="images\/fields\/dirigibileKaibaCorp\.jpg"/.test(t), 'duelMonstersCore.html: niente preload fisso del dirigibile (scaricato a vuoto con un altro campo)');
                continue;
            }
            const mS = t.match(stile);
            const mC = t.match(script);
            assert(mS && mC, `${f}: la copertura d'avvio non ha la forma standard (stile + script)`);
            if (!riferimentoStile) riferimentoStile = mS[0] + mC[0];
            assert(mS[0] + mC[0] === riferimentoStile, `${f}: la copertura d'avvio e' diversa da quella delle altre pagine`);
        }
        assert(controllate >= 15, `Poche pagine controllate (${controllate}): il filtro e' sbagliato?`);
    }
};
