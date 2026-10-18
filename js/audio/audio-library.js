// @ts-check
/**
 * audio-library.js — Sistema audio modulare con Howler.js (js/vendor/howler.min.js).
 * =====================================================================
 * Due livelli, entrambi con FALLBACK automatico sui suoni sintetizzati
 * già esistenti in js/audio/sfx.js quando il file richiesto non esiste:
 *
 *   1) "Standard" — audio/standard/<nomeEffetto>.mp3 O .ogg (es.
 *      draw.ogg, summon.ogg, activateSpell.ogg — prova prima .mp3, poi
 *      .ogg, usa il primo che trova davvero): se esiste, sostituisce il
 *      suono sintetizzato con lo stesso nome in js/audio/sfx.js. Agganciato
 *      dentro sfx.js stesso (vedi il fondo di quel file): nessuna
 *      chiamata a SFX.* in tutto il resto del codice è stata toccata.
 *      Già popolata con suoni CC0 di Kenney.nl (vedi audio/standard/CREDITS.txt)
 *      per i 18 effetti elencati in PRELOAD_STANDARD_NAMES più sotto.
 *   2) "Dedicato per carta" — audio/evocazioni/<id>.mp3 (o .ogg),
 *      audio/magie/<id>.mp3, audio/trappole/<id>.mp3: un suono specifico
 *      per UNA carta, con priorità sopra il livello "standard". Agganciato
 *      in js/ui/effects.js (attivazione Magia/Trappola) e nei punti che
 *      giocano il suono di Evocazione (js/engine/actions.js, js/ai/bot.js). Queste
 *      tre cartelle sono ancora vuote (nessuna delle 508 carte ne ha uno
 *      dedicato) — questo file è l'IMPIANTO di rilevamento/fallback,
 *      pronto per quando arriveranno, esattamente come VisualEffects.getVideoFor
 *      in js/ui/visual-effects-library.js per i filmati di evocazione. Aggiungere
 *      un file audio dedicato in futuro non richiede toccare NESSUN altro
 *      file: basta metterlo al posto giusto con il nome giusto.
 *
 * COMPATIBILITÀ file:// (Duello Demo, aperto con doppio click, senza
 * server — vedi il commento in js/data/cards-db.js per lo stesso problema
 * incontrato con data/cards.json): Howler di default carica i file audio
 * via XMLHttpRequest per poterli decodificare con la Web Audio API, che i
 * browser bloccano sotto file:// esattamente come fetch(). Ogni Howl qui
 * viene quindi creato con `html5: true`, che fa caricare il file con un
 * normale elemento <audio> (permesso sotto file://, stessa tecnica già
 * usata per il rilevamento dei video in js/ui/visual-effects-library.js).
 *
 * PRIMA VOLTA vs volte successive: al primissimo tentativo di riprodurre
 * un dato effetto/carta in un duello, il file potrebbe non essere ancora
 * stato controllato — per non rischiare un suono mancante (né il file
 * vero, che non ha ancora finito di caricare, né il fallback, se lo
 * saltassimo per errore) la primissima chiamata per un dato percorso
 * ricade SEMPRE sul suono sintetizzato, mentre il controllo del file
 * parte in background; dalla seconda chiamata in poi (per lo stesso
 * effetto/carta) il risultato è già noto e si comporta correttamente.
 * Gli effetti "standard" fanno eccezione: vengono precaricati tutti
 * subito all'avvio (vedi PRELOAD_STANDARD_NAMES sotto), quindi per loro
 * anche il primo utilizzo reale in partita è già quasi sempre corretto.
 */
