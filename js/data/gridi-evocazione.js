/**
 * gridi-evocazione.js — i "gridi di battaglia" dei duellanti per le loro
 * carte simbolo (Kaiba col Drago Bianco Occhi Blu, Yugi col Mago Nero...).
 * =====================================================================
 * Prima che quella carta venga Evocata (Normale o Speciale) l'interfaccia
 * mostra il duellante a figura intera che la annuncia: vedi
 * js/ui/grido-evocazione.js. Qui stanno SOLO i dati, così scrivere o
 * ritoccare un grido non richiede di toccare né il motore né la scena.
 *
 * COME SI RICONOSCE IL DUELLANTE: dal nome del file della sua immagine
 * (`images/characters/setoKaiba.jpg` → "setoKaiba"), non dall'id del
 * roster. Il motivo: nella Storia il giocatore può essere un protagonista
 * (Atem, Yugi Muto...) che non è nel roster dei Duellanti ma ha lo stesso
 * file, e Kaiba ha più immagini per contesto (`setoKaiba_duelist_Kingdom`,
 * `kaibaV2`...). `chiavePersonaggio` toglie suffissi e varianti, così una
 * voce vale per tutti i suoi aspetti.
 *
 * COME SI AGGIUNGE UN GRIDO: una riga in GRIDI_EVOCAZIONE con chi lo dice
 * (un elenco di chiavi, vedi i gruppi qui sotto), l'id della carta
 * (data/cards.json) e la frase. Le voci più specifiche vanno PRIMA: vince
 * la prima che corrisponde (es. Yami Yugi ha il suo Mago Nero, diverso da
 * quello di Yugi Muto). Una frase sta bene se non supera ~55 caratteri:
 * su un telefono in verticale la scena la mette su due righe al massimo.
 */
