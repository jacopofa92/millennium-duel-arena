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
     * D19 (decisa dall'autore): nel 2 contro 1 con i Life Point a testa la
     * coppia parte con questi Life Point A TESTA (4000 + 4000 = gli 8000
     * dell'avversario solo, che restano quelli di sempre). Con i Life Point
     * condivisi e nel 2 contro 2 valgono i numeri qui sopra.
     */
    lpMembroControUno: 4000,

    /**
     * I Life Point di una squadra nel formato scelto.
     * @param {boolean} controUno vero nel 2 contro 1 (dall'altra parte un solo duellante)
     * @returns {{ membro: number, lato: number }}
     */
    lpSquadra(controUno) {
        return { membro: controUno ? this.lpMembroControUno : this.lp.membro, lato: this.lp.lato };
    },

    /**
     * Scambio fra i membri (D2, regola scelta prima del duello):
     * - 'obbligato': si alternano a ogni turno del lato;
     * - 'libero': si alternano, ma puoi chiedere al compagno di invertire il
     *   prossimo turno della squadra; se non accetta si va a turno (il
     *   criterio con cui risponde l'IA sta in compagnoAccetta, js/modes/tag.js).
     */
    scambioPredefinito: 'obbligato',

    /**
     * Boss a squadre (fase 2 del piano): tu e il compagno contro un Boss del
     * Raid (js/data/raid-db.js, solo l'elenco: i Life Point del Raid sono
     * quelli di una barra comune e qui non valgono). Il Boss gioca il suo
     * mazzo Difficile con questi Life Point e pesca come sempre; la coppia ha i
     * Life Point del 2 contro 1 (lpSquadra(true)). Premio: quello di un duello
     * normale contro quel Duellante.
     */
    lpBoss: 12000,
    livelloBoss: 'Difficile',

    /**
     * Chi attacca sceglie, a inizio turno, quale membro della squadra
     * avversaria affrontare (D12). D13: lo stesso membro non si affronta per
     * più di questi turni di fila finché il suo compagno è in gioco, così non
     * si può tenere l'altro intatto in panchina per sempre. 0 = nessun limite.
     */
    limiteBersaglio: 2,

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
