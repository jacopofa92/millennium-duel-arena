// @ts-check
/**
 * puzzles-db.js — I puzzle "Vinci in questo turno" (puzzle.html).
 * =====================================================================
 * Solo dati: ogni voce descrive una situazione di duello già pronta, e
 * js/modes/puzzle-mode.js la mette sul Terreno al posto della mano
 * iniziale. Il duello poi lo gioca il motore di sempre, senza sapere che
 * è un puzzle: si vince portando a zero i Life Point dell'avversario
 * prima di passare il turno.
 *
 * COME SI SCRIVE UN PUZZLE NUOVO (nessun codice da toccare):
 *   mano              id delle carte nella tua mano;
 *   mostri            i tuoi mostri: [id, 'attacco' | 'difesa' | 'coperto'];
 *   magieTrappole     le tue Magie/Trappole: [id, 'coperta' | 'scoperta'];
 *   cimitero, extra   il tuo Cimitero e il tuo Extra Deck;
 *   avversario        { mostri, magieTrappole, cimitero, mano } con le
 *                     stesse forme; le sue Trappole coperte le attiva
 *                     l'IA vera, quando può;
 *   lp / lpAvversario Life Point di partenza (8000 se assenti);
 *   pescata           la carta che peschi a inizio turno (Dian Keto, che
 *                     non infligge danni, se assente: così la pescata non
 *                     risolve mai un puzzle per caso);
 *   personaggio       chi si fa vedere come avversario (characters-db.js).
 *
 * Una regola per tenerli onesti: la soluzione deve essere UNA idea, e le
 * strade "ovvie" sbagliate devono restare corte di almeno un po' di LP.
 * Ogni puzzle di questo file ha la sua soluzione provata dallo spec
 * tests/specs/modalita-puzzle.spec.js: un puzzle nuovo va aggiunto anche
 * lì, o nessuno si accorgerebbe se smettesse di essere risolvibile.
 */