(function () {
    'use strict';

    // Gruppi di aspetti dello stesso duellante (chiavi = nome file immagine).
    const YUGI = ['yugiMuto'];
    const FARAONE = ['yamiYugi', 'atem'];
    const KAIBA = ['setoKaiba', 'kaiba'];

    /** @type {{ chi: string[], carta: number, grido: string }[]} */
    const GRIDI_EVOCAZIONE = [
        // --- Yugi Muto e il Faraone: la Magia Nera ---
        { chi: FARAONE, carta: 2, grido: 'Mago Nero, ti chiamo! Scatena la Magia Nera!' },
        { chi: YUGI, carta: 2, grido: 'Mago Nero, scendi in campo! Credo in te!' },
        { chi: FARAONE.concat(YUGI), carta: 188, grido: 'Maga Oscura, rispondi alla mia chiamata!' },
        { chi: FARAONE.concat(YUGI), carta: 14, grido: 'Gaia il Cavaliere Feroce, carica!' },
        { chi: FARAONE.concat(YUGI, ['solomonMuto']), carta: 15, grido: 'Maledizione del Drago, soffia la tua fiamma!' },
        { chi: FARAONE, carta: 31, grido: 'Slifer, Drago del Cielo! Risveglia il tuo ruggito!' },
        { chi: FARAONE, carta: 854, grido: 'Mago del Caos Nero, spezza le tenebre!' },
        { chi: FARAONE, carta: 20, grido: 'Buster Blader, apri la strada alla vittoria!' },
        { chi: ['solomonMuto'], carta: 14, grido: 'Gaia, cavalca come il vento!' },
        { chi: ['solomonMuto', 'makoTsunami'], carta: 260, grido: 'Dalle acque profonde, sorgi, Serpente di Mare!' },

        // --- Seto Kaiba (e il suo antenato, il Sacerdote Seto) ---
        { chi: KAIBA, carta: 1, grido: 'Vieni a me, Drago Bianco Occhi Blu! Annienta tutto!' },
        { chi: ['priestSeto'], carta: 1, grido: 'Per il Faraone: Drago Bianco Occhi Blu, sorgi!' },
        { chi: KAIBA, carta: 30, grido: 'Obelisk il Tormentatore! Spazza via ogni cosa!' },
        { chi: KAIBA, carta: 29, grido: 'Tre teste, un solo ruggito: Drago Bianco Definitivo!' },
        { chi: KAIBA, carta: 511, grido: 'Fusione! Cannone Drago XY, fuoco a volontà!' },
        { chi: KAIBA, carta: 512, grido: 'Cannone Drago XYZ! Nessuno può fermarmi!' },
        { chi: KAIBA, carta: 864, grido: 'Drago Armato LV7, la tua evoluzione è completa!' },
        { chi: KAIBA, carta: 320, grido: 'Kaiser Glider, spazza via il campo!' },

        // --- Joey Wheeler ---
        { chi: ['joeyWheeler'], carta: 12, grido: 'Fatti avanti, Drago Nero Occhi Rossi! Fai vedere chi sei!' },
        { chi: ['joeyWheeler'], carta: 267, grido: 'Gilford il Fulmine! Fai tuonare la vittoria!' },
        { chi: ['joeyWheeler'], carta: 258, grido: 'Gearfried, ci penso io: sfodera la spada!' },
        { chi: ['joeyWheeler'], carta: 399, grido: 'Guerriero Pantera, insegna loro il rispetto!' },

        // --- Maximillion Pegasus: sorprese e Toon ---
        { chi: ['maximillionPegasus'], carta: 416, grido: 'Abbandonato, assorbi la forza dei miei nemici!' },
        { chi: ['maximillionPegasus'], carta: 123, grido: 'Che sorpresa! Drago Toon Occhi Blu, a te la scena!' },
        { chi: ['maximillionPegasus'], carta: 486, grido: 'Teschio Evocato Toon, fai ridere... di paura!' },
        { chi: ['maximillionPegasus'], carta: 606, grido: 'Manga Ryu-Ran, apri il sipario!' },

        // --- Gli altri duellanti dell'anime ---
        { chi: ['yamiMarik'], carta: 472, grido: 'Drago Alato di Ra, Dio del Sole! Brucia i miei nemici!' },
        { chi: ['yamiMarik'], carta: 1123, grido: 'Helpoemer, porta il Regno delle Ombre su di loro!' },
        { chi: ['yamiMarik'], carta: 265, grido: 'Gil Garth, ruggisci dall\'oscurità!' },
        { chi: ['yamiMarik'], carta: 1086, grido: 'Newdoria, divora la loro speranza!' },
        { chi: ['yamiMarik'], carta: 129, grido: 'Bowganian, scocca la freccia nell\'ombra!' },
        { chi: ['yamiMarik'], carta: 186, grido: 'Jeroid Oscuro, a me il tuo sguardo gelido!' },
        { chi: ['yamiMarik'], carta: 564, grido: 'Titano Oscuro del Terrore, schiaccia i miei nemici!' },
        { chi: ['yamiMarik'], carta: 914, grido: 'Re della Nebbia, avvolgili nel buio!' },
        // --- Ishizu Ishtar: la guardiana della Collana ---
        { chi: ['ishizuIshtar'], carta: 562, grido: 'Gyakutenno Megami, guida il destino con la tua luce!' },
        { chi: ['ishizuIshtar'], carta: 217, grido: 'Strega Oscura Dunames, mostra ciò che vedi!' },
        { chi: ['ishizuIshtar'], carta: 1092, grido: 'Senju delle Mille Mani, proteggi il Faraone!' },
        { chi: ['ishizuIshtar'], carta: 1001, grido: 'Sacerdote di Asura, la profezia si compie!' },
        { chi: ['ishizuIshtar'], carta: 949, grido: 'Ocubeam, vedi oltre il tempo!' },
        // --- Noah Kaiba: gli dei del mondo virtuale ---
        { chi: ['noah'], carta: 1004, grido: 'Hino-Kagu-Tsuchi, brucia il mio mondo virtuale!' },
        { chi: ['noah'], carta: 1008, grido: 'Drago Yamata, otto teste per un solo comando!' },
        { chi: ['noah'], carta: 1006, grido: 'Otohime, sorgi dalle onde digitali!' },
        { chi: ['noah'], carta: 1002, grido: 'Fushi No Tori, rinasci dalle fiamme!' },
        { chi: ['noah'], carta: 884, grido: 'Yata-Garasu, vola e portami la vittoria!' },
        { chi: ['maiValentine'], carta: 290, grido: 'Sorelle Lady Arpia, cantate la mia vittoria!' },
        { chi: ['maiValentine'], carta: 293, grido: 'Drago da Compagnia delle Arpie, all\'attacco!' },
        { chi: ['rexRaptor'], carta: 801, grido: 'Tiranno Nero! Il re dei dinosauri è qui!' },
        { chi: ['rexRaptor'], carta: 799, grido: 'Driceratopo Oscuro, travolgili tutti!' },
        { chi: ['weevilUnderwood'], carta: 52, grido: 'Grande Falena, spargi le tue spore!' },
        { chi: ['weevilUnderwood'], carta: 1124, grido: 'Falena Perfetta, ali spiegate!' },
        { chi: ['weevilUnderwood'], carta: 295, grido: 'Scarabeo Ercole, schiaccialo con le corna!' },
        { chi: ['makoTsunami'], carta: 252, grido: 'Balena Fortezza, sollevati dagli abissi!' },
        { chi: ['makoTsunami'], carta: 879, grido: 'Il Pescatore Leggendario, getta la rete!' },
        { chi: ['yamiBakura'], carta: 1118, grido: 'Sovrano Oscuro Ha Des, risvegliati dal nulla!' },
        { chi: ['yamiBakura'], carta: 891, grido: 'Necropaura Oscura, divora la loro anima!' },
        { chi: ['banditKeith', 'heishin'], carta: 377, grido: 'Metalzoa, macchina di morte, avanti!' },
        { chi: ['banditKeith'], carta: 104, grido: 'Drago Barile, tira a sorte e spara!' },
        { chi: ['teaGardner'], carta: 188, grido: 'Maga Oscura, proteggi i miei amici!' },
        { chi: ['dukeDevlin'], carta: 395, grido: 'Orgoth l\'Implacabile, getta i dadi!' },
        { chi: ['dukeDevlin'], carta: 720, grido: 'Gran Maestro Ninja Sasuke, colpisci nell\'ombra!' },
        { chi: ['gozaburo'], carta: 230, grido: 'Exodia Necross, risorgi dal Cimitero!' },
        { chi: ['gozaburo'], carta: 467, grido: 'Demone Megacyber, esegui il mio ordine!' },
        { chi: ['espaRoba', 'heishin'], carta: 17, grido: 'Jinzo! Nessuna trappola sopravvive!' },
        { chi: ['arkana'], carta: 2, grido: 'Il mio Mago Nero! La vera illusione comincia ora!' }
    ];

    /**
     * Chiave del duellante dal nome del file della sua immagine: toglie
     * cartella, estensione, il suffisso di contesto (`_duelist_Kingdom`) e
     * "V2", così tutti gli aspetti dello stesso personaggio coincidono.
     * @param {string | null | undefined} image
     */
    function chiavePersonaggio(image) {
        const file = String(image || '').split(/[\\/]/).pop() || '';
        return file.replace(/\.[a-z0-9]+(?:\?.*)?$/i, '').replace(/_.*$/, '').replace(/V2$/, '');
    }

    /**
     * Il grido di un duellante per una carta, o null se non ne ha.
     * @param {string | null | undefined} image  immagine del duellante (DuelSession.player/opponent)
     * @param {number} cartaId
     * @returns {string | null}
     */
    function trovaGridoEvocazione(image, cartaId) {
        const chiave = chiavePersonaggio(image);
        if (!chiave) return null;
        const voce = GRIDI_EVOCAZIONE.find((v) => v.carta === cartaId && v.chi.indexOf(chiave) !== -1);
        return voce ? voce.grido : null;
    }

    window.GRIDI_EVOCAZIONE = GRIDI_EVOCAZIONE;
    window.chiavePersonaggio = chiavePersonaggio;
    window.trovaGridoEvocazione = trovaGridoEvocazione;
})();
