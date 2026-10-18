// @ts-check
/**
 * arena-options.js — Catalogo delle Arene (sfondi) e delle Colonne
 * Sonore selezionabili prima di un duello.
 * ---------------------------------------------------------------
 * Nasce per la Sala d'Attesa del Multiplayer, ma è deliberatamente
 * generico: le stesse due liste esistevano già scritte a mano, come
 * `<option>` HTML, in due punti distinti (la vista Duello Libero dentro
 * index.html e la pagina standalone duello-libero.html) — due copie
 * destinate a divergere, e aggiungerne una terza qui dentro sarebbe
 * stato il modo più rapido per ritrovarsi con tre elenchi diversi fra
 * loro.
 *
 * Quelle due pagine sono state migrate in una sessione successiva e ora
 * leggono da qui attraverso js/ui/duel-setup.js: aggiungere un'arena
 * (o una traccia) a questo file la fa comparire OVUNQUE la si possa
 * scegliere, senza toccare alcun HTML.
 *
 * Un dettaglio già sistemato passando di qui: nell'elenco esistente due
 * tracce diverse ("35. High Mages" e "37. Seto") portavano ENTRAMBE
 * l'etichetta "High Duel", quindi erano indistinguibili nel menu a
 * tendina.
 *
 * Le immagini esistono in due risoluzioni — `images/fields/` e
 * `images/fields/mobile/` — e l'arena sceglie da sé quale usare in base
 * al puntatore (vedi duelMonstersCore.html). Qui si conserva solo il
 * nome del file, mai il percorso: è l'unica cosa comune alle due.
 */