(function () {
    'use strict';

    if (typeof Howl === 'undefined') {
        // js/vendor/howler.min.js non caricato (pagina che non ne ha
        // bisogno, es. cartoteca.html): API presente ma sempre "non
        // trovato", così il resto del codice può chiamarla senza controlli.
        window.AudioLibrary = { tryPlayStandard: () => false, tryPlayCardSound: () => false };
        return;
    }

    // path -> 'pending' (caricamento in corso) | 'missing' (file non trovato) | Howl (pronto)
    const cache = new Map();

    // La campagna Grande Guerra usa il paesaggio sonoro dedicato WW1. La priorita' vive
    // nel resolver, non nei singoli effetti: ogni file omonimo presente in
    // audio/standard/ww1 viene scelto automaticamente; se manca, resta il
    // normale percorso standard e infine il fallback sintetizzato di SFX.
    const campaignId = new URLSearchParams(window.location.search).get('campaign');
    const campaignStandardFolder = campaignId === 'ww1' ? 'ww1' : null;

    /** Volume/mute proprio degli effetti sonori (js/audio/audio-manager.js#DuelSFX), separato dalla musica di sottofondo — stessa funzione già presente in js/audio/sfx.js. */
    function masterVolume() {
        if (window.DuelSFX) {
            if (DuelSFX.isMuted()) return 0;
            return DuelSFX.getVolume();
        }
        return 0.5;
    }

    /**
     * `basePath` è SENZA estensione (es. "audio/standard/draw"): prova
     * ".mp3" poi ".ogg", uno alla volta — così un file fornito in uno
     * qualunque dei due formati funziona senza doverne scegliere uno
     * fisso a priori (i suoni "standard" già inclusi in questo progetto,
     * vedi audio/standard/CREDITS.txt, sono .ogg: pacchetti CC0 di
     * Kenney.nl, nessun convertitore mp3 disponibile in questo ambiente).
     * Un solo formato per Howl (mai un array `src` con più estensioni
     * insieme): Howler sceglie tra formati multipli in base a cosa il
     * BROWSER sa decodificare, non in base a quale file esiste davvero
     * sul server — con entrambi i formati supportati da Chrome, un array
     * combinato si fermerebbe sempre al primo (anche se mancante),
     * senza mai ripiegare sul secondo. Da qui il probe sequenziale.
     */
    function startLoading(basePath) {
        cache.set(basePath, 'pending');
        tryFormat(basePath, 'mp3', () => tryFormat(basePath, 'ogg', () => cache.set(basePath, 'missing')));
    }

    function tryFormat(basePath, ext, onMissing) {
        const howl = new Howl({
            src: [`${basePath}.${ext}`],
            format: [ext],
            html5: true,
            onload: () => cache.set(basePath, howl),
            onloaderror: onMissing
        });
    }

    /**
     * Prova a riprodurre `basePath` (senza estensione). Torna true se il
     * suono È STATO effettivamente avviato (il chiamante NON deve
     * suonare il fallback), false se va suonato il fallback (file non
     * trovato, o ancora in corso di verifica la primissima volta — vedi
     * il commento in testa).
     */
    function tryPlay(basePath) {
        const state = cache.get(basePath);
        if (state === undefined) { startLoading(basePath); return false; }
        if (state === 'pending' || state === 'missing') return false;
        const vol = masterVolume();
        if (vol <= 0) return true; // muto: "suonato" (silenziosamente), niente fallback sopra
        state.volume(vol);
        state.play();
        return true;
    }

    function tryPlayStandard(effectName) {
        if (campaignStandardFolder) {
            const themedPath = `audio/standard/${campaignStandardFolder}/${effectName}`;
            const themedState = cache.get(themedPath);
            // La priorità WW1 è reale, non solo nominale: finché il probe
            // non ha stabilito che il file manca non si fa partire in
            // parallelo il suono standard. In pratica il preload completa
            // questa verifica prima del primo evento di gioco.
            if (themedState === undefined) {
                startLoading(themedPath);
                return true;
            }
            if (themedState === 'pending') return true;
            if (themedState !== 'missing') return tryPlay(themedPath);
        }
        return tryPlay(`audio/standard/${effectName}`);
    }

    /** `kind`: 'evocazioni' | 'magie' | 'trappole'. */
    function tryPlayCardSound(card, kind) {
        if (!card) return false;
        return tryPlay(`audio/${kind}/${card.id}`);
    }

    // Precarica tutti gli effetti "standard" noti (stessi nomi delle
    // funzioni esposte da window.SFX in js/audio/sfx.js), così anche il PRIMO
    // utilizzo reale in partita di ciascuno è già (quasi sempre) corretto,
    // a differenza degli effetti dedicati per carta (troppi — 508 carte x
    // 3 cartelle — per precaricarli tutti, vedi il commento in testa).
    // PIGRAMENTE dopo l'evento 'load' (non subito all'esecuzione di
    // questo script, che capita mentre il duello sta ancora avviandosi):
    // 18 file audio avviati tutti insieme competono per banda/CPU con
    // gli script ancora da caricare/eseguire nel percorso critico, per un
    // beneficio che serve solo alla PRIMA volta che un effetto suona in
    // partita (mai prima). Il tetto "quasi sempre corretto dal primo
    // utilizzo" del commento sopra resta valido: 'load' scatta comunque
    // ben prima che un giocatore reale interagisca abbastanza da
    // dichiarare un attacco o attivare una carta.
    const PRELOAD_STANDARD_NAMES = [
        'draw', 'place', 'summon', 'tribute', 'attackSwing', 'clash', 'destroy',
        'directHit', 'lifePointsLost', 'lifePointsGained', 'turnChange', 'phaseChange',
        'activateSpell', 'activateTrap', 'swordsOfRevealingLight', 'darkHole',
        'fusion', 'evocation', 'victory', 'defeat'
    ];
    const startPreload = () => PRELOAD_STANDARD_NAMES.forEach((name) => {
        if (campaignStandardFolder) startLoading(`audio/standard/${campaignStandardFolder}/${name}`);
        startLoading(`audio/standard/${name}`);
    });
    if (document.readyState === 'complete') {
        startPreload();
    } else {
        window.addEventListener('load', startPreload);
    }

    window.AudioLibrary = {
        tryPlayStandard: tryPlayStandard,
        tryPlayCardSound: tryPlayCardSound,
        // Diagnostica usata dal guardrail: non cambia durante il duello.
        campaignStandardFolder: campaignStandardFolder
    };
})();