/** @type {PuzzleDef[]} Forma di ogni voce: types/modalita.d.ts. */
const puzzlesDatabase = [
    {
        id: 'ascia',
        titolo: 'Il primo colpo',
        emblema: '🪓',
        difficolta: 1,
        personaggio: 'bandit_keith',
        descrizione: 'L\'avversario ha il campo vuoto e 2700 Life Point. Ti basta un attacco ben armato… o due.',
        suggerimento: 'Un\'Equipaggiamento rende più forte un mostro, ma ti resta anche l\'Evocazione Normale del turno.',
        lpAvversario: 2700,
        mano: [618, 526],               // Ascia di Distruzione, Servitore del Teschio
        mostri: [[4, 'attacco']],       // Guardiano Celtico
        avversario: {}
    },
    {
        id: 'fusione',
        titolo: 'Due mostri, una leggenda',
        emblema: '🌀',
        difficolta: 1,
        personaggio: 'rex',
        descrizione: 'Hai in mano due mostri troppo forti per essere evocati senza Tributi. L\'avversario ha 2600 Life Point.',
        suggerimento: 'Guarda il tuo Extra Deck: certi mostri non hanno bisogno di Tributi.',
        lpAvversario: 2600,
        mano: [14, 15, 38],             // Gaia il Cavaliere, Anatema del Drago, Fusione
        extra: [254],                   // Gaia il Dragone
        avversario: {}
    },
    {
        id: 'flip',
        titolo: 'La trappola con le zampe',
        emblema: '🐛',
        difficolta: 1,
        personaggio: 'weevil',
        descrizione: 'Un Drago Bianco Occhi Blu ti sbarra la strada, e all\'avversario restano 2350 Life Point.',
        suggerimento: 'Il tuo mostro coperto ha un effetto FLIP: scoprilo con un\'Evocazione Flip.',
        lpAvversario: 2350,
        mostri: [[23, 'coperto'], [24, 'attacco']],   // Insetto Mangia-Uomini, Elfi Gemelli
        avversario: {
            mostri: [[1, 'attacco']]                  // Drago Bianco Occhi Blu
        }
    },
    {
        id: 'cilindro',
        titolo: 'Occhio alla carta coperta',
        emblema: '🎩',
        difficolta: 2,
        personaggio: 'pegasus',
        descrizione: 'Il campo avversario è vuoto, se non fosse per una carta coperta. 2500 Life Point lo separano dalla sconfitta.',
        suggerimento: 'Attaccare alla cieca contro una Trappola coperta può costarti caro.',
        lpAvversario: 2500,
        mano: [607],                    // Tifone Spaziale Mistico
        mostri: [[2, 'attacco']],       // Mago Nero
        avversario: {
            magieTrappole: [[10, 'coperta']]          // Cilindro Magico
        }
    },
    {
        id: 'cuore',
        titolo: 'Il cuore cambia',
        emblema: '💗',
        difficolta: 2,
        personaggio: 'kaiba',
        descrizione: 'Non hai mostri, l\'avversario ne ha due e 3000 Life Point. In mano hai due Magie fortissime.',
        suggerimento: 'L\'ordine in cui giochi le carte conta quanto le carte stesse.',
        lpAvversario: 3000,
        mano: [147, 409],               // Cambiare Idea, Raigeki
        avversario: {
            mostri: [[1, 'attacco'], [24, 'attacco']] // Drago Bianco Occhi Blu, Elfi Gemelli
        }
    },
    {
        id: 'rinascita',
        titolo: 'Un drago in prestito',
        emblema: '♻️',
        difficolta: 2,
        personaggio: 'kaiba',
        descrizione: 'All\'avversario restano 3500 Life Point e un Guardiano Celtico. Nel tuo Cimitero riposa il Mago Nero.',
        suggerimento: 'Mostro Resuscitato non guarda solo nel tuo Cimitero.',
        lpAvversario: 3500,
        mano: [35],                     // Mostro Resuscitato
        mostri: [[24, 'attacco']],      // Elfi Gemelli
        cimitero: [2],                  // Mago Nero
        avversario: {
            mostri: [[4, 'attacco']],   // Guardiano Celtico
            cimitero: [1]               // Drago Bianco Occhi Blu
        }
    },
    {
        id: 'megamorfosi',
        titolo: 'Con le spalle al muro',
        emblema: '🔮',
        difficolta: 3,
        personaggio: 'marik',
        descrizione: 'Ti restano 1000 Life Point, all\'avversario 4000. Il tuo Mago Nero da solo non basta.',
        suggerimento: 'C\'è una carta che diventa più forte proprio quando sei in svantaggio.',
        lp: 1000,
        lpAvversario: 4000,
        mano: [631, 618],               // Megamorfosi, Ascia di Distruzione
        mostri: [[2, 'attacco']],       // Mago Nero
        avversario: {}
    },
    {
        id: 'tempesta',
        titolo: 'Specchi e cilindri',
        emblema: '🌪️',
        difficolta: 3,
        personaggio: 'mai',
        descrizione: 'Due carte coperte proteggono l\'avversario, che ha 3900 Life Point. Ti servono entrambi i tuoi attacchi.',
        suggerimento: 'Togliere una sola carta coperta non basta: l\'altra scatterebbe comunque.',
        lpAvversario: 3900,
        mano: [607, 646],               // Tifone Spaziale Mistico, Tempesta Potente
        mostri: [[2, 'attacco'], [4, 'attacco']],     // Mago Nero, Guardiano Celtico
        avversario: {
            magieTrappole: [[382, 'coperta'], [10, 'coperta']]   // Forza Riflessa, Cilindro Magico
        }
    },
    {
        id: 'buco-nero', titolo: 'Dopo il vuoto', emblema: '◉', difficolta: 1, personaggio: 'weevil',
        descrizione: 'Due mostri bloccano il campo, ma all\'avversario restano 1900 Life Point. Prima fai piazza pulita, poi ricostruisci.',
        suggerimento: 'Buco Nero distrugge anche i tuoi mostri: usalo prima della tua Evocazione Normale.',
        lpAvversario: 1900,
        mano: [7, 24],
        avversario: { mostri: [[4, 'attacco'], [526, 'difesa']] }
    },
    {
        id: 'tributo-dannati', titolo: 'Il prezzo della strada libera', emblema: '⚖️', difficolta: 2, personaggio: 'kaiba',
        descrizione: 'Il Drago Bianco domina il campo. Hai l\'attaccante per vincere, ma prima devi pagare il costo della rimozione.',
        suggerimento: 'Tributo al Dannato richiede una seconda carta da scartare prima di distruggere il bersaglio.',
        lpAvversario: 2500,
        mano: [492, 526],
        mostri: [[13, 'attacco']],
        avversario: { mostri: [[1, 'attacco']] }
    },
    {
        id: 'libro-luna', titolo: 'La forza ha due facce', emblema: '🌙', difficolta: 2, personaggio: 'darknite',
        descrizione: 'Un Drago Berserk da 3500 ATK sembra invalicabile, ma la sua Difesa racconta un\'altra storia.',
        suggerimento: 'Gira il mostro coperto, distruggilo combattendo sulla DEF e conserva il secondo attacco per i Life Point.',
        lpAvversario: 300,
        mano: [875],
        mostri: [[4, 'attacco'], [526, 'attacco']],
        avversario: { mostri: [[110, 'attacco']] }
    },
    {
        id: 'rito-fulgore', titolo: 'Otto livelli al destino', emblema: '🕯️', difficolta: 3, personaggio: 'yamiYugi',
        descrizione: 'Il campo è libero, ma il guerriero decisivo non può essere Evocato normalmente.',
        suggerimento: 'Somma i Livelli dei tuoi due mostri e attiva la Magia Rituale corretta.',
        lpAvversario: 3000,
        mano: [55, 56],
        mostri: [[14, 'attacco'], [526, 'difesa']],
        avversario: {}
    }
];

window.puzzlesDatabase = puzzlesDatabase;