(function () {
    'use strict';

    // Tolti dal gioco su richiesta dell'utente (e i loro file cancellati):
    // Dirigibile di Kaiba, Dirigibile KaibaCorp II, Arena Kaiba 1 e 2,
    // Castello di Pegasus. Dove erano usati sono stati sostituiti da
    // Dirigibile KaibaCorp, Stadio Kaiba e Arena del Castello di Pegasus.
    // Una scelta rimasta salvata su uno di loro non si rompe: risolviCampo
    // qui sotto ripiega su un'arena a caso se il nome non è più in elenco.
    const FIELDS = [
        { file: 'rovine_1.jpg', nome: 'Regno dei Duellanti' },
        { file: 'rovine_2.jpg', nome: 'Rovine dell\'Isola' },
        { file: 'anticoEgittoGiorno_1.jpg', nome: 'Antico Egitto — Giorno' },
        { file: 'anticoEgittoGiorno_2.jpg', nome: 'Valle dei Re' },
        { file: 'anticoEgittoNotte_1.jpg', nome: 'Antico Egitto — Notte' },
        { file: 'anticoEgittoNotte_2.jpg', nome: 'Notte sul Nilo' },
        { file: 'anticoEgittoNotte_3.jpg', nome: 'Tempio Oscuro' },
        { file: 'anticoEgittoRovinePalazzo.jpg', nome: 'Palazzo in Rovina' },
        { file: 'arenaRegnoDeiDuellanti.jpg', nome: 'Arena del Regno dei Duellanti' },
        { file: 'arenaCastelloPegasus.jpg', nome: 'Arena del Castello di Pegasus' },
        { file: 'torreCastelloPegasus.jpg', nome: 'Torre del Castello di Pegasus' },
        { file: 'stadioKaiba.jpg', nome: 'Stadio Kaiba' },
        { file: 'dirigibileKaibaCorp.jpg', nome: 'Dirigibile KaibaCorp' },
        { file: 'torreDeiDuelli.jpg', nome: 'Torre dei Duelli' },
        { file: 'torreDeiDuelliColosseo.jpg', nome: 'Torre dei Duelli — Colosseo' },
        { file: 'torreDeiDuelliShadow.jpg', nome: 'Torre dei Duelli — Ombra' },
        { file: 'mondoVirtualeArenaGozaburo.jpg', nome: 'Mondo Virtuale — Arena di Gozaburo' },
        { file: 'citta.jpg', nome: 'La Città' },
        { file: 'campoPrato.jpg', nome: 'Prateria' },
        { file: 'campoGhiaccio.jpg', nome: 'Distesa di Ghiaccio' },
        { file: 'campoAcquatico.jpg', nome: 'Campo Acquatico' },
        { file: 'campoForesta.jpg', nome: 'Campo della Foresta' },
        { file: 'campoMontagna.jpg', nome: 'Campo di Montagna' },
        { file: 'rovineAntiche.jpg', nome: 'Rovine Antiche' },
        { file: 'rovineAnticoEgittoGiorno.jpg', nome: 'Rovine Egizie — Giorno' },
        { file: 'rovineAnticoEgittoNotte.jpg', nome: 'Rovine Egizie — Notte' },
        { file: 'arenaAnticoEgittoGiorno.jpg', nome: 'Arena dell\'Antico Egitto — Giorno' },
        { file: 'arenaAnticoEgittoNotte.jpg', nome: 'Arena dell\'Antico Egitto — Notte' },
        { file: 'arenaAnticoEgittoZorc.jpg', nome: 'Arena di Zorc' },
        { file: 'anticoEgittoPiazzaGiorno.jpg', nome: 'Piazza dell\'Antico Egitto — Giorno' },
        { file: 'anticoEgittoPiazzaNotte.jpg', nome: 'Piazza dell\'Antico Egitto — Notte' },
        { file: 'anticoEgittoTempio.jpg', nome: 'Tempio Egizio' },
        { file: 'anticoEgittoTempioOscuro.jpg', nome: 'Tempio Egizio Oscuro' },
        { file: 'grandeGuerraCampoDiBattagliaGiorno.jpg', nome: 'Grande Guerra — Campo di battaglia' },
        { file: 'grandeGuerraCampoDiBattagliaNotte.jpg', nome: 'Grande Guerra — Campo di battaglia di notte' },
        { file: 'industriaKaibaCorp.jpg', nome: 'Industria KaibaCorp' }
    ];

    // Le musiche da duello selezionabili: le tracce di audio/soundtracks/
    // numerate da 30 a 43, più le 57-59 (scelta dell'utente). `nome` è ciò che
    // il giocatore legge nei menu; finché è vuoto si mostra il nome del
    // file senza estensione (vedi nomeVisibile qui sotto). Per dare un nome
    // a una traccia basta scriverlo qui: compare in ogni menu che la offre.
    const TRACKS_CATALOGO = [
        { file: '30. Preliminaries.mp3', nome: '' },
        { file: '31. Finals.mp3', nome: '' },
        { file: '32. Seto Kaiba (Tournament Final) HD.mp3', nome: '' },
        { file: '32. Seto Kaiba (Tournament Final).mp3', nome: '' },
        { file: '33. Egyptian Duel.mp3', nome: '' },
        { file: '34. Mages Duel.mp3', nome: '' },
        { file: '35. High Mages.mp3', nome: '' },
        { file: '36. Heishin.mp3', nome: '' },
        { file: '37. Seto.mp3', nome: '' },
        { file: '38. Darknite-Nitemare.mp3', nome: '' },
        { file: '39. Free Duel.mp3', nome: '' },
        { file: '40. Free Duel (3D).mp3', nome: '' },
        { file: '41. Seto Kaiba Duel (3D Tournament Final).mp3', nome: '' },
        { file: '42. Egyptian Duel (3D).mp3', nome: '' },
        { file: '43. Darknite-Nitemare (3D).mp3', nome: '' },
        { file: '57. Duel of Shadows – The Millennium Mind.mp3', nome: '' },
        { file: '58. Yugi vs. Marik – Wrath of the Shadow Realm.mp3', nome: '' },
        { file: '59. King of Games - Yugi\'s Final Duel.mp3', nome: '' }
    ];

    /** Il nome da mostrare: quello scritto nel catalogo, o il nome del file senza estensione. */
    function nomeVisibile(voce) {
        if (voce.nome && voce.nome.trim()) return voce.nome.trim();
        return voce.file.replace(/\.[^.]+$/, '');
    }

    // Chi legge l'elenco (duel-setup.js, l'Editor Mappa, la sala del
    // Multiplayer) usa `t.nome` così com'è: il ripiego si applica qui una
    // volta sola, e nessuno di loro deve saperne nulla.
    const TRACKS = TRACKS_CATALOGO.map((t) => ({ file: t.file, nome: nomeVisibile(t) }));

    /** Il valore con cui un'opzione dichiara "scegline una a caso al momento del duello". */
    const RANDOM = 'random';

    function pescaCasuale(lista) {
        return lista[Math.floor(Math.random() * lista.length)].file;
    }

    /**
     * Traduce una scelta (un nome di file, oppure RANDOM) nel file vero da
     * usare. Va risolta PRIMA di trasmetterla all'avversario: se ognuno
     * dei due risolvesse il proprio "casuale" per conto suo, si
     * ritroverebbero a duellare in due arene diverse con due musiche
     * diverse, ciascuno convinto di vedere la stessa cosa dell'altro.
     */
    function risolvi(scelta, lista) {
        if (!scelta || scelta === RANDOM) return pescaCasuale(lista);
        return lista.some((v) => v.file === scelta) ? scelta : pescaCasuale(lista);
    }

    window.ArenaOptions = {
        FIELDS: FIELDS,
        TRACKS: TRACKS,
        RANDOM: RANDOM,
        imageFor: (file) => `images/fields/${file}`,
        // I selettori mostrano rettangoli di circa 150x90 px: caricare qui
        // il fondale da 1,5 megapixel spreca banda e memoria di decodifica.
        // Il duello continua invece a usare imageFor() e quindi l'originale.
        previewFor: (file) => `images/fields/thumbs/${String(file).replace(/\.[^.]+$/, '')}.webp`,
        audioFor: (file) => `audio/soundtracks/${file}`,
        nomeCampo: (file) => (FIELDS.find((f) => f.file === file) || {}).nome || 'Arena',
        nomeTraccia: (file) => (TRACKS.find((t) => t.file === file) || {}).nome || 'Colonna sonora',
        risolviCampo: (scelta) => risolvi(scelta, FIELDS),
        risolviTraccia: (scelta) => risolvi(scelta, TRACKS)
    };
})();
