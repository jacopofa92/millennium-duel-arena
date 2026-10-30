// @ts-check
/**
 * tag-db.js — dati della modalità Tag Team (js/modes/tag.js, tag-mode.js, tag.html).
 * =====================================================================
 * Le regole e i loro valori di partenza vengono dal piano di lavoro
 * (docs/planning/PIANO_TAG_TEAM.md, decisioni D1-D17): qui stanno solo i
 * numeri e gli elenchi, così si ritoccano senza leggere il codice.
 */
// eslint-disable-next-line no-unused-vars
const tagDatabase = {
    /**
     * Life Point (D1, regola scelta prima del duello):
     * - 'membro': ognuno dei due ha i suoi; il lato perde quando sono a 0 entrambi (D7).
     * - 'lato': un solo totale per il lato, condiviso; a 0 il lato perde.
     */
    lp: { membro: 8000, lato: 8000 },
    regolaLpPredefinita: 'membro',

    /**
     * Scambio fra i membri (D2). Per ora c'è solo 'obbligato' (si alternano a
     * ogni turno del lato); 'libero' (scelta di chi gioca a inizio turno)
     * arriva in un secondo momento, vedi il piano.
     */
    scambioPredefinito: 'obbligato',

    /**
     * Il compagno IA della fase 1: il suo mazzo è quello del personaggio al
     * livello indicato (js/data/character-decks.js) e la sua IA gioca al
     * livello indicato (js/ai/ai-controller.js). Il mazzo Normale tiene il
     * compagno utile senza farlo vincere al posto tuo; l'IA Difficile gioca
     * meglio quel mazzo.
     */
    compagno: { mazzo: 'medium', ia: 'hard' },

    /**
     * Compagni proposti nella pagina del Tag Team (id del roster,
     * js/data/characters-db.js). Solo personaggi con un mazzo vero; la pagina
     * mostra in più quelli già sbloccati in Duello Libero.
     */
    compagniProposti: ['yugiMuto', 'joey', 'tea', 'tristan', 'mai', 'serenity', 'solomonMuto', 'duke']
};
