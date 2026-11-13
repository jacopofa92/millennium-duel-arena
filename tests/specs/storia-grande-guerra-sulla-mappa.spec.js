// La Grande Guerra è posata sulla sua mappa, e ha la sua musica.
// =====================================================================
// Questa campagna è la seconda (dopo Memorie Proibite) ad avere una
// mappa DISEGNATA invece di una texture presa in prestito, ed è la prima
// ad avere una colonna sonora propria. Le due cose si rompono in modi
// che non si vedono giocando distrattamente, ed è per questo che sono
// sorvegliate qui:
//
//   1) il mondo deve avere il RAPPORTO dell'immagine. Se qualcuno
//      cambiasse larghezza o altezza senza toccare l'altra, il fronte si
//      stenderebbe deformato — un fiume storto su una carta geografica
//      si nota, ma solo se si guarda, e nessun test guarda;
//   2) nessuna tappa deve finire fuori dal mondo o addosso a un'altra.
//      Le coordinate sono scritte a mano sui luoghi veri della mappa
//      (vedi l'intestazione di js/data/story-campaigns.js): è un lavoro
//      di precisione che un ritocco successivo può disfare senza
//      accorgersene;
//   3) la musica del duello deve arrivare DAVVERO nell'URL. Il nome del
//      file ha uno spazio e sta in una sottocartella, cioè esattamente
//      la forma che si rompe in silenzio lasciando il duello muto;
//   4) e non deve arrivare alle campagne che non ne hanno una, o un
//      canto del Piave finirebbe sotto Memorie Proibite.
//
// `standalone`: serve storia.html, non la pagina del duello.
const path = require('path');
const { consentiTuttiIContenuti } = require('../helpers/contenuti');

const CAMPAGNA = 'ww1';
// Distanza minima fra due tappe nel mondo. Un nodo è largo 104px e il
// suo pallino 56 (js/ui/node-map.css): sotto questa soglia le etichette
// si accavallano e due tappe diventano un grumo illeggibile.
const DISTANZA_MINIMA = 180;

