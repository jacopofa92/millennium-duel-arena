/**
 * regia-mano-db.js — quali Duellanti hanno la REGIA DELLA MANO in Difficile (1.9.11).
 * =====================================================================
 * Vedi js/modes/regia-mano.js per cosa fa e perche' (compensa le trappole che distruggono tolte dai mazzi Difficile
 * in js/data/character-decks.js: RITOCCHI_MENO_DISTRUZIONE). La lista e' quella dei Duellanti misurati: aggiungerne uno
 * senza rimisurare la difficolta' puo' renderlo piu' duro (la regia da sola vale 1-2 punti di vittorie in meno al giocatore,
 * ma per alcuni mazzi molto di piu').
 */
window.regiaManoDatabase = {
    // Otto volte su cento la mano resta com'e': l'IA sbaglia ogni tanto (come l'Incubo, js/data/incubo-db.js).
    sbagliaPercento: 8,
    duellanti: [
        'alessandroBarbero',
        'bakura',
        'bonz',
        'duke',
        'forestMage',
        'highMageAtenza',
        'highMageKepura',
        'highMageMartis',
        'highMageSecmeton',
        'ishizu',
        'johnson',
        'jono',
        'kaiba',
        'labyrinthMage',
        'lector',
        'mai',
        'mako',
        'marik',
        'meadowMage',
        'mountainMage',
        'neku',
        'nesbitt',
        'noah',
        'odion',
        'panik',
        'paradoxBrothers',
        'priestessIsis',
        'priestSeto',
        'rex',
        'sebek',
        'shadi',
        'simonMuran',
        'strings',
        'teana'
    ]
};