module.exports = {
    name: 'Storia: la Grande Guerra è posata sulla sua mappa e ha la sua musica',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/storia.html';
        const context = await browser.newContext({
            viewport: { width: 1280, height: 950 },
            serviceWorkers: 'block'
        });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await consentiTuttiIContenuti(page);

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.StoryProgress && window.SaveManager), null, { timeout: 15000 });

            // --- 1) Il mondo ha il rapporto della mappa ----------------
            // L'immagine vera si misura caricandola: scriverne le
            // dimensioni qui dentro vorrebbe dire ricopiarle, e una copia
            // non si accorge se il file viene sostituito.
            const forma = await page.evaluate(async (c) => {
                const campagna = StoryProgress.getCampaign(c);
                const candidati = [].concat(campagna.sfondo);
                const misura = (src) => new Promise((ok) => {
                    const img = new Image();
                    img.onload = () => ok({ src: src, w: img.naturalWidth, h: img.naturalHeight });
                    img.onerror = () => ok(null);
                    img.src = src;
                });
                let arte = null;
                for (const s of candidati) { arte = await misura(s); if (arte) break; }
                return {
                    arte: arte,
                    larghezza: campagna.larghezza,
                    altezza: campagna.altezza,
                    musica: campagna.musica || null,
                    musicaDuello: campagna.musicaDuello || null
                };
            }, CAMPAGNA);

            assert(forma.arte, 'Nessuno degli sfondi dichiarati dalla Grande Guerra esiste');
            assert(/storia_/.test(forma.arte.src),
                `Deve usare una MAPPA disegnata, non la texture di ripiego: ${forma.arte.src}`);
            const rapportoArte = forma.arte.w / forma.arte.h;
            const rapportoMondo = forma.larghezza / forma.altezza;
            assert(Math.abs(rapportoArte - rapportoMondo) < 0.02,
                `Il mondo (${forma.larghezza}x${forma.altezza}, ${rapportoMondo.toFixed(3)}) deve avere il rapporto della mappa `
                + `(${forma.arte.w}x${forma.arte.h}, ${rapportoArte.toFixed(3)}): altrimenti il fronte si stende deformato`);

            // --- 2) Le tappe stanno dentro e non si accavallano --------
            const tappe = await page.evaluate((c) => StoryProgress.getTappe(c).map((t) => ({
                id: t.id, x: t.x, y: t.y, kind: t.kind, dialogo: (t.dialogo || []).length
            })), CAMPAGNA);
            assert(tappe.length > 15, `La campagna deve essere scritta per intero (rilevate ${tappe.length} tappe)`);

            const fuori = tappe.filter((t) =>
                t.x < 60 || t.x > forma.larghezza - 60 || t.y < 40 || t.y > forma.altezza - 60);
            assert(fuori.length === 0,
                'Tappe fuori dal mondo (o troppo al bordo perché l\'etichetta ci stia): '
                + fuori.map((t) => `${t.id} (${t.x},${t.y})`).join(', '));

            const addosso = [];
            for (let i = 0; i < tappe.length; i++) {
                for (let j = i + 1; j < tappe.length; j++) {
                    const d = Math.hypot(tappe[i].x - tappe[j].x, tappe[i].y - tappe[j].y);
                    if (d < DISTANZA_MINIMA) addosso.push(`${tappe[i].id} ~ ${tappe[j].id} = ${Math.round(d)}px`);
                }
            }
            assert(addosso.length === 0,
                `Due tappe non devono stare a meno di ${DISTANZA_MINIMA}px l'una dall'altra: ` + addosso.join(', '));

            // --- Ogni duello ha la sua conversazione -------------------
            const muti = tappe.filter((t) => t.kind === 'duel' && t.dialogo === 0);
            assert(muti.length === 0,
                'Ogni duello deve avere il suo dialogo: mancano ' + muti.map((t) => t.id).join(', '));

            // --- 3) La musica arriva nell'URL del duello ---------------
            assert(forma.musica && forma.musicaDuello,
                'La Grande Guerra deve dichiarare la propria musica di mappa e di duello');
            const urlDuello = await page.evaluate((c) => {
                const duello = StoryProgress.getTappe(c).find((t) => t.kind === 'duel');
                return StoryProgress.urlDuello(c, duello, {});
            }, CAMPAGNA);
            const musicaNellUrl = new URLSearchParams(urlDuello.split('?')[1]).get('music');
            assert(musicaNellUrl === forma.musicaDuello,
                `Il duello deve portarsi dietro la musica della campagna: "${musicaNellUrl}" invece di "${forma.musicaDuello}"`);

            // Il file deve esistere davvero: è il punto in cui uno spazio
            // nel nome o una sottocartella sbagliata lascia il duello muto.
            const esiste = await page.evaluate((f) => new Promise((ok) => {
                const a = document.createElement('audio');
                a.addEventListener('loadedmetadata', () => ok(true), { once: true });
                a.addEventListener('error', () => ok(false), { once: true });
                a.src = 'audio/soundtracks/' + f;
            }), forma.musicaDuello);
            assert(esiste, `Il file della musica del duello non si carica: audio/soundtracks/${forma.musicaDuello}`);

            // --- 4) Chi non ne ha una resta com'era --------------------
            // Ogni campagna con una musica propria deve mandare al duello
            // LA SUA, e quelle che non ne dichiarano nessuna non devono
            // ricevere niente: è il modo in cui un canto del Piave
            // potrebbe finire sotto Memorie Proibite senza che nessuno se
            // ne accorga finché non lo sente.
            const sbagliate = await page.evaluate(() => {
                const fuori = [];
                StoryProgress.getCampaigns().forEach((c) => {
                    const duello = StoryProgress.getTappe(c.id).find((t) => t.kind === 'duel');
                    if (!duello) return;
                    const url = StoryProgress.urlDuello(c.id, duello, {});
                    const musica = new URLSearchParams(url.split('?')[1]).get('music');
                    const attesa = duello.music || c.musicaDuello || null;
                    if (musica !== attesa) fuori.push(`${c.id}: "${musica}" invece di "${attesa}"`);
                });
                return fuori;
            });
            assert(sbagliate.length === 0,
                'Ogni campagna deve portare al duello la propria musica, o nessuna: ' + sbagliate.join(', '));

            // --- La mappa si disegna davvero --------------------------
            // Con la campagna appena cominciata i duelli sono tutti
            // bloccati, e un nodo bloccato non rivela né chi ci aspetta
            // né dove: per vedere i luoghi bisogna averla giocata.
            await page.evaluate((c) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const n = StoryProgress.getTappe(c).length;
                SaveManager.setStoryState(c, { completate: n - 1, finita: false, premiata: false, sotto: {} });
            }, CAMPAGNA);
            await page.goto(url + '?campaign=' + CAMPAGNA);
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const disegnata = await page.evaluate(() => ({
                nodi: document.querySelectorAll('.nm-node').length,
                luoghi: document.querySelectorAll('.nm-sublabel').length,
                traccia: window.DuelMusic ? DuelMusic.getTrack() : ''
            }));
            assert(disegnata.nodi === tappe.length,
                `Sulla mappa devono comparire tutte le tappe: ${disegnata.nodi} invece di ${tappe.length}`);
            assert(disegnata.luoghi > 0,
                'Su un nodo di duello il LUOGO deve comparire sotto il nome dell\'avversario: lo stesso avversario '
                + 'torna in capitoli diversi, e senza il luogo i suoi nodi sono indistinguibili');
            assert(disegnata.traccia.indexOf(forma.musica) !== -1,
                `Aprendo la campagna deve partire la sua musica: "${disegnata.traccia}"`);

            assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await context.close();
        }
    }
};
